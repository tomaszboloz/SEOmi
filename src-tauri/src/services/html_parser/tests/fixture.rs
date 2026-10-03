pub(super) const SAMPLE_HTML: &str = r#"
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Fast SEO Auditor for Developers | SEOmi</title>
    <meta name="description" content="A blazingly fast native desktop SEO tool built with Rust and React.">
    <meta name="keywords" content="seo, desktop, rust, audit">
    <meta name="robots" content="index, follow">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="author" content="SEOmi Team">
    <link rel="canonical" href="https://example.com/seomi">
    <link rel="icon" href="/assets/favicon.ico">
    <link rel="alternate" hreflang="pl" href="/pl/seomi">
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "SEOmi",
      "applicationCategory": "DeveloperApplication"
    }
    </script>
  </head>
  <body>
    <h1>SEOmi Desktop Auditor</h1>
    <p>SEOmi provides comprehensive SEO analysis and performance tracking.</p>
    <p>Audit your links, headings, and security headers with ease.</p>
  </body>
</html>
"#;
