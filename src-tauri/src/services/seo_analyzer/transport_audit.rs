use crate::models::audit_data::{
    Issue, IssueCategory, IssueSeverity, TransportSecurityAudit,
};
use crate::services::security_checker::{evaluate_security_headers, SecurityAuditResult};
use crate::services::seo_analyzer::transport_security::{
    assess_cookie_headers, detect_mixed_content_resources,
};
use std::collections::{BTreeMap, HashMap};
use url::Url;

pub struct TransportAuditOutput {
    pub sec_result: SecurityAuditResult,
    pub transport_security: TransportSecurityAudit,
    pub issues: Vec<Issue>,
}

pub fn audit_transport(
    headers: &HashMap<String, String>,
    set_cookie_headers: &[String],
    body: &str,
    parsed_url: &Url,
) -> TransportAuditOutput {
    let mut issues = Vec::new();
    let sec_result = evaluate_security_headers(headers);
    issues.extend(sec_result.issues.clone());

    let mixed_content_urls = detect_mixed_content_resources(body, parsed_url);
    let cookies = assess_cookie_headers(set_cookie_headers);
    let is_https = parsed_url.scheme() == "https";

    if !is_https {
        issues.push(Issue {
            severity: IssueSeverity::Warning,
            category: IssueCategory::Security,
            code: Some("transport_http".into()),
            params: Some(BTreeMap::from([(
                "scheme".into(),
                parsed_url.scheme().to_string(),
            )])),
            message: format!("Page is served over {} instead of HTTPS", parsed_url.scheme()),
            recommendation: Some(
                "Serve the page and redirect HTTP requests to HTTPS; verify the certificate in a browser or TLS scanner.".into(),
            ),
        });
    }

    if !mixed_content_urls.is_empty() {
        issues.push(Issue {
            severity: IssueSeverity::Critical,
            category: IssueCategory::Security,
            code: Some("transport_mixed_content".into()),
            params: Some(BTreeMap::from([(
                "count".into(),
                mixed_content_urls.len().to_string(),
            )])),
            message: format!(
                "{} HTTP resource(s) are embedded in this HTTPS page (mixed content)",
                mixed_content_urls.len()
            ),
            recommendation: Some(
                "Load embedded resources over HTTPS or remove them. This static check does not execute scripts or inspect CSS-generated requests.".into(),
            ),
        });
    }

    for cookie in &cookies {
        if is_https && !cookie.secure {
            issues.push(Issue {
                severity: IssueSeverity::Warning,
                category: IssueCategory::Security,
                code: Some("cookie_secure_missing".into()),
                params: Some(BTreeMap::from([("cookie".into(), cookie.name.clone())])),
                message: format!("Cookie '{}' is missing the Secure attribute", cookie.name),
                recommendation: Some(
                    "Set Secure on cookies that should only travel over HTTPS.".into(),
                ),
            });
        }
        if !cookie.http_only {
            issues.push(Issue {
                severity: IssueSeverity::Info,
                category: IssueCategory::Security,
                code: Some("cookie_httponly_missing".into()),
                params: Some(BTreeMap::from([("cookie".into(), cookie.name.clone())])),
                message: format!("Cookie '{}' is missing the HttpOnly attribute", cookie.name),
                recommendation: Some(
                    "Set HttpOnly when client-side JavaScript does not need to read this cookie."
                        .into(),
                ),
            });
        }
        if cookie.same_site.is_none() {
            issues.push(Issue {
                severity: IssueSeverity::Info,
                category: IssueCategory::Security,
                code: Some("cookie_samesite_missing".into()),
                params: Some(BTreeMap::from([("cookie".into(), cookie.name.clone())])),
                message: format!("Cookie '{}' does not declare SameSite", cookie.name),
                recommendation: Some(
                    "Choose an explicit SameSite policy appropriate to the cookie's purpose."
                        .into(),
                ),
            });
        }
    }

    TransportAuditOutput {
        sec_result,
        transport_security: TransportSecurityAudit {
            scheme: parsed_url.scheme().to_string(),
            https: is_https,
            mixed_content_urls,
            cookies,
            tls_coverage:
                "certificate chain, hostname validation details and negotiated TLS version are not exposed by this HTTP audit"
                    .into(),
        },
        issues,
    }
}
