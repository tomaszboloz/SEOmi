use super::font::{FontKind, FontSet};

pub struct FontRefs {
    pub latin: Option<usize>,
    pub cjk: Option<usize>,
    pub arabic: Option<usize>,
}

fn font_name(kind: FontKind) -> &'static str {
    match kind {
        FontKind::Latin => "NotoSansRegular",
        FontKind::Cjk => "NotoSansCJKscRegular",
        FontKind::Arabic => "NotoSansArabicRegular",
    }
}

fn cmap_hex(character: &str) -> String {
    character
        .encode_utf16()
        .map(|unit| format!("{unit:04X}"))
        .collect()
}

fn unicode_map(fonts: &FontSet, kind: FontKind) -> Vec<u8> {
    let mappings = fonts.mappings(kind);
    let mut cmap = String::from("/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n");
    cmap.push_str("/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n");
    cmap.push_str("/CMapName /NotoSans-UCS def\n/CMapType 2 def\n");
    cmap.push_str("1 begincodespacerange\n<0000><FFFF>\nendcodespacerange\n");
    for chunk in mappings.chunks(100) {
        cmap.push_str(&format!("{} beginbfchar\n", chunk.len()));
        for (glyph, character) in chunk {
            cmap.push_str(&format!("<{glyph:04X}><{}>\n", cmap_hex(character)));
        }
        cmap.push_str("endbfchar\n");
    }
    cmap.push_str("endcmap\nCMapName currentdict /CMap defineresource pop\nend\nend");
    cmap.into_bytes()
}

fn font_file(fonts: &FontSet, kind: FontKind) -> Vec<u8> {
    let bytes = fonts.bytes(kind);
    let subtype = if kind == FontKind::Cjk {
        "/Subtype /OpenType"
    } else {
        ""
    };
    let header = if kind == FontKind::Cjk {
        format!("<< /Length {} {} >>\nstream\n", bytes.len(), subtype)
    } else {
        format!(
            "<< /Length {} /Length1 {} >>\nstream\n",
            bytes.len(),
            bytes.len()
        )
    };
    let mut object = header.into_bytes();
    object.extend_from_slice(bytes);
    object.extend_from_slice(b"\nendstream");
    object
}

fn widths(fonts: &FontSet, kind: FontKind) -> String {
    let mut value = String::new();
    for (glyph, width) in fonts.widths(kind) {
        let _ = std::fmt::Write::write_fmt(&mut value, format_args!("{glyph} [{width}] "));
    }
    value
}

pub fn append_font_objects(objects: &mut Vec<Vec<u8>>, fonts: &FontSet, kind: FontKind) -> usize {
    let base = objects.len() + 1;
    let descriptor = base + 1;
    let cid = base + 2;
    let cmap = base + 3;
    let name = font_name(kind);
    let file_key = if kind == FontKind::Cjk {
        "/FontFile3"
    } else {
        "/FontFile2"
    };
    let metrics = fonts.face_metrics(kind).unwrap_or((
        800,
        -200,
        ttf_parser::Rect {
            x_min: -100,
            y_min: -300,
            x_max: 1100,
            y_max: 1000,
        },
    ));
    objects.push(font_file(fonts, kind));
    objects.push(format!("<< /Type /FontDescriptor /FontName /{name} /Flags 4 /FontBBox [{} {} {} {}] /ItalicAngle 0 /Ascent {} /Descent {} /CapHeight 700 /StemV 80 {file_key} {base} 0 R >>", metrics.2.x_min, metrics.2.y_min, metrics.2.x_max, metrics.2.y_max, metrics.0, metrics.1).into_bytes());
    objects.push(format!("<< /Type /Font /Subtype {} /BaseFont /{name} /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor {descriptor} 0 R /DW 600 /W [{}]{} >>", if kind == FontKind::Cjk { "/CIDFontType0" } else { "/CIDFontType2" }, widths(fonts, kind), if kind == FontKind::Cjk { "" } else { " /CIDToGIDMap /Identity" }).into_bytes());
    objects.push(
        format!(
            "<< /Length {} >>\nstream\n{}\nendstream",
            unicode_map(fonts, kind).len(),
            String::from_utf8_lossy(&unicode_map(fonts, kind))
        )
        .into_bytes(),
    );
    objects.push(format!("<< /Type /Font /Subtype /Type0 /BaseFont /{name} /Encoding /Identity-H /DescendantFonts [{cid} 0 R] /ToUnicode {cmap} 0 R >>").into_bytes());
    base + 4
}

pub fn resource_refs(fonts: &FontSet, objects: &mut Vec<Vec<u8>>) -> FontRefs {
    let latin = fonts
        .used(FontKind::Latin)
        .then(|| append_font_objects(objects, fonts, FontKind::Latin));
    let cjk = fonts
        .used(FontKind::Cjk)
        .then(|| append_font_objects(objects, fonts, FontKind::Cjk));
    let arabic = fonts
        .used(FontKind::Arabic)
        .then(|| append_font_objects(objects, fonts, FontKind::Arabic));
    FontRefs { latin, cjk, arabic }
}
