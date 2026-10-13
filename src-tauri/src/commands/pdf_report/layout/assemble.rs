use super::super::font::FontSet;
use super::super::font_pdf::{resource_refs, FontRefs};

pub fn stream_object(stream: &str) -> Vec<u8> {
    format!(
        "<< /Length {} >>\nstream\n{}endstream",
        stream.len(),
        stream
    )
    .into_bytes()
}

fn font_entry(resource: &str, id: Option<usize>) -> String {
    id.map(|id| format!("/{resource} {id} 0 R "))
        .unwrap_or_default()
}

fn page_object(content: usize, refs: &FontRefs, size: (f32, f32)) -> Vec<u8> {
    let fonts = format!(
        "{}{}{}",
        font_entry("F1", refs.latin),
        font_entry("F2", refs.cjk),
        font_entry("F3", refs.arabic)
    );
    format!(
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {} {}] /Resources << /Font << {fonts}>> >> /Contents {content} 0 R >>",
        size.0, size.1
    )
    .into_bytes()
}

/// Builds a complete PDF file from finished page content streams.
pub fn assemble(fonts: &FontSet, streams: &[String], size: (f32, f32)) -> Vec<u8> {
    let mut objects = vec![b"<< /Type /Catalog /Pages 2 0 R >>".to_vec(), Vec::new()];
    let refs = resource_refs(fonts, &mut objects);
    let first_page = objects.len() + 1;
    let kids = (0..streams.len())
        .map(|index| format!("{} 0 R", first_page + index * 2))
        .collect::<Vec<_>>()
        .join(" ");
    objects[1] = format!("<< /Type /Pages /Kids [{kids}] /Count {} >>", streams.len()).into_bytes();
    for stream in streams {
        let content = objects.len() + 2;
        objects.push(page_object(content, &refs, size));
        objects.push(stream_object(stream));
    }
    let mut bytes = b"%PDF-1.4\n%\xE2\xE3\xCF\xD3\n".to_vec();
    let mut offsets = Vec::new();
    for (index, object) in objects.iter().enumerate() {
        offsets.push(bytes.len());
        bytes.extend_from_slice(format!("{} 0 obj\n", index + 1).as_bytes());
        bytes.extend_from_slice(object);
        bytes.extend_from_slice(b"\nendobj\n");
    }
    let xref_offset = bytes.len();
    bytes.extend_from_slice(
        format!("xref\n0 {}\n0000000000 65535 f \n", objects.len() + 1).as_bytes(),
    );
    for offset in offsets {
        bytes.extend_from_slice(format!("{offset:010} 00000 n \n").as_bytes());
    }
    let trailer = format!(
        "trailer\n<< /Size {} /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF\n",
        objects.len() + 1
    );
    bytes.extend_from_slice(trailer.as_bytes());
    bytes
}
