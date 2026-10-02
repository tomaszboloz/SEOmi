#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CrawlProfileHeader {
    pub name: String,
    pub value: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CrawlAuthProfile {
    pub headers: Vec<CrawlProfileHeader>,
    pub cookie: Option<String>,
    #[serde(default)]
    pub proxy_url: Option<String>,
}
