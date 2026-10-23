//! SQLite-backed storage for crawl runs, embeddings and history (issue #135).
//! Pure functions take a `&Connection`; Tauri commands live in `commands`.

#[cfg(test)]
mod command_tests;
pub mod commands;
pub mod records;
pub mod runs;
pub mod schema;
#[cfg(test)]
mod tests;
