mod account;
mod admin;
pub mod commands;
#[cfg(test)]
mod commands_ipc_tests;
#[cfg(test)]
mod commands_tests;
mod mapping;
mod models;
mod provider_models;
mod report;
pub mod revenue;
mod revenue_model;
mod streams;
mod transport;
mod validation;

pub(crate) use models::{Ga4Snapshot, Ga4Status};

#[allow(clippy::too_many_arguments)]
pub(crate) async fn collect_at(
    client: &reqwest::Client,
    access_token: &str,
    site_url: &str,
    start: &str,
    end: &str,
    account_endpoint: &str,
    admin_base: &str,
    data_base: &str,
) -> Result<Ga4Snapshot, String> {
    let (start, end) = validation::date_range(start, end)?;
    let discovery =
        admin::discover_at(client, access_token, site_url, account_endpoint, admin_base).await?;
    let report = match discovery.property.as_ref() {
        Some(property) => Some(
            report::run_at(
                client,
                access_token,
                &property.name,
                site_url,
                &property.selected_host_name,
                &start,
                &end,
                data_base,
            )
            .await?,
        ),
        None => None,
    };
    let status = match report.as_ref().map(|report| &report.status) {
        Some(Ga4Status::Partial) => Ga4Status::Partial,
        Some(Ga4Status::Missing) => Ga4Status::Missing,
        Some(Ga4Status::Complete) if discovery.status == Ga4Status::Complete => Ga4Status::Complete,
        Some(Ga4Status::Complete) => Ga4Status::Partial,
        None => discovery.status.clone(),
    };
    Ok(Ga4Snapshot {
        status,
        start_date: start,
        end_date: end,
        discovery,
        report,
    })
}

#[cfg(test)]
mod tests;
