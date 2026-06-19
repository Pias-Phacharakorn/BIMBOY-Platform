// Clash report HTML importers.
// Supports two formats:
//  - Legacy: Clash_Tracker.html (base64 thumbnails, columns: Img|#|Name|Type|Status|Disc|Level|Zone|Originator|Due)
//  - New:    25690508_Report.html (external image refs, columns: Folder|Name|View Point|Plan View|Section View|Markup|Solution|Image Name(hidden)|Originator|Discipline)

export interface ParsedClash {
  vp_key: string | null;
  name: string;
  issue_type: string | null;
  status: string;
  discipline: string | null;
  level: string | null;
  zone: string | null;
  originator: string | null;
  due_date: string | null;
  folder?: string | null;
  markup?: string | null;
  solution?: string | null;
  // legacy inline thumbnail
  thumbnailDataUrl?: string | null;
  // new format: external image filenames
  viewPointImg?: string | null;
  planViewImg?: string | null;
  sectionViewImg?: string | null;
}

export interface ParsedClashResult {
  rows: ParsedClash[];
  /** Set of image filenames the new-format report expects to find on disk. Empty for legacy format. */
  requiredImages: Set<string>;
  format: "legacy" | "new";
}

const normStatus = (s: string): string => {
  const v = (s || "").trim().toLowerCase();
  if (v.startsWith("resolv") || v.startsWith("clos")) return "Closed";
  if (v.startsWith("unresolv") || v.startsWith("in prog") || v.startsWith("progress")) return "In Progress";
  return "Open";
};

const toIsoDate = (s: string | null): string | null => {
  if (!s) return null;
  const t = s.trim();
  if (!t) return null;
  const m1 = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m1) return `${m1[1]}-${m1[2].padStart(2, "0")}-${m1[3].padStart(2, "0")}`;
  const m2 = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m2) return `${m2[3]}-${m2[2].padStart(2, "0")}-${m2[1].padStart(2, "0")}`;
  const d = new Date(t);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
};

const imgFilename = (td: Element | undefined): string | null => {
  const img = td?.querySelector?.("img");
  const src = img?.getAttribute("src") || "";
  if (!src || src.startsWith("data:")) return null;
  // strip path / query
  const file = src.split(/[\\/]/).pop()?.split("?")[0] || null;
  return file || null;
};

const detectFormat = (doc: Document): "legacy" | "new" => {
  const headers = Array.from(doc.querySelectorAll("thead th")).map((th) => (th.textContent || "").trim().toLowerCase());
  if (headers.includes("view point") && headers.includes("plan view") && headers.includes("section view")) return "new";
  return "legacy";
};

export const parseClashHtml = (html: string): ParsedClashResult => {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const format = detectFormat(doc);
  const rows: ParsedClash[] = [];
  const requiredImages = new Set<string>();

  const trs = Array.from(doc.querySelectorAll("tbody tr")).filter((tr) => tr.querySelectorAll("td").length >= 6);

  if (format === "new") {
    trs.forEach((tr, idx) => {
      const tds = Array.from(tr.querySelectorAll("td"));
      const text = (i: number) => (tds[i]?.textContent || "").trim();
      const name = text(1);
      if (!name) return;
      const vp = imgFilename(tds[2]);
      const pl = imgFilename(tds[3]);
      const se = imgFilename(tds[4]);
      if (vp) requiredImages.add(vp);
      if (pl) requiredImages.add(pl);
      if (se) requiredImages.add(se);

      // Extract from viewpoint name. Pattern segments split by `_`:
      //   1: YYYYMMDD (date)  → due_date = date + 7 days
      //   2: LEVEL-ZONE       → level (before -), zone (after -)
      //   3: DISCIPLINE
      //   4: ORIGINATOR-...   → originator (before -)
      //   6: TYPE
      //   7: STATUS
      const parts = name.split("_");
      const get = (i: number) => (parts[i - 1] || "").trim();
      const splitDash = (s: string) => {
        const idx = s.indexOf("-");
        return idx >= 0 ? [s.slice(0, idx).trim(), s.slice(idx + 1).trim()] : [s.trim(), ""];
      };
      const d1 = get(1);
      let due: string | null = null;
      const md = d1.match(/^(\d{4})(\d{2})(\d{2})$/);
      if (md) {
        const dt = new Date(Date.UTC(+md[1], +md[2] - 1, +md[3]));
        dt.setUTCDate(dt.getUTCDate() + 7);
        due = dt.toISOString().slice(0, 10);
      }
      const [level, zone] = splitDash(get(2));
      const disc = get(3) || null;
      const [originator] = splitDash(get(4));
      const issueType = get(6) || null;
      const status = normStatus(get(7));

      rows.push({
        vp_key: String(idx + 1).padStart(4, "0"),
        name,
        issue_type: issueType,
        status,
        discipline: disc,
        level: level || null,
        zone: zone || null,
        originator: originator || text(8) || null,
        due_date: due,
        folder: text(0) || null,
        markup: text(5) || null,
        solution: text(6) || null,
        viewPointImg: vp,
        planViewImg: pl,
        sectionViewImg: se,
      });
    });
    return { rows, requiredImages, format };
  }

  // legacy
  for (const tr of trs) {
    const tds = Array.from(tr.querySelectorAll("td"));
    const img = tr.querySelector("img");
    const text = (i: number) => (tds[i]?.textContent || "").trim();
    const vp_key = text(1) || null;
    const name = text(2);
    if (!name) continue;
    rows.push({
      vp_key,
      name,
      issue_type: text(3) || null,
      status: normStatus(text(4)),
      discipline: text(5) || null,
      level: text(6) || null,
      zone: text(7) || null,
      originator: text(8) || null,
      due_date: toIsoDate(text(9)),
      thumbnailDataUrl: img?.getAttribute("src") || null,
    });
  }
  return { rows, requiredImages, format };
};

export const dataUrlToBlob = (dataUrl: string): Blob | null => {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return null;
  const mime = m[1];
  const binary = atob(m[2]);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return new Blob([arr], { type: mime });
};
