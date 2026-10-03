use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MetaTags {
    pub title: Option<String>,
    pub title_length: usize,
    pub description: Option<String>,
    pub description_length: usize,
    pub keywords: Option<String>,
    pub robots: Option<String>,
    pub canonical: Option<String>,
    pub viewport: Option<String>,
    pub charset: Option<String>,
    pub author: Option<String>,
    pub generator: Option<String>,
    pub theme_color: Option<String>,
    pub other_tags: Vec<MetaTag>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct MetaTag {
    pub name: Option<String>,
    pub property: Option<String>,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct OpenGraphData {
    pub og_title: Option<String>,
    pub og_description: Option<String>,
    pub og_image: Option<String>,
    pub og_image_width: Option<String>,
    pub og_image_height: Option<String>,
    pub og_url: Option<String>,
    pub og_type: Option<String>,
    pub og_site_name: Option<String>,
    pub og_locale: Option<String>,
    pub all_tags: Vec<MetaTag>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TwitterCardData {
    pub twitter_card: Option<String>,
    pub twitter_site: Option<String>,
    pub twitter_creator: Option<String>,
    pub twitter_title: Option<String>,
    pub twitter_description: Option<String>,
    pub twitter_image: Option<String>,
    pub all_tags: Vec<MetaTag>,
}
