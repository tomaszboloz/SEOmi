//! Small page layout engine: A4 pages with a header band and footer,
//! text, rules, tables and cards that paginate across pages.

pub mod assemble;
pub mod card;
pub mod color;
pub mod doc;
pub mod draw;
pub mod table;
pub mod text;

#[cfg(test)]
mod tests_card;
#[cfg(test)]
mod tests_doc;
#[cfg(test)]
mod tests_table;
