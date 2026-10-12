/// Available predefined User Agent profiles
pub const UA_CHROME_MAC: &str = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36";
pub const UA_CHROME_WIN: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36";
pub const UA_SAFARI_MAC: &str = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Safari/605.1.15";
pub const UA_GOOGLEBOT_DESKTOP: &str =
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
pub const UA_GOOGLEBOT_MOBILE: &str = "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.6943.53 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
pub const UA_BINGBOT: &str =
    "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)";
pub const UA_IPHONE: &str = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Mobile/15E148 Safari/604.1";

/// Resolves a user agent preset key or sanitizes a custom user agent string.
/// Protects against HTTP response splitting and header injection attacks.
pub fn resolve_user_agent(ua_identifier_or_custom: Option<&str>) -> String {
    let raw = match ua_identifier_or_custom {
        Some("chrome_mac") => UA_CHROME_MAC,
        Some("chrome_win") => UA_CHROME_WIN,
        Some("safari_mac") => UA_SAFARI_MAC,
        Some("googlebot_desktop") => UA_GOOGLEBOT_DESKTOP,
        Some("googlebot_mobile") => UA_GOOGLEBOT_MOBILE,
        Some("bingbot") => UA_BINGBOT,
        Some("iphone") => UA_IPHONE,
        Some(custom) if !custom.trim().is_empty() => custom.trim(),
        _ => UA_CHROME_MAC,
    };

    // Sanitize to prevent CRLF injection in HTTP headers
    raw.chars()
        .filter(|c| *c != '\r' && *c != '\n')
        .collect::<String>()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_user_agent() {
        let ua = resolve_user_agent(None);
        assert_eq!(ua, UA_CHROME_MAC);
    }

    #[test]
    fn test_googlebot_presets() {
        assert_eq!(
            resolve_user_agent(Some("googlebot_desktop")),
            UA_GOOGLEBOT_DESKTOP
        );
        assert_eq!(
            resolve_user_agent(Some("googlebot_mobile")),
            UA_GOOGLEBOT_MOBILE
        );
    }

    #[test]
    fn test_bingbot_preset() {
        assert_eq!(resolve_user_agent(Some("bingbot")), UA_BINGBOT);
    }

    #[test]
    fn test_custom_user_agent() {
        let custom = "MyCustomCrawler/1.0 (+https://example.com)";
        assert_eq!(resolve_user_agent(Some(custom)), custom);
    }

    #[test]
    fn test_crlf_injection_sanitization() {
        let malicious = "Googlebot\r\nX-Injected-Header: evil\nAnother-Line";
        let cleaned = resolve_user_agent(Some(malicious));
        assert!(!cleaned.contains('\r'));
        assert!(!cleaned.contains('\n'));
        assert_eq!(cleaned, "GooglebotX-Injected-Header: evilAnother-Line");
    }
}

#[cfg(test)]
#[path = "user_agents_branch_tests.rs"]
mod branch_tests;
