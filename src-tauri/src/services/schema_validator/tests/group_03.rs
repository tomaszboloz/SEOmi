use super::*;
use serde_json::json;

#[test]
fn validates_additional_event_recipe_video_review_and_entity_profiles() {
    let issues = validate_jsonld(&json!({
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "Event",
                "name": 7,
                "startDate": [],
                "location": 42,
                "eventStatus": " "
            },
            {
                "@type": "Recipe",
                "name": " ",
                "image": 7,
                "author": 4,
                "prepTime": 2
            },
            {
                "@type": "VideoObject",
                "name": "Video",
                "thumbnailUrl": false,
                "uploadDate": 4,
                "contentUrl": " "
            },
            {
                "@type": "Review",
                "reviewBody": " ",
                "author": 8,
                "reviewRating": false
            },
            {
                "@type": "Offer",
                "price": [],
                "priceCurrency": " ",
                "availability": 4,
                "url": false
            },
            { "@type": "Person", "name": 8, "url": false },
            { "@type": "ImageObject", "contentUrl": 8, "caption": false }
        ]
    }));

    for code in [
        "event-name-empty-or-invalid",
        "event-start-date-empty-or-invalid",
        "event-location-shape-invalid",
        "event-status-empty-or-invalid",
        "recipe-name-empty-or-invalid",
        "recipe-image-shape-invalid",
        "recipe-author-shape-invalid",
        "recipe-prep-time-invalid",
        "video-thumbnail-shape-invalid",
        "video-upload-date-empty-or-invalid",
        "video-content-url-empty-or-invalid",
        "review-body-empty-or-invalid",
        "review-author-shape-invalid",
        "review-rating-shape-invalid",
        "offer-price-shape-invalid",
        "offer-currency-empty-or-invalid",
        "offer-availability-empty-or-invalid",
        "offer-url-empty-or-invalid",
        "person-name-empty-or-invalid",
        "person-url-empty-or-invalid",
        "image-content-url-empty-or-invalid",
        "image-caption-empty-or-invalid",
    ] {
        assert!(
            issues.iter().any(|item| item.code == code),
            "expected {code}"
        );
    }
}

#[test]
fn accepts_well_shaped_additional_schema_profiles() {
    let issues = validate_jsonld(&json!({
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "Event",
                "name": "Conference",
                "startDate": "2026-10-01",
                "location": { "@type": "Place", "name": "Hall" },
                "eventStatus": "https://schema.org/EventScheduled"
            },
            {
                "@type": "Recipe",
                "name": "Soup",
                "image": ["https://example.test/soup.jpg"],
                "author": { "@type": "Person", "name": "Chef" },
                "prepTime": "PT10M",
                "cookTime": "PT20M",
                "totalTime": "PT30M"
            },
            {
                "@type": "VideoObject",
                "name": "Demo",
                "thumbnailUrl": "https://example.test/thumb.jpg",
                "uploadDate": "2026-09-24",
                "contentUrl": "https://example.test/demo.mp4"
            },
            {
                "@type": "Review",
                "reviewBody": "Useful",
                "author": { "@type": "Person", "name": "Reviewer" },
                "reviewRating": { "@type": "Rating", "ratingValue": 5 }
            },
            {
                "@type": "Offer",
                "price": 10,
                "priceCurrency": "USD",
                "availability": "https://schema.org/InStock",
                "url": "https://example.test/buy"
            },
            { "@type": "Person", "name": "Author", "url": "https://example.test/author" },
            {
                "@type": "ImageObject",
                "contentUrl": "https://example.test/image.jpg",
                "caption": "Example"
            }
        ]
    }));

    assert!(!issues
        .iter()
        .any(|item| item.severity == "error" || item.severity == "warning"));
}
