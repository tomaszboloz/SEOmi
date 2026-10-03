use super::*;

mod article;
mod breadcrumblist;
mod event;
mod faqpage;
mod imageobject;
mod offer;
mod organization;
mod person;
mod product;
mod recipe;
mod review;
mod videoobject;

pub(super) fn validate_jsonld_profile_values(
    data_type: &str,
    value: &serde_json::Map<String, Value>,
    path: &str,
    issues: &mut IssueCollector,
) {
    match type_name(data_type).to_ascii_lowercase().as_str() {
        "product" => product::validate(value, path, issues),
        "breadcrumblist" => breadcrumblist::validate(value, path, issues),
        "article" | "newsarticle" | "blogposting" => article::validate(value, path, issues),
        "organization" | "website" | "webpage" | "localbusiness" => {
            organization::validate(value, path, issues)
        }
        "faqpage" => faqpage::validate(value, path, issues),
        "event" => event::validate(value, path, issues),
        "recipe" => recipe::validate(value, path, issues),
        "videoobject" => videoobject::validate(value, path, issues),
        "review" => review::validate(value, path, issues),
        "offer" => offer::validate(value, path, issues),
        "person" | "author" => person::validate(value, path, issues),
        "imageobject" => imageobject::validate(value, path, issues),
        _ => {}
    }
}
