/**
 * Prepare loan uploads for Storage (`loan-documents`, max 8MB, image MIME only).
 * Images under 5MB upload as-is; only larger files get a light shrink.
 * PDFs are rasterized to JPEG (bucket cannot store application/pdf).
 */

import imageCompression from "browser-image-compression";

/** Soft target — under Storage 8MB with headroom. Compress only when over this. */
const COMPRESS_OVER_BYTES = 5 * 1024 * 1024;
const TARGET_MAX_MB = 5;
const MAX_EDGE = 2000;
const JPEG_QUALITY = 0.88;

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("บีบอัดรูปไม่สำเร็จ"));
      },
      "image/jpeg",
      quality,
    );
  });
}

function baseName(file: File) {
  return file.name.replace(/\.[^.]+$/, "") || "loan-document";
}

async function shrinkIfOver(file: File): Promise<File> {
  if (file.size <= COMPRESS_OVER_BYTES) return file;

  const compressed = await imageCompression(file, {
    maxSizeMB: TARGET_MAX_MB,
    maxWidthOrHeight: MAX_EDGE,
    fileType: "image/jpeg",
    initialQuality: JPEG_QUALITY,
    useWebWorker: true,
  });
  return new File([compressed], `${baseName(file)}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

async function prepareImage(file: File): Promise<File> {
  return shrinkIfOver(file);
}

/** Render PDF pages to one JPEG (stacked) — required for Storage MIME rules. */
async function pdfToJpeg(file: File): Promise<File> {
  const pdfjs = await import("pdfjs-dist");

  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  }

  const data = new Uint8Array(await file.arrayBuffer());
  const source = await pdfjs.getDocument({
    data,
    useSystemFonts: true,
  }).promise;

  const pageCount = Math.max(1, source.numPages);
  const pageCanvases: HTMLCanvasElement[] = [];

  for (let i = 1; i <= pageCount; i += 1) {
    const page = await source.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const longest = Math.max(base.width, base.height);
    const scale = Math.min(1.5, MAX_EDGE / longest);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const renderTask = page.render({ canvasContext: ctx, viewport, canvas });
    await renderTask.promise;
    pageCanvases.push(canvas);
  }

  if (pageCanvases.length === 0) return file;

  const gap = 12;
  const width = Math.max(...pageCanvases.map((c) => c.width));
  const height = pageCanvases.reduce((sum, c) => sum + c.height, 0) + gap * (pageCanvases.length - 1);

  const merged = document.createElement("canvas");
  merged.width = width;
  merged.height = height;
  const ctx = merged.getContext("2d");
  if (!ctx) return file;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  let y = 0;
  for (const pageCanvas of pageCanvases) {
    const x = Math.floor((width - pageCanvas.width) / 2);
    ctx.drawImage(pageCanvas, x, y);
    y += pageCanvas.height + gap;
  }

  const blob = await canvasToJpeg(merged, JPEG_QUALITY);
  if (blob.size <= 0) return file;

  const jpeg = new File([blob], `${baseName(file)}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
  return shrinkIfOver(jpeg);
}

/** Prepare any loan document. PDFs become JPEG for Storage compatibility. */
export async function compressLoanDocument(file: File): Promise<File> {
  try {
    if (file.type.startsWith("image/")) return await prepareImage(file);
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      return await pdfToJpeg(file);
    }
  } catch {
    // Fall through — upload original if prepare fails.
  }
  return file;
}
