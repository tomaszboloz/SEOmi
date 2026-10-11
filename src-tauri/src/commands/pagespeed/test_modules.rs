#[cfg(test)]
#[path = "image_tests.rs"]
mod image_tests;
#[cfg(test)]
#[path = "mapping_tests.rs"]
mod mapping_tests;
#[cfg(test)]
#[path = "touch_tests.rs"]
mod touch_tests;
#[cfg(test)]
#[path = "transport_tests.rs"]
mod transport_tests;
#[cfg(test)]
#[path = "validation_tests.rs"]
mod validation_tests;
#[cfg(test)]
include!("command_request_tests.rs");
#[cfg(test)]
#[path = "command_tests.rs"]
mod command_tests;
#[cfg(test)]
#[path = "metric_tests.rs"]
mod metric_tests;

#[cfg(test)]
#[path = "coverage_boundary_tests.rs"]
mod coverage_boundary_tests;
