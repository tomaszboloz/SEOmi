use super::charts::PdfChartBar;
use super::text_utils::{pdf_literal, wrapped_lines};

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

pub fn pdf_bytes(lines: Vec<String>, chart: Option<Vec<PdfChartBar>>) -> Vec<u8> {
    let mut visual_lines = Vec::new();
    for line in lines {
        visual_lines.extend(wrapped_lines(&line, 96));
    }
    let page_chunks = visual_lines.chunks(48).collect::<Vec<_>>();
    let text_page_count = page_chunks.len().max(1);
    let chart_page_count = usize::from(chart.is_some());
    let page_count = text_page_count + chart_page_count;
    let mut objects = vec![
        "<< /Type /Catalog /Pages 2 0 R >>".to_string(),
        format!(
            "<< /Type /Pages /Kids [{}] /Count {page_count} >>",
            (0..page_count)
                .map(|index| format!("{} 0 R", 4 + index * 2))
                .collect::<Vec<_>>()
                .join(" ")
        ),
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>".to_string(),
    ];
    for chunk in page_chunks {
        let mut stream = String::from("BT\n/F1 10 Tf\n50 792 Td\n");
        for (index, line) in chunk.iter().enumerate() {
            if index > 0 {
                stream.push_str("0 -15 Td\n");
            }
            stream.push_str(&format!("({}) Tj\n", pdf_literal(line)));
        }
        stream.push_str("ET\n");
        let content_id = objects.len() + 2;
        objects.push(format!("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 3 0 R >> >> /Contents {content_id} 0 R >>"));
        objects.push(format!(
            "<< /Length {} >>\nstream\n{}endstream",
            stream.len(),
            stream
        ));
    }
    if let Some(bars) = chart.as_deref() {
        let stream = chart_stream(bars);
        let content_id = objects.len() + 2;
        objects.push(format!("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 3 0 R >> >> /Contents {content_id} 0 R >>"));
        objects.push(format!(
            "<< /Length {} >>\nstream\n{}endstream",
            stream.len(),
            stream
        ));
    }
    let mut bytes = b"%PDF-1.4\n%\xE2\xE3\xCF\xD3\n".to_vec();
    let mut offsets = vec![0usize];
    for (index, object) in objects.iter().enumerate() {
        offsets.push(bytes.len());
        bytes.extend_from_slice(format!("{} 0 obj\n{}\nendobj\n", index + 1, object).as_bytes());
    }
    let xref_offset = bytes.len();
    bytes.extend_from_slice(
        format!("xref\n0 {}\n0000000000 65535 f \n", objects.len() + 1).as_bytes(),
    );
    for offset in offsets.iter().skip(1) {
        bytes.extend_from_slice(format!("{offset:010} 00000 n \n").as_bytes());
    }
    bytes.extend_from_slice(
        format!(
            "trailer\n<< /Size {} /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF\n",
            objects.len() + 1
        )
        .as_bytes(),
    );
    bytes
}
