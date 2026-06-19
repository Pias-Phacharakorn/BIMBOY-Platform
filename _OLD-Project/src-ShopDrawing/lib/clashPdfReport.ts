import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import html2canvas from "html2canvas";
import { supabase } from "@/integrations/supabase/client";
import { Clash, STATUS_COLORS, PRIORITY_COLORS, issueLabel } from "@/components/clash/clashTypes";

const hexToRgb = (hex: string) => {
  const h = hex.replace("#", "");
  return rgb(parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255);
};

// Standard PDF fonts only support WinAnsi (latin-1). Replace any non-encodable
// character with "?" so Thai / CJK strings don't crash pdf-lib.
const ansi = (s: string | null | undefined): string => {
  if (!s) return "";
  let out = "";
  for (const ch of String(s)) {
    const code = ch.charCodeAt(0);
    out += code <= 0xff && code !== 0x7f ? ch : "?";
  }
  return out;
};

const fetchSignedImage = async (path: string | null): Promise<Uint8Array | null> => {
  if (!path) return null;
  const { data } = await supabase.storage.from("clash-thumbnails").createSignedUrl(path, 3600);
  if (!data?.signedUrl) return null;
  try {
    const res = await fetch(data.signedUrl);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch { return null; }
};

const embedImg = async (pdf: PDFDocument, bytes: Uint8Array | null) => {
  if (!bytes) return null;
  try { return await pdf.embedJpg(bytes); } catch {}
  try { return await pdf.embedPng(bytes); } catch {}
  return null;
};

export interface ReportOptions {
  projectName: string;
  dashboardEl: HTMLElement | null;
  clashes: Clash[];
}

export const generateClashReport = async ({ projectName, dashboardEl, clashes }: ReportOptions): Promise<Uint8Array> => {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // Page 1 — dashboard summary
  const cover = pdf.addPage([842, 595]); // A4 landscape
  cover.drawText(ansi("Clash Tracking Report"), { x: 40, y: 555, size: 20, font: bold });
  cover.drawText(ansi(projectName), { x: 40, y: 535, size: 11, font, color: rgb(0.3, 0.3, 0.3) });
  cover.drawText(ansi(`Generated ${new Date().toLocaleString()}`), { x: 40, y: 520, size: 9, font, color: rgb(0.5, 0.5, 0.5) });
  cover.drawText(ansi(`${clashes.length} issues in scope`), { x: 40, y: 505, size: 9, font, color: rgb(0.5, 0.5, 0.5) });

  if (dashboardEl) {
    try {
      const canvas = await html2canvas(dashboardEl, { scale: 1.2, backgroundColor: "#ffffff", useCORS: true, logging: false });
      const png = canvas.toDataURL("image/png");
      const bytes = Uint8Array.from(atob(png.split(",")[1]), (c) => c.charCodeAt(0));
      const img = await pdf.embedPng(bytes);
      const maxW = 762, maxH = 460;
      const ratio = Math.min(maxW / img.width, maxH / img.height);
      const w = img.width * ratio, h = img.height * ratio;
      cover.drawImage(img, { x: 40, y: 40, width: w, height: h });
    } catch (e) {
      cover.drawText("(Could not capture dashboard snapshot)", { x: 40, y: 480, size: 10, font, color: rgb(0.7, 0, 0) });
    }
  }

  // Per-issue pages — portrait A4
  for (const c of clashes) {
    const page = pdf.addPage([595, 842]);
    const statusColor = hexToRgb(STATUS_COLORS[c.status]);
    const priorityColor = hexToRgb(PRIORITY_COLORS[c.priority]);

    page.drawRectangle({ x: 0, y: 782, width: 595, height: 60, color: statusColor });
    page.drawText(ansi(`${issueLabel(c)}  ${c.name}`), { x: 24, y: 808, size: 16, font: bold, color: rgb(1, 1, 1), maxWidth: 547 });
    page.drawText(ansi(c.status), { x: 24, y: 790, size: 10, font, color: rgb(1, 1, 1) });
    page.drawRectangle({ x: 80, y: 788, width: 70, height: 14, color: priorityColor });
    page.drawText(ansi(c.priority), { x: 88, y: 791, size: 9, font: bold, color: rgb(1, 1, 1) });

    const vpBytes = await fetchSignedImage(c.thumbnail_url);
    const vpImg = await embedImg(pdf, vpBytes);
    if (vpImg) {
      const maxW = 547, maxH = 280;
      const ratio = Math.min(maxW / vpImg.width, maxH / vpImg.height);
      const w = vpImg.width * ratio, h = vpImg.height * ratio;
      page.drawImage(vpImg, { x: (595 - w) / 2, y: 480, width: w, height: h });
    } else {
      page.drawRectangle({ x: 24, y: 480, width: 547, height: 280, color: rgb(0.95, 0.95, 0.95) });
      page.drawText("No viewpoint image", { x: 240, y: 615, size: 11, font, color: rgb(0.6, 0.6, 0.6) });
    }

    const fields: [string, string][] = [
      ["Type", c.issue_type || "—"],
      ["Discipline", c.discipline || "—"],
      ["Zone", c.zone || "—"],
      ["Level", c.level || "—"],
      ["Phase", c.phase || "—"],
      ["Element ID", c.element_id || "—"],
      ["Assigned to", c.originator || "—"],
      ["Author", c.author_email || "—"],
      ["Due date", c.due_date || "—"],
      ["Created", new Date(c.created_at).toLocaleDateString()],
      ["Folder", c.folder || "—"],
    ];
    let y = 440;
    for (let i = 0; i < fields.length; i++) {
      const [k, v] = fields[i];
      const col = i % 2;
      const x = 24 + col * 280;
      if (col === 0 && i > 0) y -= 22;
      page.drawText(ansi(k), { x, y, size: 8, font, color: rgb(0.5, 0.5, 0.5) });
      page.drawText(ansi(v).slice(0, 60), { x, y: y - 12, size: 10, font: bold });
    }

    if (c.description) {
      page.drawText("Description", { x: 24, y: 200, size: 8, font, color: rgb(0.5, 0.5, 0.5) });
      const lines = wrapText(ansi(c.description), 90).slice(0, 8);
      lines.forEach((l, i) => page.drawText(l, { x: 24, y: 186 - i * 12, size: 9, font }));
    }
    if (c.solution) {
      page.drawText("Solution", { x: 24, y: 80, size: 8, font, color: rgb(0.5, 0.5, 0.5) });
      const lines = wrapText(ansi(c.solution), 90).slice(0, 4);
      lines.forEach((l, i) => page.drawText(l, { x: 24, y: 66 - i * 12, size: 9, font }));
    }

    page.drawText(ansi(projectName), { x: 24, y: 16, size: 8, font, color: rgb(0.6, 0.6, 0.6) });
  }

  return pdf.save();
};

const wrapText = (text: string, max: number): string[] => {
  const words = text.split(/\s+/);
  const out: string[] = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > max) { if (line) out.push(line); line = w; }
    else { line = (line + " " + w).trim(); }
  }
  if (line) out.push(line);
  return out;
};

export const downloadBlob = (bytes: Uint8Array, filename: string) => {
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};
