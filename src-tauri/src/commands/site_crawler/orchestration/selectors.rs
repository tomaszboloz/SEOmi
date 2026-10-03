use scraper::Selector;

pub struct CrawlSelectors {
    pub a: Selector,
    pub title: Selector,
    pub h1: Selector,
    pub headings: Selector,
    pub meta_desc: Selector,
    pub canonical: Selector,
    pub robots: Selector,
    pub meta_refresh: Selector,
    pub image: Selector,
    pub script_src: Selector,
    pub link_href: Selector,
    pub media_src: Selector,
    pub html: Selector,
    pub hreflang: Selector,
}

impl CrawlSelectors {
    pub fn compile() -> Self {
        Self {
            a: Selector::parse("a[href]").unwrap(),
            title: Selector::parse("title").unwrap(),
            h1: Selector::parse("h1").unwrap(),
            headings: Selector::parse("h1, h2, h3, h4, h5, h6").unwrap(),
            meta_desc: Selector::parse("meta[name='description']").unwrap(),
            canonical: Selector::parse("link[rel][href]").unwrap(),
            robots: Selector::parse("meta[name='robots']").unwrap(),
            meta_refresh: Selector::parse("meta[http-equiv]").unwrap(),
            image: Selector::parse("img[src]").unwrap(),
            script_src: Selector::parse("script[src]").unwrap(),
            link_href: Selector::parse("link[href]").unwrap(),
            media_src: Selector::parse("source[src], video[src], audio[src]").unwrap(),
            html: Selector::parse("html").unwrap(),
            hreflang: Selector::parse("link[hreflang][href]").unwrap(),
        }
    }
}
