/** Release browser export resources on both success and DOM/download failure. */
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  let anchor: HTMLAnchorElement | undefined;
  try {
    anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
  } finally {
    anchor?.remove();
    // Keep the URL alive until the WebView starts consuming the download.
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
