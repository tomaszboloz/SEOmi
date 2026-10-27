use reqwest::Client;

/// Map a failed Google metrics client build to the caller-supplied message.
pub(super) fn google_client(
    built: reqwest::Result<Client>,
    failure: &str,
) -> Result<Client, String> {
    built.map_err(|_| failure.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_failed_build_reports_the_caller_supplied_failure() {
        let failed = Err(Client::new().get("not a url").build().unwrap_err());
        assert_eq!(
            google_client(failed, "Unable to initialize the test client.").unwrap_err(),
            "Unable to initialize the test client."
        );
        assert!(google_client(Client::builder().build(), "unused").is_ok());
    }
}
