import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MODULE_KEYS = ["bim", "iot", "workflow"] as const;
const LEVELS = ["full", "editor", "viewer"] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];
export type PermissionLevel = (typeof LEVELS)[number];

export type ProjectAccess = {
  id: string;
  name: string;
  ownerId: string;
  modules: Partial<Record<ModuleKey, PermissionLevel>>;
};

export type MyContext = {
  userId: string;
  appRole: "admin" | "user";
  projects: ProjectAccess[];
};

async function fetchAppRole(
  supabase: ReturnType<typeof Object> extends never
    ? never
    : Awaited<ReturnType<typeof import("@supabase/supabase-js").createClient>>,
  userId: string,
): Promise<"admin" | "user"> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const roles = (data ?? []).map((r: { role: string }) => r.role);
  return roles.includes("admin") ? "admin" : "user";
}

export const getMyContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyContext> => {
    const { supabase, userId } = context;

    const appRole = await fetchAppRole(supabase as never, userId);

    // Projects the user can see (RLS already filters; admins see all).
    const { data: projectsRaw, error: pErr } = await supabase
      .from("projects")
      .select("id, name, owner_id")
      .order("name");
    if (pErr) throw new Error(pErr.message);

    let permsByProject = new Map<string, Partial<Record<ModuleKey, PermissionLevel>>>();

    if (appRole === "admin") {
      for (const p of projectsRaw ?? []) {
        permsByProject.set(p.id, { bim: "full", iot: "full", workflow: "full" });
      }
    } else {
      const { data: perms } = await supabase
        .from("project_module_perms")
        .select("project_id, module, level")
        .eq("user_id", userId);
      for (const row of perms ?? []) {
        const m = permsByProject.get(row.project_id) ?? {};
        m[row.module as ModuleKey] = row.level as PermissionLevel;
        permsByProject.set(row.project_id, m);
      }
    }

    const projects: ProjectAccess[] = (projectsRaw ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      ownerId: p.owner_id,
      modules: permsByProject.get(p.id) ?? {},
    }));

    return { userId, appRole, projects };
  });

// ---------- Admin-only mutations ----------

async function assertAdmin(
  supabase: Awaited<
    ReturnType<typeof import("@supabase/supabase-js").createClient>
  >,
  userId: string,
) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden: admin role required");
}

export const createProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        name: z.string().min(1).max(120),
        pin: z
          .object({
            slug: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/i),
            type: z.string().min(1).max(40),
            status: z.string().min(1).max(40),
            lat: z.number(),
            lng: z.number(),
            elevation: z.number().optional(),
            province: z.string().min(1).max(80),
            weatherStationId: z.string().max(80).optional(),
          })
          .optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase as never, userId);
    const { data: row, error } = await supabase
      .from("projects")
      .insert({ name: data.name, owner_id: userId })
      .select("id, name, owner_id")
      .single();
    if (error) throw new Error(error.message);
    // Auto-add creating admin as member with full perms.
    await supabase.from("project_members").insert({ project_id: row.id, user_id: userId });
    await supabase.from("project_module_perms").insert([
      { project_id: row.id, user_id: userId, module: "bim", level: "full" },
      { project_id: row.id, user_id: userId, module: "iot", level: "full" },
      { project_id: row.id, user_id: userId, module: "workflow", level: "full" },
    ]);
    if (data.pin) {
      const { error: pinErr } = await supabase.from("gis_pins").insert({
        slug: data.pin.slug,
        name: data.name,
        type: data.pin.type,
        status: data.pin.status,
        lat: data.pin.lat,
        lng: data.pin.lng,
        elevation: data.pin.elevation ?? 0,
        province: data.pin.province,
        weather_station_id: data.pin.weatherStationId ?? "",
        bim_world_coordinates: false,
        project_id: row.id,
      });
      if (pinErr) throw new Error(`Project created but pin failed: ${pinErr.message}`);
    }
    return { id: row.id, name: row.name, ownerId: row.owner_id };
  });

export const renameProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        projectId: z.string().uuid(),
        name: z.string().min(1).max(120),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase as never, userId);
    const { error } = await supabase
      .from("projects")
      .update({ name: data.name })
      .eq("id", data.projectId);
    if (error) throw new Error(error.message);
    // Keep the linked GIS pin name in sync.
    await supabase
      .from("gis_pins")
      .update({ name: data.name })
      .eq("project_id", data.projectId);
    return { ok: true };
  });

