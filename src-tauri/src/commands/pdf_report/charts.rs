use serde_json::Value;

pub struct PdfChartBar {
    pub label: String,
    pub value: u64,
    pub scale: u64,
}

pub fn crawl_chart(run: &Value) -> Option<Vec<PdfChartBar>> {
    let result = run.get("result")?;
    let pages = result.get("pages").and_then(Value::as_array);
    let page_count = result
        .get("pages_crawled")
        .and_then(Value::as_u64)
        .or_else(|| pages.map(|items| items.len() as u64));
    let critical = result.get("critical_count").and_then(Value::as_u64);
    let warnings = result.get("warning_count").and_then(Value::as_u64);
    let health = result.get("health_score").and_then(Value::as_u64);
    let status_2xx = pages.map(|items| {
        items
            .iter()
            .filter(|page| {
                page.get("http_status")
                    .and_then(Value::as_u64)
                    .is_some_and(|status| (200..300).contains(&status))
            })
            .count() as u64
    });
    let status_errors = pages.map(|items| {
        items
            .iter()
            .filter(|page| {
                page.get("http_status")
                    .and_then(Value::as_u64)
                    .is_some_and(|status| status >= 400)
            })
            .count() as u64
    });

    let mut bars = Vec::new();
    if let Some(value) = health {
        bars.push(PdfChartBar {
            label: "Health score".into(),
            value: value.min(100),
            scale: 100,
        });
    }
    if let Some(value) = page_count {
        bars.push(PdfChartBar {
            label: "Pages crawled".into(),
            value,
            scale: value.max(1),
        });
    }
    if let Some(value) = critical {
        bars.push(PdfChartBar {
            label: "Critical issues".into(),
            value,
            scale: value.max(1),
        });
    }
    if let Some(value) = warnings {
        bars.push(PdfChartBar {
            label: "Warnings".into(),
            value,
            scale: value.max(1),
        });
    }
    if let Some(value) = status_2xx {
        bars.push(PdfChartBar {
            label: "HTTP 2xx".into(),
            value,
            scale: value.max(1),
        });
    }
    if let Some(value) = status_errors {
        bars.push(PdfChartBar {
            label: "HTTP 4xx/5xx".into(),
            value,
            scale: value.max(1),
        });
    }
    (!bars.is_empty()).then_some(bars)
}

pub fn audit_chart(audit: &Value) -> Option<Vec<PdfChartBar>> {
    let mut bars = Vec::new();
    if let Some(value) = audit.get("health_score").and_then(Value::as_u64) {
        bars.push(PdfChartBar {
            label: "Health score".into(),
            value: value.min(100),
            scale: 100,
        });
    }
    if let Some(value) = audit
        .pointer("/security_headers/score")
        .and_then(Value::as_u64)
    {
        bars.push(PdfChartBar {
            label: "Security score".into(),
            value: value.min(100),
            scale: 100,
        });
    }
    if let Some(value) = audit.pointer("/headings/h1_count").and_then(Value::as_u64) {
        bars.push(PdfChartBar {
            label: "H1 count".into(),
            value,
            scale: value.max(1),
        });
    }
    if let Some(value) = audit.get("images").and_then(Value::as_array) {
        let count = value.len() as u64;
        bars.push(PdfChartBar {
            label: "Images".into(),
            value: count,
            scale: count.max(1),
        });
    }
    if let Some(value) = audit.pointer("/links/total_links").and_then(Value::as_u64) {
        bars.push(PdfChartBar {
            label: "Links".into(),
            value,
            scale: value.max(1),
        });
    }
    (!bars.is_empty()).then_some(bars)
}
