pub(crate) struct RenderRequestScope<'a> {
    pub(crate) base_host: &'a str,
    pub(crate) max_redirects: usize,
    pub(crate) retry_context: super::super::retry::RetryContext,
}

impl<'a> RenderRequestScope<'a> {
    pub(crate) fn new(base_host: &'a str, max_redirects: usize) -> Self {
        Self {
            base_host,
            max_redirects,
            retry_context: super::super::retry::RetryContext::disabled(),
        }
    }

    pub(crate) fn with_retry_context(
        mut self,
        retry_context: super::super::retry::RetryContext,
    ) -> Self {
        self.retry_context = retry_context;
        self
    }
}
