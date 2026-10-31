//! SQLite-backed storage for crawl runs, embeddings and history (issue #135).
//! Pure functions take a `&Connection`; Tauri commands live in `commands`.

#[cfg(test)]
mod atomic_tests;
#[cfg(test)]
mod command_tests;
pub mod commands;
#[cfg(test)]
#[path = "coverage100_storage_tests.rs"]
mod coverage100_storage_tests;
pub mod erase;
pub mod erase_commands;
#[cfg(test)]
mod erase_tests;
#[cfg(test)]
mod erasure_regression_tests;
pub mod event_commands;
#[cfg(test)]
mod event_migration_tests;
pub mod event_read;
pub mod events;
#[cfg(test)]
mod open_store_failure_tests;
#[cfg(test)]
mod read_consistency_tests;
pub mod records;
#[cfg(test)]
mod recovery_tests;
pub mod report;
pub mod runs;
pub mod schema;
#[cfg(test)]
mod schema_concurrency_tests;
pub mod shred;
#[cfg(test)]
mod shred_tests;
#[cfg(test)]
mod tests;
mod write;
