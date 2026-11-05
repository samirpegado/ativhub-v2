"use client";

import QRCode from "qrcode";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export type QrLabel = {
  src: string;
  name: string;
  customId: string | null;
};

export function printQrLabels(labels: QrLabel[]) {
  if (labels.length === 0) return;
  const frame = document.createElement("iframe");
  frame.setAttribute("title", "Etiquetas de QR code");
  frame.style.position = "fixed";
  frame.style.left = "-10000px";
  frame.style.top = "0";
  frame.style.width = "210mm";
  frame.style.height = "297mm";
  frame.style.border = "0";
  document.body.appendChild(frame);

  const win = frame.contentWindow;
  const doc = win?.document;
  if (!win || !doc) {
    frame.remove();
    return;
  }

  const cards = labels
    .map((label) => {
      const code = label.customId ? `<p class="code">${escapeHtml(label.customId)}</p>` : "";
      return `<article class="label">${code}<img src="${label.src}" alt="" /><p class="name">${escapeHtml(label.name)}</p></article>`;
    })
    .join("");

  doc.open();
  doc.write(`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>QR codes</title>
  <style>
    @page { size: A4; margin: 8mm; }
    body { margin: 0; font-family: sans-serif; color: #172033; }
    .sheet {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      grid-auto-rows: 64mm;
      gap: 3mm;
    }
    .label {
      box-sizing: border-box;
      height: 64mm;
      overflow: hidden;
      padding: 2mm;
      border: 1px dashed #c5cad6;
      text-align: center;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    img { width: 28mm; height: 28mm; }
    .code { margin: 0 0 1mm; font-size: 8pt; letter-spacing: 0.04em; }
    .name {
      margin: 1.5mm 0 0;
      font-size: 8.5pt;
      font-weight: 700;
      line-height: 1.2;
      max-height: 2.4em;
      overflow: hidden;
    }
  </style>
</head>
<body>
  <div class="sheet">${cards}</div>
</body>
</html>`);
  doc.close();

  window.setTimeout(() => {
    win.focus();
    win.print();
    win.addEventListener("afterprint", () => frame.remove(), { once: true });
  }, 250);
}

export async function qrDataUrl(assetId: string) {
  return QRCode.toDataURL(`${window.location.origin}/s/${assetId}`, {
    width: 640,
    margin: 1,
    errorCorrectionLevel: "M",
  });
}
