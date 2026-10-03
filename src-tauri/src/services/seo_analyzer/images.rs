use crate::models::audit_data::{ImageData, Issue, IssueCategory, IssueSeverity};
use crate::services::html_parser::resolve_url;
use scraper::{Html, Selector};
use url::Url;

#[path = "image_dimensions.rs"]
mod image_dimensions;
#[path = "image_format.rs"]
mod image_format;

pub(super) use image_dimensions::intrinsic_data_uri_dimensions;
use image_format::infer_image_format;

pub(super) fn parse_images(html_str: &str, base_url: &Url) -> (Vec<ImageData>, Vec<Issue>) {
    let document = Html::parse_document(html_str);
    let mut images = Vec::new();
    let mut issues = Vec::new();

    let img_selector = Selector::parse("img").unwrap();
    let mut missing_alt_count = 0;
    let mut missing_dim_count = 0;

    for el in document.select(&img_selector) {
        let src_attr = el.value().attr("src").unwrap_or("").trim();
        if src_attr.is_empty() {
            continue;
        }

        let full_src = resolve_url(src_attr, Some(base_url));
        let alt = el.value().attr("alt").map(|s| s.trim().to_string());
        let intrinsic_dimensions = intrinsic_data_uri_dimensions(&full_src);
        let width = el
            .value()
            .attr("width")
            .map(|s| s.trim().to_string())
            .or_else(|| intrinsic_dimensions.map(|dimensions| dimensions.0.to_string()));
        let height = el
            .value()
            .attr("height")
            .map(|s| s.trim().to_string())
            .or_else(|| intrinsic_dimensions.map(|dimensions| dimensions.1.to_string()));
        let has_width_attribute = el.value().attr("width").is_some();
        let has_height_attribute = el.value().attr("height").is_some();
        let dimensions_source = if has_width_attribute && has_height_attribute {
            Some("attributes".to_string())
        } else if intrinsic_dimensions.is_some() {
            Some(if has_width_attribute || has_height_attribute {
                "mixed".to_string()
            } else {
                "intrinsic-data-uri".to_string()
            })
        } else {
            None
        };
        let loading = el.value().attr("loading").map(|s| s.trim().to_string());
        let srcset = el.value().attr("srcset").map(|s| s.trim().to_string());

        // The empty alt attribute is itself the HTML signal for a decorative
        // image. aria-hidden/role are optional, not prerequisites.
        let decorative = alt.as_deref().is_some_and(|value| value.trim().is_empty());
        let has_alt = decorative || matches!(&alt, Some(value) if !value.trim().is_empty());

        if !has_alt && !decorative {
            missing_alt_count += 1;
        }

        if width.is_none() || height.is_none() {
            missing_dim_count += 1;
        }

        let format = infer_image_format(&full_src);

        images.push(ImageData {
            src: full_src,
            alt,
            width,
            height,
            loading,
            srcset,
            has_alt,
            format,
            dimensions_source,
        });
    }

    if missing_alt_count > 0 {
        let severity = if missing_alt_count > 5 {
            IssueSeverity::Critical
        } else {
            IssueSeverity::Warning
        };

        issues.push(Issue {
            severity,
            category: IssueCategory::Images,
            code: Some("images_alt_missing".into()),
            params: Some(std::collections::BTreeMap::from([(
                "count".into(),
                missing_alt_count.to_string(),
            )])),
            message: format!("{} image(s) missing 'alt' descriptive text", missing_alt_count),
            recommendation: Some(
                "Add descriptive alt attributes to all meaningful images for accessibility and image search ranking"
                    .to_string(),
            ),
        });
    }

    if missing_dim_count > 0 {
        issues.push(Issue {
            severity: IssueSeverity::Info,
            category: IssueCategory::Images,
            code: Some("images_dimensions_missing".into()),
            params: Some(std::collections::BTreeMap::from([(
                "count".into(),
                missing_dim_count.to_string(),
            )])),
            message: format!(
                "{} image(s) missing explicit width/height dimensions (CLS risk)",
                missing_dim_count
            ),
            recommendation: Some(
                "Specify explicit width and height attributes on <img> elements to prevent Cumulative Layout Shift (CLS)"
                    .to_string(),
            ),
        });
    }

    (images, issues)
}
