//! Small page layout engine: A4 pages with a header band and footer,
//! text, rules, tables and cards that paginate across pages.

pub mod assemble;
pub mod card;
pub mod color;
pub mod doc;
pub mod draw;
pub mod table;
mod table_rtl;
pub mod text;
pub mod widgets;

#[cfg(test)]
mod tests_card;
#[cfg(test)]
mod tests_doc;
#[cfg(test)]
mod tests_table;
#[cfg(test)]
mod tests_table_rtl;
#[cfg(test)]
mod tests_widgets;
