// Optional online renderer checks for the desktop E2E harness.
// This file is intentionally separate until the native harness opts in.
(() => {
  const target = (typeof window !== 'undefined' && window.__seomiE2eFixtureUrl) || 'https://example.com/';
  const baseArgs = {
    url: target,
    allowSubdomains: false,
    scopePath: null,
    waitForSelector: 'body',
    waitDelayMs: 0,
    lazyScrollCycles: 0,
  };
  const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
  const pdfSignature = [37, 80, 68, 70, 45];
  const artifactContracts = {
    screenshot: { contentType: 'image/png', extension: 'png', signature: pngSignature },
    pdf: { contentType: 'application/pdf', extension: 'pdf', signature: pdfSignature },
  };
  const expectedRunId = 'desktop-e2e-renderer';
  const supportedPlatforms = ['macos-wkwebview', 'windows-webview2'];

  const decode = value => {
    if (typeof value !== 'string' || typeof atob !== 'function') return null;
    try {
      return Uint8Array.from(atob(value), character => character.charCodeAt(0));
    } catch (_) {
      return null;
    }
  };
  const startsWith = (bytes, sig) => bytes?.length >= sig.length && sig.every((v, i) => bytes[i] === v);
  const artifactArgs = kind => ({ ...baseArgs, kind, runId: expectedRunId });
  const artifactFileName = (k, ext) => new RegExp(`^rendered-page-[0-9]{8}T[0-9]{6}Z-${k}\\.${ext}$`);
  const checkArtifact = (kind, artifact, check) => {
    const contract = artifactContracts[kind];
    const bytes = decode(artifact?.dataBase64);
    check(`${kind} artifact kind is exact`, artifact?.artifactType === kind);
    check(`${kind} artifact requested URL is exact`, artifact?.requestedUrl === target);
    check(`${kind} artifact final URL is exact`, artifact?.finalUrl === target);
    check(`${kind} artifact run ID is exact`, artifact?.runId === expectedRunId);
    check(`${kind} artifact capture timestamp is valid`, typeof artifact?.capturedAt === 'string' && Number.isFinite(Date.parse(artifact.capturedAt)));
    check(`${kind} artifact content type is exact`, artifact?.contentType === contract.contentType);
    check(`${kind} artifact filename is exact`, typeof artifact?.fileName === 'string' && artifactFileName(kind, contract.extension).test(artifact.fileName));
    check(`${kind} artifact bytes field is positive`, Number.isInteger(artifact?.bytes) && artifact.bytes > 0);
    check(`${kind} artifact renderer platform is supported`, supportedPlatforms.includes(artifact?.rendererPlatform));
    check(`${kind} artifact signature is valid`, startsWith(bytes, contract.signature));
    check(`${kind} artifact byte count is exact`, bytes?.length === artifact?.bytes);
  };
  const statusEvidence = snapshot => {
    const present = snapshot !== null && typeof snapshot === 'object'
      && Object.prototype.hasOwnProperty.call(snapshot, 'httpStatus');
    const httpStatus = present ? snapshot.httpStatus : undefined;
    const reason = !present ? 'Snapshot omitted httpStatus.'
      : httpStatus === undefined ? 'Snapshot exposed an undefined httpStatus.'
      : httpStatus === null ? 'Navigation Timing responseStatus is unavailable in this WebKit runtime.'
      : httpStatus === 200 ? null : `Unexpected renderer HTTP status: ${String(httpStatus)}.`;
    return {
      httpStatus: httpStatus === undefined ? null : httpStatus,
      observedHttpStatus: httpStatus === undefined ? 'undefined' : httpStatus,
      httpStatusAvailable: Number.isInteger(httpStatus) && httpStatus > 0,
      httpStatusReason: reason,
      httpStatusFieldPresent: present,
    };
  };
  const failureDiagnostics = (snapshot, html) => {
    const rawHtml = typeof html === 'string' ? html : (typeof snapshot?.html === 'string' ? snapshot.html : '');
    const errors = Array.isArray(snapshot?.consoleErrors) ? snapshot.consoleErrors : [];
    const resources = Array.isArray(snapshot?.failedResourceUrls) ? snapshot.failedResourceUrls : [];
    return {
      htmlLength: rawHtml.length,
      htmlSnippet: rawHtml.slice(0, 256),
      observedFinalUrl: typeof snapshot?.finalUrl === 'string' ? snapshot.finalUrl.slice(0, 2048) : null,
      observedContentType: typeof snapshot?.contentType === 'string' ? snapshot.contentType.slice(0, 256) : null,
      consoleErrors: errors.filter(e => typeof e === 'string').slice(0, 10).map(e => e.slice(0, 512)),
      failedResourceUrls: resources.filter(u => typeof u === 'string').slice(0, 10).map(u => u.slice(0, 2048)),
    };
  };

  const run = async ({ invoke, projectId }) => {
    const checks = [];
    let snapshot = null;
    let previewEvidence = 'not-attempted';
    const check = (name, value) => {
      if (!value) throw new Error(name);
      checks.push(name);
    };
    try {
      snapshot = await invoke('render_crawl_page', baseArgs);
      const html = typeof snapshot?.html === 'string' ? snapshot.html : '';
      check('renderer HTML captured', html.length > 0 && html.includes('Example Domain'));
      const status = statusEvidence(snapshot);
      check('renderer HTTP status is 200 or explicitly unavailable',
        status.httpStatusFieldPresent && (status.httpStatus === 200 || status.httpStatus === null));
      let finalUrl;
      try { finalUrl = new URL(snapshot?.finalUrl); } catch (_) { finalUrl = null; }
      check('renderer final URL remains expected host', finalUrl?.origin === new URL(target).origin);

      const screenshot = await invoke('capture_rendered_artifact', artifactArgs('screenshot'));
      checkArtifact('screenshot', screenshot, check);

      const pdf = await invoke('capture_rendered_artifact', artifactArgs('pdf'));
      checkArtifact('pdf', pdf, check);

      await invoke('open_rendered_element_preview', {
        url: target, selector: 'h1', needle: 'Example Domain', domIndex: null,
        previewTitle: 'SEOmi renderer preview', notFoundMessage: 'Example Domain heading was not found.',
      });
      previewEvidence = 'ipc-success';
      check('renderer preview IPC returned', previewEvidence === 'ipc-success');
      const crawlEvidence = await window.__seomiDesktopCrawlValidation.run({ invoke, projectId, check });
      return {
        status: 'executed',
        passed: true,
        checks,
        target,
        finalUrl: snapshot.finalUrl,
        previewEvidence,
        crawlEvidence,
        ...status,
      };
    } catch (error) {
      const capturedHtml = typeof snapshot?.html === 'string' ? snapshot.html : '';
      return {
        status: 'executed',
        passed: false,
        checks,
        failure: String(error),
        target,
        previewEvidence,
        snapshot: {
          ...statusEvidence(snapshot),
          ...failureDiagnostics(snapshot, capturedHtml),
        },
      };
    }
  };

  const skipped = reason => ({
    status: 'skipped',
    passed: true,
    checks: [],
    reason: reason || 'Set SEOMI_E2E_RENDERER=1 to enable online renderer checks.',
    target,
  });

  window.__seomiRendererE2e = { run, skipped, target, failureDiagnostics };
})();
