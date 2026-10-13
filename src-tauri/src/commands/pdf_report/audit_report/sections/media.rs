use super::super::check::{Check, Section};
use super::super::ctx::{field, Ctx};
use super::super::strings::{checks as c, t};
use serde_json::Value;

fn count_where(items: &[Value], keep: impl Fn(&Value) -> bool) -> usize {
    items.iter().filter(|item| keep(item)).count()
}

pub fn images(ctx: &Ctx) -> Section {
    let images = ctx.list("/images");
    let missing_alt = count_where(images, |i| i.get("has_alt") != Some(&Value::Bool(true)));
    let no_size = count_where(images, |i| {
        field(i, "width").is_none() || field(i, "height").is_none()
    });
    let formats: std::collections::BTreeMap<String, usize> =
        images.iter().fold(Default::default(), |mut acc, image| {
            *acc.entry(field(image, "format").unwrap_or_else(|| c::UNKNOWN.into()))
                .or_default() += 1;
            acc
        });
    let formats: Vec<String> = formats
        .iter()
        .map(|(name, n)| format!("{name} ({n})"))
        .collect();
    Section {
        title: c::IMAGES_TITLE.into(),
        checks: vec![
            Check::info(c::IMAGE_TOTAL, Some(images.len().to_string())),
            ctx.counted(
                c::IMAGE_ALT,
                t(c::MISSING_COUNT, &[&missing_alt.to_string()]),
                missing_alt,
                &["images_alt"],
                c::FIX_ALT,
            ),
            ctx.counted(
                c::IMAGE_SIZE,
                t(c::MISSING_COUNT, &[&no_size.to_string()]),
                no_size,
                &["images_dimensions"],
                c::FIX_SIZE,
            ),
            Check::info(
                c::IMAGE_FORMATS,
                (!formats.is_empty()).then(|| formats.join(", ")),
            ),
        ],
    }
}

pub fn links(ctx: &Ctx) -> Section {
    let links = ctx.list("/links/links");
    let insecure = count_where(links, |l| l.get("is_insecure") == Some(&Value::Bool(true)));
    let blank = count_where(links, |l| field(l, "target").as_deref() == Some("_blank")).to_string();
    Section {
        title: c::LINKS_TITLE.into(),
        checks: vec![
            Check::info(c::LINK_TOTAL, ctx.count("/links/total_links")),
            Check::info(c::LINK_INTERNAL, ctx.count("/links/internal_links")),
            Check::info(c::LINK_EXTERNAL, ctx.count("/links/external_links")),
            Check::info(c::LINK_NOFOLLOW, ctx.count("/links/nofollow_links")),
            ctx.counted(
                c::LINK_INSECURE,
                insecure.to_string(),
                insecure,
                &["links_insecure"],
                c::FIX_INSECURE,
            ),
            ctx.judged(c::LINK_BLANK, Some(blank), &["links_target_blank"]),
        ],
    }
}
