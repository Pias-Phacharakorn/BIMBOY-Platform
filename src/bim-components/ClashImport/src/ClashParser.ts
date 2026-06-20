// @ts-nocheck
import { ClashData } from "./ClashImportTypes";

export interface ClashParserResult {
  list: ClashData[];
  errors: { row: number; reason: string }[];
}

export class ClashParser {
  static parseHTML(
    html: string,
    baseDir: string
  ): ClashParserResult {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const rows = doc.querySelectorAll("table tr");

    const result: ClashParserResult = {
      list: [],
      errors: [],
    };

    const minColumns = 8;

    rows.forEach((row, index) => {
      try {
        const cells = row.querySelectorAll("td");
        if (cells.length === 0) return; // Header row or empty

        if (cells.length < minColumns) {
          result.errors.push({
            row: index + 1,
            reason: `Insufficient columns: expected ${minColumns}, found ${cells.length}`,
          });
          return;
        }

        // Folder logic
        const folderText = cells[0].textContent || "";
        const parts = folderText.split("/").map((p) => p.trim().toLowerCase());

        let type = "Unknown";
        if (parts.includes("major")) type = "Major";
        else if (parts.includes("minor")) type = "Minor";

        let status = "Unknown";
        if (parts.some(p => p.includes("new"))) status = "New";
        else if (parts.some(p => p.includes("active"))) status = "Active";
        else if (parts.some(p => p.includes("unresolved"))) status = "Unresolved";
        else if (parts.some(p => p.includes("resolved"))) status = "Resolved.";
        else if (parts.some(p => p.includes("approved"))) status = "Approved as Noted";

        // Name logic
        const pathText = cells[1].textContent || "";
        const dateStr = pathText.includes(" > ")
          ? pathText.split(" > ")[0]
          : "Unknown";
        const nameStr = pathText.includes(" > ")
          ? pathText.split(" > ")[1]
          : pathText;

        // ID logic
        const idCellIndex = cells.length - 1;
        const idMatch = cells[idCellIndex].textContent?.split("/");
        const idRaw = idMatch ? idMatch[0].replace(".jpg", "") : "0";
        const id = parseInt(idRaw.replace(/\D/g, "")) || 0;

        const markup = cells[5].textContent?.trim() || "";
        const solution = cells[6].textContent?.trim() || "";

        // Image helper (Firebase Storage compatible)
        const getFullImgPath = (cellIndex: number) => {
          const src = cells[cellIndex].querySelector("img")?.getAttribute("src") || "";
          if (!src) return "";
          
          // Encode slashes in the path so Firebase Storage API can read it
          const encodedSrc = src.replace(/\//g, "%2F");
          
          // If the baseDir already contains firebasestorage.googleapis.com, append ?alt=media
          const suffix = baseDir.includes("firebasestorage") ? "?alt=media" : "";
          
          return `${baseDir}${encodedSrc}${suffix}`;
        };

        result.list.push({
          id,
          name: nameStr,
          type,
          status,
          date: dateStr,
          markup,
          solution,
          image: getFullImgPath(2),
          planImage: getFullImgPath(3),
          sectionImage: getFullImgPath(4),
        });
      } catch (err) {
        result.errors.push({
          row: index + 1,
          reason: err instanceof Error ? err.message : "Unknown error",
        });
      }
    });

    return result;
  }
}

