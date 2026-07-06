import type { Database } from "@/integrations/supabase/types";

export type DisciplineCode = Database["public"]["Enums"]["drawing_discipline"];

export interface DisciplineOption {
  value: DisciplineCode;
  label: string;
}

// Single source of truth for the fixed discipline list — order matches the
// drawing_discipline enum and drives display order everywhere (Folder tree,
// AddDrawingDialog, Register filter/column).
export const DISCIPLINES: DisciplineOption[] = [
  { value: "01_AR", label: "Architectural" },
  { value: "02_ST", label: "Structural" },
  { value: "03_LA", label: "Landscape" },
  { value: "04_CV", label: "Civil" },
  { value: "05_AC", label: "Mechanical / HVAC" },
  { value: "06_EE", label: "Electrical" },
  { value: "07_FP", label: "Fire Protection" },
  { value: "08_SN", label: "Sanitary / Plumbing" },
];
