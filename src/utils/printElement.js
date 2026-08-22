/** Copy app styles into an isolated print document (Tailwind, fonts, etc.). */
function copyDocumentStyles(targetDoc) {
  document.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
    targetDoc.head.appendChild(node.cloneNode(true));
  });

  const printOverrides = targetDoc.createElement('style');
  printOverrides.textContent = `
    @page { margin: 0.35in; size: letter; }
    html, body {
      margin: 0;
      padding: 0;
      background: #060B17;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    [data-print-hide] { display: none !important; }
  `;
  targetDoc.head.appendChild(printOverrides);
}

function waitForResources(doc) {
  const styleLinks = Array.from(doc.querySelectorAll('link[rel="stylesheet"]'));
  const styleReady = styleLinks.map(
    (link) =>
      new Promise((resolve) => {
        if (link.sheet) {
          resolve();
          return;
        }
        link.addEventListener('load', resolve, { once: true });
        link.addEventListener('error', resolve, { once: true });
      }),
  );

  const images = Array.from(doc.images || []);
  const imagesReady = images.map(
    (img) =>
      new Promise((resolve) => {
        if (img.complete) {
          resolve();
          return;
        }
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
      }),
  );

  return Promise.all([...styleReady, ...imagesReady]);
}

/**
 * Print a DOM node in an isolated iframe — avoids app shell repetition.
 */
export async function printElement(sourceNode, { title = 'Solar Report' } = {}) {
  if (!sourceNode) return;

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  Object.assign(iframe.style, {
    position: 'fixed',
    right: '0',
    bottom: '0',
    width: '0',
    height: '0',
    border: 'none',
    visibility: 'hidden',
  });
  document.body.appendChild(iframe);

  const printDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!printDoc) {
    iframe.remove();
    return;
  }

  printDoc.open();
  printDoc.write(
    `<!DOCTYPE html><html><head><title>${title}</title></head><body></body></html>`,
  );
  printDoc.close();

  copyDocumentStyles(printDoc);

  const clone = sourceNode.cloneNode(true);
  clone.querySelectorAll('[data-print-hide]').forEach((el) => el.remove());
  printDoc.body.appendChild(clone);

  try {
    await waitForResources(printDoc);
    await new Promise((resolve) => requestAnimationFrame(() => resolve()));

    const printWindow = iframe.contentWindow;
    if (!printWindow) return;

    const cleanup = () => iframe.remove();
    printWindow.addEventListener('afterprint', cleanup, { once: true });
    setTimeout(cleanup, 60_000);

    printWindow.focus();
    printWindow.print();
  } catch {
    iframe.remove();
  }
}
