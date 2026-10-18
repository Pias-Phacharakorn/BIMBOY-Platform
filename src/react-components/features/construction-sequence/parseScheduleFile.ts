import { parseSchedule, type ParseResult } from "@/classes/ConstructionSchedule";

/** Reads an uploaded `.json` and validates it. Never throws — every failure becomes a message. */
export async function parseScheduleFile(file: File): Promise<ParseResult> {
  let json: unknown;
  try {
    // `File.text()` decodes as UTF-8, which keeps names like "Level 2 · Structure" intact.
    json = JSON.parse(await file.text());
  } catch {
    return { ok: false, errors: [`${file.name} is not valid JSON`] };
  }
  return parseSchedule(json);
}
