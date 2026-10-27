use super::*;

fn hex(fonts: &mut FontSet, text: &str) -> String {
    fonts.encode(text).into_iter().map(|run| run.hex).collect()
}

#[test]
fn multiword_arabic_is_drawn_right_to_left_but_extracts_in_logical_order() {
    let mut fonts = FontSet::new();
    let (first, second) = ("مرحبا", "بالعالم");
    let first_hex = hex(&mut fonts, first);
    let second_hex = hex(&mut fonts, second);
    let space = hex(&mut fonts, " ");
    let line = format!("{first} {second}");
    assert_eq!(
        hex(&mut fonts, &line),
        format!("{second_hex}{space}{first_hex}")
    );
    let runs = fonts.encode(&line);
    assert_eq!(runs[0].actual_text.as_deref(), Some(line.as_str()));
    assert!(runs[1..]
        .iter()
        .all(|run| run.actual_text.as_deref() == Some("")));
}

#[test]
fn latin_and_digits_keep_their_order_inside_right_to_left_text() {
    let mut fonts = FontSet::new();
    let arabic = hex(&mut fonts, "مرحبا");
    let latin = hex(&mut fonts, "ab12");
    let space = hex(&mut fonts, " ");
    assert_eq!(
        hex(&mut fonts, "مرحبا ab12"),
        format!("{latin}{space}{arabic}")
    );
    assert_eq!(
        hex(&mut fonts, "ab12 مرحبا"),
        format!("{latin}{space}{arabic}")
    );
}

#[test]
fn text_without_arabic_is_unchanged() {
    let mut fonts = FontSet::new();
    let runs = fonts.encode("Zażółć 12");
    assert_eq!(
        runs.iter()
            .filter_map(|run| run.actual_text.clone())
            .collect::<String>(),
        "Zażółć 12"
    );
}
