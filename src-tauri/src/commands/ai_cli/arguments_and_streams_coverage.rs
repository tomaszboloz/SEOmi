#[cfg(test)]
mod tests {
    use super::super::arguments::build_ai_cli_arguments;
    use super::super::streams::{bounded_process_output, read_cli_stream};
    use std::io::Cursor;
    use tokio::process::Command;

    #[test]
    fn test_build_arguments_openai() {
        let args =
            build_ai_cli_arguments("openai", "hello prompt".into(), Some("gpt-4".into())).unwrap();
        assert!(args.contains(&"exec".to_string()));
        assert!(args.contains(&"gpt-4".to_string()));
        assert!(args.contains(&"hello prompt".to_string()));

        let args_no_model = build_ai_cli_arguments("openai", "hello".into(), None).unwrap();
        assert!(args_no_model.contains(&"hello".into()));
        let args_empty_model =
            build_ai_cli_arguments("openai", "hello".into(), Some("   ".into())).unwrap();
        assert!(args_empty_model.contains(&"hello".into()));
    }

    #[test]
    fn test_build_arguments_claude() {
        let args = build_ai_cli_arguments("claude", "prompt text".into(), Some("claude-3".into()))
            .unwrap();
        assert!(args.contains(&"-p".to_string()));
        assert!(args.contains(&"claude-3".to_string()));
        assert!(args.contains(&"prompt text".to_string()));

        let args_no_model = build_ai_cli_arguments("claude", "prompt text".into(), None).unwrap();
        assert!(args_no_model.contains(&"prompt text".to_string()));
    }

    #[test]
    fn test_build_arguments_gemini() {
        let args =
            build_ai_cli_arguments("gemini", "gemini prompt".into(), Some("gemini-pro".into()))
                .unwrap();
        assert!(args.contains(&"--prompt".to_string()));
        assert!(args.contains(&"gemini-pro".to_string()));
        assert!(args.contains(&"gemini prompt".to_string()));

        let args_no_model = build_ai_cli_arguments("gemini", "gemini prompt".into(), None).unwrap();
        assert!(args_no_model.contains(&"gemini prompt".to_string()));
    }

    #[test]
    fn test_build_arguments_unsupported() {
        let res = build_ai_cli_arguments("unknown", "prompt".into(), None);
        assert!(res.is_err());
    }

    #[tokio::test]
    async fn test_read_cli_stream_ok() {
        let data = b"hello world";
        let cursor = Cursor::new(data);
        let result = read_cli_stream(cursor, 1024).await.unwrap();
        assert_eq!(result, data);
    }

    #[tokio::test]
    async fn test_read_cli_stream_overflow() {
        let data = b"hello world overflow";
        let cursor = Cursor::new(data);
        let result = read_cli_stream(cursor, 5).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_bounded_process_output() {
        let cmd = Command::new("cat");
        let output = bounded_process_output(cmd, "input prompt").await.unwrap();
        assert!(output.status.success());
        assert_eq!(String::from_utf8_lossy(&output.stdout), "input prompt");
    }
}
