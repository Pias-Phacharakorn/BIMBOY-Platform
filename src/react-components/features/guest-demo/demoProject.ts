import type { ProjectRow } from "@/react-components/features/projects/projectsService";

/**
 * The guest demo's project, defined entirely in the client.
 *
 * Guest mode never touches Supabase: there is no row for this project, no
 * membership, and no RLS policy involved. `useProjects`/`useProject` return this
 * row (through the same `mapProjectRowToAppProject` mapper every real project
 * goes through, so the shape cannot drift) and the viewer loads .frag files from
 * `public/resources/demo/` as ordinary static assets.
 *
 * Because it is a real `ProjectRow`, everything downstream — the project card,
 * WorkspaceHeader, GIS panel coordinates — behaves as it does for a real project.
 */

/** Fixed UUID so /demo can deep-link to the model route. Not a database id. */
export const DEMO_PROJECT_ID = "11111111-1111-4111-8111-111111111111";

/** Public URL prefix that Vite copies from `public/resources/demo` into `dist`. */
export const DEMO_ASSET_PREFIX = "/resources/demo";

export const DEMO_PROJECT_ROW: ProjectRow = {
  id: DEMO_PROJECT_ID,
  project_name: "Demo Project",
  project_number: 1001,
  description:
    "A sample coordination model — explore the viewer, measure, section and clip tools. Read-only guest preview.",
  status: "active",
  start_date: "2026-01-06",
  finish_date: "2027-06-30",
  created_at: "2026-01-06T00:00:00.000Z",
  updated_at: "2026-01-06T00:00:00.000Z",
  created_by: null,
  is_deleted: false,
  has_model: true,
  // Storage paths are unused in guest mode — models come from DEMO_ASSET_PREFIX.
  ifc_folder_path: "",
  frag_folder_path: "",
  clash_folder_path: null,
  // Auto-load must stay true: it is what triggers the demo model load on open.
  auto_load_cloud_models: true,
  powerbi_tabs: [],
  // Bangkok — gives the GIS tab a sensible place to put the model.
  latitude: 13.7563,
  longitude: 100.5018,
  rotation: 0,
  elevation: 0,
};
