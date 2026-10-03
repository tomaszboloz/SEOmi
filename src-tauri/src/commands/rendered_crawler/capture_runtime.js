  const nonce = __NONCE__;
  const sequence = __SEQUENCE__;
  const waitSelector = __WAIT_SELECTOR__;
  const waitDelayMs = __WAIT_DELAY_MS__;
  const scrollCycles = __SCROLL_CYCLES__;
  const scrollPauseMs = 250;
  if (window.__seomiCaptureSequence === sequence) return;
  window.__seomiCaptureSequence = sequence;
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const waitForNetworkIdle = async () => {
    if (typeof PerformanceObserver !== 'function') return;
    let lastResourceActivity = Date.now();
    let observer = null;
    try {
      observer = new PerformanceObserver((list) => {
        if (list.getEntries().length) lastResourceActivity = Date.now();
      });
      observer.observe({ type: 'resource', buffered: true });
    } catch (_) {
      return;
    }
    const deadline = Date.now() + __NETWORK_IDLE_MAX_WAIT_MS__;
    while (Date.now() < deadline && Date.now() - lastResourceActivity < __NETWORK_IDLE_QUIET_MS__) {
      await wait(__NETWORK_IDLE_POLL_MS__);
    }
    observer.disconnect();
  };
  const waitForDomIdle = async () => {
    if (typeof MutationObserver !== 'function' || !document.documentElement) return;
    let lastMutation = Date.now();
    const observer = new MutationObserver(() => { lastMutation = Date.now(); });
    try {
      observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, characterData: true });
    } catch (_) {
      observer.disconnect();
      return;
    }
    const deadline = Date.now() + __DOM_IDLE_MAX_WAIT_MS__;
    while (Date.now() < deadline && Date.now() - lastMutation < __DOM_IDLE_QUIET_MS__) {
      await wait(__NETWORK_IDLE_POLL_MS__);
    }
    observer.disconnect();
  };
  (async () => {
    const consoleErrors = [];
    const failedResourceUrls = [];
    const originalConsoleError = typeof console !== 'undefined' && typeof console.error === 'function'
      ? console.error.bind(console)
      : null;
    const onConsoleError = (...args) => {
      const message = args.map((value) => {
        try { return typeof value === 'string' ? value : JSON.stringify(value); } catch (_) { return String(value); }
      }).join(' ').slice(0, 512);
      if (message) consoleErrors.push(message);
    };
    if (originalConsoleError && typeof console !== 'undefined') {
      try {
        console.error = (...args) => {
          onConsoleError(...args);
          try { originalConsoleError(...args); } catch (_) {}
        };
      } catch (_) {}
    }
    const onError = (event) => {
      const target = event.target;
      if (target && target !== window && (target.src || target.href)) {
        failedResourceUrls.push(String(target.src || target.href).slice(0, 2048));
      } else if (event.message) {
        consoleErrors.push(String(event.message).slice(0, 512));
      }
    };
    window.addEventListener('error', onError, true);
    window.addEventListener('unhandledrejection', (event) => {
      consoleErrors.push(String(event.reason || 'unhandled promise rejection').slice(0, 512));
    });
    if (waitSelector) {
      const waitUntil = Date.now() + 8000;
      while (Date.now() < waitUntil) {
        try { if (document.querySelector(waitSelector)) break; } catch (_) { break; }
        await wait(100);
      }
    }
    if (waitDelayMs) await wait(waitDelayMs);
    await waitForNetworkIdle();
    await waitForDomIdle();
    if (scrollCycles > 0) {
      let mutationCount = 0;
      const observer = typeof MutationObserver === 'function'
        ? new MutationObserver(() => { mutationCount += 1; })
        : null;
      if (observer) observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, characterData: true });
      let stableScrollCycles = 0;
      for (let index = 0; index < scrollCycles; index += 1) {
        const previousHeight = document.documentElement ? document.documentElement.scrollHeight : document.body.scrollHeight;
        const previousMutationCount = mutationCount;
        window.scrollTo(0, previousHeight);
        await wait(scrollPauseMs);
        const currentHeight = document.documentElement ? document.documentElement.scrollHeight : document.body.scrollHeight;
        if (observer && currentHeight <= previousHeight && mutationCount === previousMutationCount) {
          stableScrollCycles += 1;
          if (stableScrollCycles >= 3) break;
        } else {
          stableScrollCycles = 0;
        }
      }
      observer?.disconnect();
      await waitForNetworkIdle();
      await waitForDomIdle();
    }
    window.scrollTo(0, 0);
