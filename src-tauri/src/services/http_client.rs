pub mod entry;
pub mod fetch;
pub mod header_capture;
pub mod models;
pub mod resolver;
pub mod status;
pub mod stream;

#[cfg(test)]
mod tests_common;
#[cfg(test)]
mod tests_dns;
#[cfg(test)]
mod tests_fetch;
#[cfg(test)]
mod tests_resolver;
#[cfg(test)]
mod tests_stream;

pub use entry::{fetch_page, fetch_page_with_options};
pub use models::FetchResult;
pub use resolver::public_client_builder;
pub use status::check_url_status;
pub use stream::read_bounded_text;

#[cfg(test)]
mod tests_error_paths_extended;
#[cfg(test)]
mod tests_transport_error_paths;
