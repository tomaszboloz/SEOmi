// One navigation at a time. The native receiver acknowledges each fragment
// before the next is sent, so WebView navigation coalescing cannot skip data.
async function sendCaptureChunks(encoded, nonce, sequence, chunkSize, maxChunks) {
  const total = Math.ceil(encoded.length / chunkSize);
  if (!total || total > maxChunks) throw new Error('Rendered capture exceeds the transfer limit.');
  for (let index = 0; index < total; index += 1) {
    const chunk = encoded.slice(index * chunkSize, (index + 1) * chunkSize);
    await new Promise((resolve, reject) => {
      let attempts = 0;
      let timer;
      const cleanup = () => {
        clearTimeout(timer);
        window.removeEventListener('seomi-capture-ack', acknowledge);
      };
      const acknowledge = (event) => {
        const detail = event.detail;
        if (detail?.nonce !== nonce || detail.sequence !== sequence || detail.index !== index) return;
        cleanup();
        resolve();
      };
      const send = () => {
        if (attempts++ >= 5) {
          cleanup();
          reject(new Error('Rendered capture fragment was not acknowledged.'));
          return;
        }
        timer = setTimeout(send, 100);
        location.href = 'seomi-capture://' + nonce + '/' + sequence + '/' + index + '/' + total + '?data=' + chunk;
      };
      window.addEventListener('seomi-capture-ack', acknowledge);
      send();
    });
  }
}
