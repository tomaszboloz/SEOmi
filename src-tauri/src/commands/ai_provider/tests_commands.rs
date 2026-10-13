use super::{ai_generate_suggestions, ai_generate_text, ai_list_models, ai_test_connection};

const UNSUPPORTED: &str = "Unsupported AI provider.";

#[tokio::test]
async fn generate_commands_reject_unsupported_providers() {
    let text = ai_generate_text("none".into(), "m".into(), "p".into()).await;
    assert_eq!(text.unwrap_err(), UNSUPPORTED);
    let suggestions = ai_generate_suggestions("none".into(), "m".into(), "p".into()).await;
    assert_eq!(suggestions.unwrap_err(), UNSUPPORTED);
}

#[tokio::test]
async fn list_and_test_commands_reject_unsupported_providers() {
    assert_eq!(
        ai_list_models("none".into()).await.unwrap_err(),
        UNSUPPORTED
    );
    assert_eq!(
        ai_test_connection("none".into()).await.unwrap_err(),
        UNSUPPORTED
    );
}
