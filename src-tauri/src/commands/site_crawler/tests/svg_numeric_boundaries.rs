use super::*;

#[test]
fn dimensions_never_report_zero_or_saturated_machine_limits() {
    for token in ["0.1", "0.49", "1e40", "NaN", "inf", "-inf", "-2"] {
        assert!(parse_dimension_token(token).is_none(), "{token}");
        assert!(svg_numeric_dimension(token).is_none(), "{token}");
    }
    assert_eq!(parse_dimension_token("1.9"), Some(1));
    assert_eq!(svg_numeric_dimension("1.9"), Some(2));
    assert_eq!(svg_numeric_dimension("0.6"), Some(1));
    assert!(parse_dimension_token("0.6").is_none());
}

#[test]
fn both_svg_paths_reject_corrupt_or_non_finite_viewboxes() {
    for viewbox in [
        "junk 0 0 100 50",
        "0 0 100 50 junk",
        "0 0 100 50 60",
        "NaN 0 100 50",
        "0 inf 100 50",
        "0 0 inf 50",
        "0 0 100 inf",
        "0 0 0.1 50",
        "0 0 100 0.1",
        "0 0 1e40 50",
        "0 0 100 1e40",
    ] {
        let svg = format!("<svg viewBox=\"{viewbox}\"></svg>");
        assert!(
            svg_intrinsic_dimensions(svg.as_bytes()).is_none(),
            "{viewbox}"
        );
        assert!(
            svg_inline_dimensions(&format!("data:image/svg+xml,{svg}")).is_none(),
            "{viewbox}"
        );
    }
}

#[test]
fn whitespace_comma_separators_and_negative_origins_preserve_valid_dimensions() {
    for viewbox in ["-10 -20 100 50", "0, 0, 100, 50", "0\t0\n100  50"] {
        let svg = format!("<svg viewBox=\"{viewbox}\"></svg>");
        assert_eq!(svg_intrinsic_dimensions(svg.as_bytes()), Some((100, 50)));
        assert_eq!(
            svg_inline_dimensions(&format!("data:image/svg+xml,{svg}")),
            Some((100, 50))
        );
    }
}

#[test]
fn invalid_explicit_dimensions_fall_back_to_valid_viewbox() {
    for (width, height) in [
        ("0.1", "50"),
        ("100", "0.1"),
        ("1e40", "50"),
        ("100", "1e40"),
    ] {
        let svg =
            format!("<svg width=\"{width}\" height=\"{height}\" viewBox=\"0 0 120 60\"></svg>");
        assert_eq!(svg_intrinsic_dimensions(svg.as_bytes()), Some((120, 60)));
        assert_eq!(
            svg_inline_dimensions(&format!("data:image/svg+xml,{svg}")),
            Some((120, 60))
        );
    }
}
