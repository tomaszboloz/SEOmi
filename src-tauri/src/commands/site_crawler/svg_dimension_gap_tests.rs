use super::svg_intrinsic_dimensions;

#[test]
fn svg_without_size_or_view_box_has_no_intrinsic_dimensions() {
    assert_eq!(svg_intrinsic_dimensions(b"<svg></svg>"), None);
    assert_eq!(
        svg_intrinsic_dimensions(b"<svg viewBox='0 0 30 40'></svg>"),
        Some((30, 40))
    );
}