export const deleteProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ projectId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase as never, userId);
    // Cascade-clean associated assets before removing the project row.
    // 1. List + delete storage objects for this project's BIM models.
    const { data: models } = await supabase
      .from("project_bim_models")
      .select("storage_path")
      .eq("project_id", data.projectId);
    const paths = (models ?? [])
      .map((m) => m.storage_path)
      .filter((p): p is string => !!p && p.startsWith(`${data.projectId}/`));
    if (paths.length > 0) {
      await supabase.storage.from("bim-models").remove(paths);
    }
    // 2. Delete the linked GIS pin (FK is ON DELETE SET NULL — we want it gone).
    await supabase.from("gis_pins").delete().eq("project_id", data.projectId);
    // 3. The project row delete cascades model + mapping rows via FK.
    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", data.projectId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertProjectPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        projectId: z.string().uuid(),
        slug: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/i),
        type: z.string().min(1).max(40),
        status: z.string().min(1).max(40),
        lat: z.number(),
        lng: z.number(),
        elevation: z.number().optional(),
        province: z.string().min(1).max(80),
        weatherStationId: z.string().max(80).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase as never, userId);
    const { data: project, error: projErr } = await supabase
      .from("projects")
      .select("name")
      .eq("id", data.projectId)
      .maybeSingle();
    if (projErr) throw new Error(projErr.message);
    if (!project) throw new Error("Project not found");
    const { error } = await supabase.from("gis_pins").upsert(
      {
        slug: data.slug,
        name: project.name,
        type: data.type,
        status: data.status,
        lat: data.lat,
        lng: data.lng,
        elevation: data.elevation ?? 0,
        province: data.province,
        weather_station_id: data.weatherStationId ?? "",
        bim_world_coordinates: false,
        project_id: data.projectId,
      },
      { onConflict: "slug" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addProjectMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        projectId: z.string().uuid(),
        userId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase as never, userId);
    const { error } = await supabase
      .from("project_members")
      .insert({ project_id: data.projectId, user_id: data.userId });
    if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    return { ok: true };
  });

export const removeProjectMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        projectId: z.string().uuid(),
        userId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase as never, userId);
    await supabase
      .from("project_module_perms")
      .delete()
      .eq("project_id", data.projectId)
      .eq("user_id", data.userId);
    const { error } = await supabase
      .from("project_members")
      .delete()
      .eq("project_id", data.projectId)
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setModulePermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        projectId: z.string().uuid(),
        userId: z.string().uuid(),
        module: z.enum(MODULE_KEYS),
        // null/"none" clears the permission for that module
        level: z.enum(LEVELS).nullable(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase as never, userId);
    if (data.level === null) {
      const { error } = await supabase
        .from("project_module_perms")
        .delete()
        .eq("project_id", data.projectId)
        .eq("user_id", data.userId)
        .eq("module", data.module as any);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("project_module_perms")
        .upsert(
          {
            project_id: data.projectId,
            user_id: data.userId,
            module: data.module as any,
            level: data.level,
          },
          { onConflict: "project_id,user_id,module" },
        );
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const listProjectMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ projectId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: members, error } = await supabase
      .from("project_members")
      .select("user_id, added_at")
      .eq("project_id", data.projectId);
    if (error) throw new Error(error.message);
    const { data: perms } = await supabase
      .from("project_module_perms")
      .select("user_id, module, level")
      .eq("project_id", data.projectId);
    const permByUser = new Map<string, Partial<Record<ModuleKey, PermissionLevel>>>();
    for (const r of perms ?? []) {
      const m = permByUser.get(r.user_id) ?? {};
      m[r.module as ModuleKey] = r.level as PermissionLevel;
      permByUser.set(r.user_id, m);
    }
    return (members ?? []).map((m) => ({
      userId: m.user_id,
      addedAt: m.added_at,
      modules: permByUser.get(m.user_id) ?? {},
    }));
  });

// ---------- GIS model pose (admin OR BIM editor) ----------

async function assertCanEditPose(
  supabase: Awaited<
    ReturnType<typeof import("@supabase/supabase-js").createClient>
  >,
  userId: string,
  projectId: string,
) {
  // Admin shortcut
  const { data: admin } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (admin) return;
  // Otherwise must have BIM editor/full on the project
  const { data: perm } = await supabase
    .from("project_module_perms")
    .select("level")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .eq("module", "bim" as any)
    .maybeSingle();
  const level = (perm as { level?: string } | null)?.level;
  if (level !== "editor" && level !== "full") {
    throw new Error("Forbidden: BIM editor permission required");
  }
}

export const updateProjectModelPose = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        projectId: z.string().uuid(),
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        elevation: z.number(),
        headingDeg: z.number(),
        pitchDeg: z.number(),
        rollDeg: z.number(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertCanEditPose(supabase as never, userId, data.projectId);
    const { error } = await supabase
      .from("gis_pins")
      .update({
        lat: data.lat,
        lng: data.lng,
        elevation: data.elevation,
        bim_heading_deg: data.headingDeg,
        bim_pitch_deg: data.pitchDeg,
        bim_roll_deg: data.rollDeg,
      })
      .eq("project_id", data.projectId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });