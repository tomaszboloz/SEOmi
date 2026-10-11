use super::super::charts::PdfChartBar;
use super::super::text_utils::pdf_literal;

pub fn chart_stream(bars: &[PdfChartBar]) -> String {
    let mut stream = String::from("BT\n/F1 16 Tf\n50 780 Td\n(Crawl metrics - saved run) Tj\nET\n");
    for (index, bar) in bars.iter().enumerate() {
        let y = 690_i32 - (index as i32 * 82);
        let width = 360_u64.saturating_mul(bar.value.min(bar.scale)) / bar.scale.max(1);
        let text_y = y + 30;
        stream.push_str(&format!(
            "BT\n/F1 10 Tf\n50 {text_y} Td\n({}: {}) Tj\nET\n",
            pdf_literal(&bar.label),
            bar.value
        ));
        stream.push_str("0.10 0.65 0.43 rg\n");
        stream.push_str(&format!("190 {y} {width} 24 re f\n"));
        stream.push_str("0.35 0.40 0.47 RG\n1 w\n190 ");
        stream.push_str(&format!("{y} 360 24 re S\n"));
    }
    stream
}
