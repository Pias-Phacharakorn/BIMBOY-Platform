import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.mjs?url";
import { getSignedPdfUrl } from "@/lib/pdfUtils";

// Set worker path
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

export async function fetchPdfArrayBuffer(pdfUrl: string): Promise<ArrayBuffer> {
  // Get signed URL first if it's a Supabase URL
  const url = pdfUrl.includes('supabase') ? await getSignedPdfUrl(pdfUrl) : pdfUrl;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch PDF (${response.status})`);
  }
  return await response.arrayBuffer();
}

export async function loadPdfFromArrayBuffer(arrayBuffer: ArrayBuffer) {
  return await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
}

export async function renderPdfToCanvas(
  pdfSource: string | ArrayBuffer,
  scale: number = 1.5
): Promise<HTMLCanvasElement> {
  let arrayBuffer: ArrayBuffer;
  
  if (typeof pdfSource === 'string') {
    arrayBuffer = await fetchPdfArrayBuffer(pdfSource);
  } else {
    arrayBuffer = pdfSource;
  }
  
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d")!;
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({ canvasContext: context, viewport }).promise;
  return canvas;
}

export async function renderPdfPageToCanvas(
  arrayBuffer: ArrayBuffer,
  pageNum: number,
  scale: number = 1.5
): Promise<HTMLCanvasElement> {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d")!;
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({ canvasContext: context, viewport }).promise;
  return canvas;
}

export async function getPdfPageCount(arrayBuffer: ArrayBuffer): Promise<number> {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  return pdf.numPages;
}

export function createDiffCanvas(
  canvasA: HTMLCanvasElement,
  canvasB: HTMLCanvasElement
): HTMLCanvasElement {
  const width = Math.max(canvasA.width, canvasB.width);
  const height = Math.max(canvasA.height, canvasB.height);

  const diffCanvas = document.createElement("canvas");
  diffCanvas.width = width;
  diffCanvas.height = height;
  const ctx = diffCanvas.getContext("2d")!;

  // Draw base image (version B - older)
  ctx.drawImage(canvasB, 0, 0);

  // Get image data for comparison
  const ctxA = canvasA.getContext("2d")!;
  const ctxB = canvasB.getContext("2d")!;

  const dataA = ctxA.getImageData(0, 0, canvasA.width, canvasA.height);
  const dataB = ctxB.getImageData(0, 0, canvasB.width, canvasB.height);

  const diffData = ctx.createImageData(width, height);

  // Compare pixels and highlight differences
  // Document A = Newer Version, Document B = Older Version
  for (let i = 0; i < Math.min(dataA.data.length, dataB.data.length); i += 4) {
    const rA = dataA.data[i];
    const gA = dataA.data[i + 1];
    const bA = dataA.data[i + 2];

    const rB = dataB.data[i];
    const gB = dataB.data[i + 1];
    const bB = dataB.data[i + 2];

    // Calculate difference
    const diff = Math.abs(rA - rB) + Math.abs(gA - gB) + Math.abs(bA - bB);

    if (diff > 30) {
      // Threshold for detecting change
      // Compare brightness: if B is brighter, content was removed (was in older, not in newer)
      if (rB + gB + bB > rA + gA + bA) {
        // Removed content - show in Green
        diffData.data[i] = 100;
        diffData.data[i + 1] = 255;
        diffData.data[i + 2] = 100;
        diffData.data[i + 3] = 255;
      } else {
        // Added content - show in Red
        diffData.data[i] = 255;
        diffData.data[i + 1] = 100;
        diffData.data[i + 2] = 100;
        diffData.data[i + 3] = 255;
      }
    } else {
      // No significant change - show grayscale version
      const gray = Math.round((rB + gB + bB) / 3);
      diffData.data[i] = gray;
      diffData.data[i + 1] = gray;
      diffData.data[i + 2] = gray;
      diffData.data[i + 3] = 255;
    }
  }

  ctx.putImageData(diffData, 0, 0);
  return diffCanvas;
}
