use super::*;

pub(super) fn validate_profile(
    data_type: &str,
    properties: &HashSet<String>,
    path: &str,
    issues: &mut IssueCollector,
) {
    let name = type_name(data_type);
    match name.to_ascii_lowercase().as_str() {
        "product" => {
            if !properties.contains("name") {
                issues.push(issue(
                    "product-name-missing",
                    "warning",
                    "Product has no name property in the locally supported product rich-result profile.",
                    Some(path.into()),
                    Some("Add a non-empty name property to Product."),
                ));
            }
            if !["offers", "review", "aggregaterating"]
                .iter()
                .any(|property| properties.contains(*property))
            {
                issues.push(issue(
                    "product-offer-review-missing",
                    "warning",
                    "Product has no offers, review, or aggregateRating property in the locally supported product rich-result profile.",
                    Some(path.into()),
                    Some("Add accurate offers, review, or aggregateRating data when applicable."),
                ));
            }
        }
        "breadcrumblist" if !properties.contains("itemlistelement") => {
            issues.push(issue(
                "breadcrumb-items-missing",
                "warning",
                "BreadcrumbList has no itemListElement property.",
                Some(path.into()),
                Some("Add an ordered itemListElement array of ListItem records."),
            ));
        }
        "article" | "newsarticle" | "blogposting" if !properties.contains("headline") => {
            issues.push(issue(
                "article-headline-recommended",
                "info",
                "Article-family data has no headline property.",
                Some(path.into()),
                Some("Add the article headline when it is available in the visible page content."),
            ));
        }
        "organization" | "website" | "webpage" | "localbusiness"
            if !properties.contains("name") =>
        {
            issues.push(issue(
                "schema-name-missing",
                "warning",
                format!("{name} has no name property in the locally supported Schema.org profile."),
                Some(path.into()),
                Some("Add an accurate non-empty name when the entity is represented on the page."),
            ));
        }
        "faqpage" if !properties.contains("mainentity") => {
            issues.push(issue(
                "faq-main-entity-missing",
                "warning",
                "FAQPage has no mainEntity property in the locally supported FAQ profile.",
                Some(path.into()),
                Some("Provide the FAQ questions as mainEntity Question objects when applicable."),
            ));
        }
        "question" if !properties.contains("name") => {
            issues.push(issue(
                "question-name-missing",
                "warning",
                "Question has no name property in the locally supported FAQ profile.",
                Some(path.into()),
                Some("Add the visible question text as name."),
            ));
        }
        "event" if !properties.contains("name") => {
            issues.push(issue(
                "event-name-missing",
                "warning",
                "Event has no name property in the locally supported event profile.",
                Some(path.into()),
                Some("Add the visible event name as a non-empty name."),
            ));
        }
        "recipe" if !properties.contains("name") => {
            issues.push(issue(
                "recipe-name-missing",
                "warning",
                "Recipe has no name property in the locally supported recipe profile.",
                Some(path.into()),
                Some("Add the visible recipe name as a non-empty name."),
            ));
        }
        "videoobject" if !properties.contains("name") => {
            issues.push(issue(
                "video-name-missing",
                "warning",
                "VideoObject has no name property in the locally supported video profile.",
                Some(path.into()),
                Some("Add the visible video name as a non-empty name."),
            ));
        }
        "review" if !properties.contains("reviewbody") => {
            issues.push(issue(
                "review-body-missing",
                "info",
                "Review has no reviewBody property in the locally supported review profile.",
                Some(path.into()),
                Some("Add the visible review text when the review body is available."),
            ));
        }
        "person" | "author" if !properties.contains("name") => {
            issues.push(issue(
                "person-name-missing",
                "warning",
                "Person has no name property in the locally supported person profile.",
                Some(path.into()),
                Some("Add the person's visible name."),
            ));
        }
        "imageobject" if !properties.contains("contenturl") && !properties.contains("url") => {
            issues.push(issue(
                "image-url-missing",
                "warning",
                "ImageObject has no contentUrl or url property in the locally supported image profile.",
                Some(path.into()),
                Some("Provide the image URL that is represented by this ImageObject."),
            ));
        }
        _ => {}
    }
}
