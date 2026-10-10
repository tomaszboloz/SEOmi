// Optional online renderer checks for the desktop E2E harness.
// This file is intentionally separate until the native harness opts in.
(() => {
  const target = 'https://example.com/';
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
      const binary = atob(value);
      return Uint8Array.from(binary, character => character.charCodeAt(0));
    } catch (_) {
      return null;
    }
  };
  const startsWith = (bytes, signature) => bytes?.length >= signature.length
    && signature.every((value, index) => bytes[index] === value);
  const artifactArgs = kind => ({ ...baseArgs, kind, runId: expectedRunId });
  const artifactFileName = (kind, extension) => new RegExp(`^rendered-page-[0-9]{8}T[0-9]{6}Z-${kind}\\.${extension}$`);
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
    const fieldPresent = snapshot !== null && typeof snapshot === 'object'
      && Object.prototype.hasOwnProperty.call(snapshot, 'httpStatus');
    const httpStatus = fieldPresent ? snapshot.httpStatus : undefined;
    const available = Number.isInteger(httpStatus) && httpStatus > 0;
    const reason = !fieldPresent
      ? 'Snapshot omitted httpStatus.'
      : httpStatus === undefined
        ? 'Snapshot exposed an undefined httpStatus.'
        : httpStatus === null
          ? 'Navigation Timing responseStatus is unavailable in this WebKit runtime.'
          : httpStatus === 200 ? null : `Unexpected renderer HTTP status: ${String(httpStatus)}.`;
    return {
      httpStatus: httpStatus === undefined ? null : httpStatus,
      observedHttpStatus: httpStatus === undefined ? 'undefined' : httpStatus,
      httpStatusAvailable: available,
      httpStatusReason: reason,
      httpStatusFieldPresent: fieldPresent,
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
      check('renderer final URL remains example.com', finalUrl?.hostname === 'example.com');

      const screenshot = await invoke('capture_rendered_artifact', artifactArgs('screenshot'));
      checkArtifact('screenshot', screenshot, check);

      const pdf = await invoke('capture_rendered_artifact', artifactArgs('pdf'));
      checkArtifact('pdf', pdf, check);

      await invoke('open_rendered_element_preview', {
        url: target,
        selector: 'h1',
        needle: 'Example Domain',
        domIndex: null,
        previewTitle: 'SEOmi renderer preview',
        notFoundMessage: 'Example Domain heading was not found.',
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
      return {
        status: 'executed',
        passed: false,
        checks,
        failure: String(error),
        target,
        previewEvidence,
        snapshot: statusEvidence(snapshot),
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

  window.__seomiRendererE2e = { run, skipped, target };
})();
