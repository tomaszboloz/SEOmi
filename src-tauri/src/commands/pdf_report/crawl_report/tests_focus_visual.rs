//! Site Focus PDF stress renders for visual review (#53 GEM-53-03..05): very long
//! URLs, many off-topic pages, segments and every one of the 12 UI locales,
//! including right-to-left Arabic. The assertions are automatic; looking at the
//! rendered pages is not. With `SEOMI_FOCUS_PDF_DIR` set, each PDF is also written
//! there for `scripts/render-focus-pdf.mjs` to rasterise and hash.

use super::crawl_pdf;
use super::tests_focus::{focus, with_focus};
use crate::commands::pdf_report::tests::extract_pdf_text;
use serde_json::{json, Value};

const LOCALES: [&str; 12] = [
    "en", "pl", "de", "es", "fr", "it", "pt", "ru", "ja", "ko", "zh", "ar",
];
const OFF_TOPIC: usize = 60;

fn long_url(index: usize) -> String {
    let slug = "very-long-programmatic-landing-page-segment-".repeat(5);
    format!(
        "https://shop.example.test/catalogue/{slug}{index}?utm_source=newsletter&variant={index}"
    )
}

pub(super) fn stress_focus() -> Value {
    let mut summary = focus();
    let pages: Vec<Value> = (0..OFF_TOPIC)
        .map(|index| json!({"url": long_url(index), "type": "article", "trs": (index % 40) as f64,
            "similarity": 5, "overlap": 4, "drift": 90, "status": "off-topic",
            "playbook": {"type": "A", "options": [{"code": "remove-redirect", "params": {"gain": 0.4}}]}}))
        .collect();
    summary["pages"] = Value::Array(pages);
    summary["counts"]["off_topic"] = json!(OFF_TOPIC);
    summary["segments"] = json!([
        {"label": "Sklep zażółć", "path_prefix": "/catalogue/very-long-programmatic-landing-page", "core": "insulin pumps, glucose meters", "scored": 59, "pages": 60, "score": 12.3},
        {"label": "مدونة", "path_prefix": "/blog", "core": "", "scored": 0, "pages": 0, "score": null}
    ]);
    summary
}

fn bundle(locale: &str) -> Value {
    let path = format!(
        "{}/../src/i18n/locales/{locale}.json",
        env!("CARGO_MANIFEST_DIR")
    );
    let text = std::fs::read_to_string(&path).expect("locale file");
    serde_json::from_str::<Value>(&text).expect("locale json")["pdfReport"].clone()
}

fn page_count(bytes: &[u8]) -> usize {
    String::from_utf8_lossy(bytes)
        .matches("/Type /Page ")
        .count()
}

#[test]
fn stress_focus_pdf_renders_in_every_locale_with_localized_labels() {
    let out = std::env::var_os("SEOMI_FOCUS_PDF_DIR");
    for locale in LOCALES {
        let labels = bundle(locale);
        let mut run = with_focus(stress_focus());
        run["pdf_labels"] = labels.clone();
        let bytes = crawl_pdf(&run);
        assert!(bytes.starts_with(b"%PDF-1.4"), "{locale}: not a PDF");
        assert!(page_count(&bytes) >= 3, "{locale}: too few pages");
        let title = labels["crawl"]["focus"]["tSegments"]
            .as_str()
            .expect("segments title");
        let text = extract_pdf_text(&bytes);
        // Arabic is stored in visual (shaped, reordered) order, so only its numbers are compared.
        assert!(
            locale == "ar" || text.contains(title),
            "{locale}: missing {title}"
        );
        assert!(text.contains("12.3"), "{locale}: segment score");
        if let Some(dir) = &out {
            std::fs::create_dir_all(dir).expect("artifact dir");
            std::fs::write(
                std::path::Path::new(dir).join(format!("focus-{locale}.pdf")),
                &bytes,
            )
            .expect("write pdf");
        }
    }
}

#[test]
fn long_urls_keep_their_tail_and_every_off_topic_row_is_listed() {
    let text = extract_pdf_text(&crawl_pdf(&with_focus(stress_focus())));
    let compact: String = text.split_whitespace().collect();
    for index in [0, OFF_TOPIC / 2, OFF_TOPIC - 1] {
        assert!(
            compact.contains(&format!("variant={index}")),
            "row {index} lost its URL tail"
        );
    }
}
