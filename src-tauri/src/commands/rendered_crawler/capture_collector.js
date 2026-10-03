    let largestContentfulPaintMs = null;
    let interactionToNextPaintMs = null;
    const layoutShiftEntries = [];
    const observers = [];
    const observe = (type, callback, options = {}) => {
      if (typeof PerformanceObserver !== 'function') return;
      try {
        const observer = new PerformanceObserver((list) => callback(list.getEntries()));
        observer.observe({ type, buffered: true, ...options });
        observers.push(observer);
      } catch (_) {}
    };
    observe('largest-contentful-paint', (entries) => {
      for (const entry of entries) {
        if (Number.isFinite(entry.startTime)) largestContentfulPaintMs = Math.max(largestContentfulPaintMs || 0, entry.startTime);
      }
    });
    observe('layout-shift', (entries) => {
      for (const entry of entries) {
        if (!entry.hadRecentInput && Number.isFinite(entry.value) && Number.isFinite(entry.startTime)) layoutShiftEntries.push({ startTime: entry.startTime, value: entry.value });
      }
    });
    observe('event', (entries) => {
      for (const entry of entries) {
        if (entry.name !== 'pointerdown' && entry.name !== 'click' && entry.name !== 'keydown') continue;
        if (Number.isFinite(entry.duration)) interactionToNextPaintMs = Math.max(interactionToNextPaintMs || 0, entry.duration);
      }
    }, { durationThreshold: 16 });
    await wait(50);
    let clsValue = null;
    if (layoutShiftEntries.length) {
      let sessionValue = 0;
      let sessionStart = 0;
      let previousTime = 0;
      for (const entry of layoutShiftEntries) {
        if (sessionValue === 0 || entry.startTime - previousTime > 1000 || entry.startTime - sessionStart > 5000) {
          sessionValue = entry.value;
          sessionStart = entry.startTime;
        } else {
          sessionValue += entry.value;
        }
        previousTime = entry.startTime;
        clsValue = Math.max(clsValue || 0, sessionValue);
      }
    }
    const navigation = performance.getEntriesByType('navigation')[0];
    const page = {
      page_url: location.href,
      http_status: navigation && navigation.responseStatus > 0 ? navigation.responseStatus : null,
      content_type: document.contentType || 'text/html',
      charset: document.characterSet || 'UTF-8',
      html: document.documentElement ? document.documentElement.outerHTML.slice(0, __MAX_CAPTURE_HTML_CHARS__) : '',
      html_truncated: Boolean(document.documentElement && document.documentElement.outerHTML.length > __MAX_CAPTURE_HTML_CHARS__),
      navigation_time_ms: navigation && navigation.duration ? Math.round(navigation.duration) : null,
      lcp_ms: Number.isFinite(largestContentfulPaintMs) ? Math.round(largestContentfulPaintMs) : null,
      inp_ms: Number.isFinite(interactionToNextPaintMs) ? Math.round(interactionToNextPaintMs) : null,
      cls: Number.isFinite(clsValue) ? clsValue : null,
      failed_resource_urls: Array.from(new Set(failedResourceUrls)).slice(0, 500),
      console_errors: Array.from(new Set(consoleErrors)).slice(0, 100),
    };
    for (const observer of observers) observer.disconnect();
    window.removeEventListener('error', onError, true);
    if (originalConsoleError && typeof console !== 'undefined') {
      try { console.error = originalConsoleError; } catch (_) {}
    }
    const encoded = (() => {
      const bytes = new TextEncoder().encode(JSON.stringify(page));
      let binary = '';
      for (let start = 0; start < bytes.length; start += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(start, Math.min(start + 0x8000, bytes.length)));
      }
      return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    })();
    __TRANSPORT__
    await sendCaptureChunks(encoded, nonce, sequence, __MAX_CAPTURE_CHUNK_BYTES__, __MAX_CAPTURE_CHUNKS__);
  })().catch(() => {
    location.href = 'seomi-capture://' + nonce + '/' + sequence + '/error';
  });
