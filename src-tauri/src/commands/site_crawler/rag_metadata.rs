use scraper::ElementRef;

pub(super) const MAX_LIST_ITEMS: usize = 256;

pub(super) fn flat_text(element: &ElementRef<'_>) -> String {
    element
        .text()
        .collect::<Vec<_>>()
        .join(" ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

pub(super) fn inside_table_or_item(element: &ElementRef<'_>) -> bool {
    element
        .ancestors()
        .filter_map(ElementRef::wrap)
        .any(|a| matches!(a.value().name(), "table" | "li"))
}

pub(super) fn table_has_headers(table: &ElementRef<'_>) -> bool {
    table
        .descendent_elements()
        .any(|element| matches!(element.value().name(), "thead" | "th"))
}

fn instruction_text(text: &str) -> bool {
    let text = text.trim().to_ascii_lowercase();
    text.ends_with(':')
        || [
            "step",
            "steps",
            "instruction",
            "instructions",
            "procedure",
            "recipe",
            "how to",
            "krok",
            "kroki",
            "instrukcj",
            "procedur",
            "przepis",
        ]
        .iter()
        .any(|term| text.contains(term))
}

fn previous_element<'a>(element: &ElementRef<'a>) -> Option<ElementRef<'a>> {
    element.prev_siblings().filter_map(ElementRef::wrap).next()
}

pub(super) fn has_instruction_context(list: &ElementRef<'_>) -> bool {
    if list.attr("aria-label").is_some_and(instruction_text) {
        return true;
    }
    previous_element(list).is_some_and(|previous| {
        matches!(previous.value().name(), "p" | "h1" | "h2" | "h3")
            && instruction_text(&flat_text(&previous))
    })
}

pub(super) fn direct_item_word_counts(list: &ElementRef<'_>) -> Result<Vec<u16>, ()> {
    let item_name = if list.value().name() == "ul" {
        "li"
    } else {
        "dd"
    };
    let mut counts = Vec::new();
    for item in list
        .child_elements()
        .filter(|item| item.value().name() == item_name)
    {
        if counts.len() >= MAX_LIST_ITEMS {
            return Err(());
        }
        if let Some(count) = {
            let text = flat_text(&item);
            (!text.is_empty())
                .then(|| text.split_whitespace().count().min(u16::MAX as usize) as u16)
        } {
            counts.push(count);
        }
    }
    Ok(counts)
}
