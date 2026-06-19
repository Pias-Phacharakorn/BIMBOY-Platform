import { useEffect, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppLayout } from "@/components/layout/AppLayout";
import { useProjectContext } from "@/hooks/useProjectContext";
import { supabase } from "@/integrations/supabase/client";
import {
  createProject,
  renameProject,
  deleteProject,
  addProjectMember,
  removeProjectMember,
  setModulePermission,
  listProjectMembers,
  upsertProjectPin,
  type ModuleKey,
  type PermissionLevel,
} from "@/lib/projects.functions";
import { listAllUsers } from "@/lib/admin.functions";
import { toast } from "sonner";
import { Plus, Trash2, Shield } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: () => (
    <AppLayout>
      <AdminPage />
    </AppLayout>
  ),
});

const MODULES: ModuleKey[] = ["bim", "iot", "workflow"];
const MODULE_LABEL: Record<ModuleKey, string> = {
  bim: "BIM",
  iot: "IoT",
  workflow: "Workflow",
};
const EDITABLE_LEVELS: PermissionLevel[] = ["viewer", "editor", "full"];

const PIN_TYPES = [
  "HeadOffice",
  "Warehouse",
  "Factory",
  "Commercial",
  "Residential",
  "Infrastructure",
  "Energy",
  "Hotel",
  "Data Center",
  "Religion Facility",
  "Training Center",
] as const;
const PIN_STATUSES = ["Ongoing", "Operational", "Finished", "Bidding"] as const;

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Parse a coordinate string. Accepts:
 *  - decimal: "13.4342984" or "-13.43"
 *  - DMS single: `13°05'09.3"N` (also accepts ° ' " or ' "" variants, and ,)
 *  - DMS pair: `13°05'09.3"N 100°54'24.6"E` → returns { lat, lng }
 * Returns a number for single, or { lat, lng } for a pair, or null.
 */
function parseCoord(input: string): number | { lat: number; lng: number } | null {
  if (!input) return null;
  const s = input.trim().replace(/[″"]/g, '"').replace(/[′']/g, "'");
  // DMS pair?
  const pairRe = /(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)\D*([NS])[\s,;]+(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)\D*([EW])/i;
  const pm = s.match(pairRe);
  if (pm) {
    const lat = dms(+pm[1], +pm[2], +pm[3], pm[4]);
    const lng = dms(+pm[5], +pm[6], +pm[7], pm[8]);
    return { lat, lng };
  }
  const single = /^\s*(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)\D*([NSEW])\s*$/i;
  const sm = s.match(single);
  if (sm) return dms(+sm[1], +sm[2], +sm[3], sm[4]);
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}
function dms(d: number, m: number, sec: number, hemi: string): number {
  const v = d + m / 60 + sec / 3600;
  return /[SW]/i.test(hemi) ? -v : v;
}

async function reverseGeocodeProvince(lat: number, lng: number): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=en&zoom=8`;
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) return null;
    const j = (await r.json()) as { address?: Record<string, string> };
    const a = j.address ?? {};
    return a.state ?? a.province ?? a.region ?? a.county ?? null;
  } catch {
    return null;
  }
}

function avatarColor(seed: string) {
  const palette = [
    "bg-rose-200 text-rose-900",
    "bg-violet-200 text-violet-900",
    "bg-amber-200 text-amber-900",
    "bg-emerald-200 text-emerald-900",
    "bg-sky-200 text-sky-900",
    "bg-pink-200 text-pink-900",
    "bg-orange-200 text-orange-900",
    "bg-indigo-200 text-indigo-900",
  ];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

function initials(email: string) {
  const name = email.split("@")[0] ?? email;
  const parts = name.split(/[.\-_+]/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function AdminPage() {
  const ctx = useProjectContext();
  const { session, loading: authLoading } = useAuth();
  const qc = useQueryClient();
  const listUsers = useServerFn(listAllUsers);
  const usersQ = useQuery({
    queryKey: ["all-users"],
    queryFn: () => listUsers(),
    enabled: !authLoading && !!session?.access_token && ctx.data?.appRole === "admin",
  });

  const createFn = useServerFn(createProject);
  const renameFn = useServerFn(renameProject);
  const deleteFn = useServerFn(deleteProject);
  const [newName, setNewName] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [pinOn, setPinOn] = useState(false);
  const [pinDraft, setPinDraft] = useState({
    slug: "",
    type: "Commercial",
    status: "Ongoing",
    lat: "",
    lng: "",
    elevation: "",
    province: "",
    weatherStationId: "",
  });

  if (ctx.isLoading) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  if (ctx.data?.appRole !== "admin")
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-sm rounded-lg border border-dashed border-border bg-card p-6 text-center">
          <Shield className="mx-auto h-6 w-6 text-muted-foreground" />
          <h2 className="mt-2 font-semibold">Admin only</h2>
          <p className="mt-1 text-xs text-muted-foreground">You need admin privileges to view this page.</p>
        </div>
      </div>
    );

  const projects = ctx.data.projects;
  const selected = projects.find((p) => p.id === selectedProjectId) ?? projects[0];

  const invalidate = () => qc.invalidateQueries({ queryKey: ["my-context"] });

  return (
    <div className="grid h-full grid-cols-[300px_1fr] gap-0">
      <aside className="border-r border-border bg-card/40 p-4">
        <h2 className="text-sm font-semibold">Projects</h2>
        <form
          className="mt-3 space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!newName.trim()) return;
            try {
              const payload: {
                name: string;
                pin?: {
                  slug: string;
                  type: string;
                  status: string;
                  lat: number;
                  lng: number;
                  elevation?: number;
                  province: string;
                  weatherStationId?: string;
                };
              } = { name: newName.trim() };
              if (pinOn) {
                const lat = parseFloat(pinDraft.lat);
                const lng = parseFloat(pinDraft.lng);
                if (Number.isNaN(lat) || Number.isNaN(lng)) {
                  toast.error("Lat/Lng must be valid numbers");
                  return;
                }
                payload.pin = {
                  slug: pinDraft.slug || slugify(newName),
                  type: pinDraft.type,
                  status: pinDraft.status,
                  lat,
                  lng,
                  elevation: pinDraft.elevation ? parseFloat(pinDraft.elevation) : undefined,
                  province: pinDraft.province || "Unknown",
                  weatherStationId: pinDraft.weatherStationId || undefined,
                };
              }
              const p = await createFn({ data: payload });
              setNewName("");
              setPinOn(false);
              setPinDraft({ slug: "", type: "Commercial", status: "Ongoing", lat: "", lng: "", elevation: "", province: "", weatherStationId: "" });
              await invalidate();
              setSelectedProjectId(p.id);
              toast.success(`Created "${p.name}"`);
            } catch (err) {
              toast.error((err as Error).message);
            }
          }}
        >
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New project name"
              className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs"
            />
            <button className="rounded bg-accent px-2 py-1 text-xs text-accent-foreground" type="submit">
              <Plus className="h-3 w-3" />
            </button>
          </div>
          <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Switch checked={pinOn} onCheckedChange={setPinOn} />
            Add GIS pin
          </label>
          {pinOn && (
            <div className="space-y-1.5 rounded border border-dashed border-border bg-background/40 p-2">
              <PinFieldsForm draft={pinDraft} setDraft={setPinDraft} />
              <p className="text-[10px] text-muted-foreground">Slug auto-derives from name if blank.</p>
            </div>
          )}
        </form>
        <div className="mt-3 space-y-1">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedProjectId(p.id)}
              className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs hover:bg-accent/30 ${
                selected?.id === p.id ? "bg-accent/20" : ""
              }`}
            >
              <span className="truncate">{p.name}</span>
              <Trash2
                className="h-3 w-3 text-muted-foreground hover:text-destructive"
                onClick={async (e) => {
                  e.stopPropagation();
                  if (!confirm(`Delete "${p.name}"?`)) return;
                  await deleteFn({ data: { projectId: p.id } });
                  await invalidate();
                  toast.success("Project deleted");
                }}
              />
            </button>
          ))}
        </div>
      </aside>

      <section className="overflow-auto p-6">
        {!selected ? (
          <p className="text-sm text-muted-foreground">Create a project to get started.</p>
        ) : (
          <ProjectMembersPanel
            projectId={selected.id}
            projectName={selected.name}
            allUsers={usersQ.data ?? []}
            onRename={async (name) => {
              await renameFn({ data: { projectId: selected.id, name } });
              await invalidate();
            }}
          />
        )}
      </section>
    </div>
  );
}

function PinFieldsForm({
  draft,
  setDraft,
}: {
  draft: {
    slug: string;
    type: string;
    status: string;
    lat: string;
    lng: string;
    elevation: string;
    province: string;
    weatherStationId: string;
  };
  setDraft: (next: typeof draft) => void;
}) {
  const set = (k: keyof typeof draft, v: string) => setDraft({ ...draft, [k]: v });
  const fld = "w-full rounded border border-border bg-background px-2 py-1 text-xs";

  // Normalize a coord input: accepts decimal or DMS; if a DMS pair is pasted
  // into either field, fill BOTH lat and lng.
  const onCoordBlur = (which: "lat" | "lng") => () => {
    const parsed = parseCoord(which === "lat" ? draft.lat : draft.lng);
    if (parsed == null) return;
    if (typeof parsed === "number") {
      setDraft({ ...draft, [which]: String(+parsed.toFixed(7)) });
    } else {
      setDraft({
        ...draft,
        lat: String(+parsed.lat.toFixed(7)),
        lng: String(+parsed.lng.toFixed(7)),
      });
    }
  };

  const autoProvince = async () => {
    const lat = parseFloat(draft.lat);
    const lng = parseFloat(draft.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      toast.error("Enter lat/lng first");
      return;
    }
    const p = await reverseGeocodeProvince(lat, lng);
    if (p) setDraft({ ...draft, province: p });
    else toast.error("No province found for that location");
  };

  return (
    <div className="grid grid-cols-2 gap-1.5">
      <input className={fld} placeholder="slug (auto)" value={draft.slug} onChange={(e) => set("slug", e.target.value)} />
      <div className="flex gap-1">
        <input className={fld} placeholder="province" value={draft.province} onChange={(e) => set("province", e.target.value)} />
        <button type="button" onClick={autoProvince} className="shrink-0 rounded border border-border bg-background px-2 text-[10px]" title="Auto-fill province from lat/lng">
          Auto
        </button>
      </div>
      <select className={fld} value={draft.type} onChange={(e) => set("type", e.target.value)}>
        {PIN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      <select className={fld} value={draft.status} onChange={(e) => set("status", e.target.value)}>
        {PIN_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <input
        className={fld}
        placeholder={`lat (13.43 or 13°05'09.3"N)`}
        value={draft.lat}
        onChange={(e) => set("lat", e.target.value)}
        onBlur={onCoordBlur("lat")}
      />
      <input
        className={fld}
        placeholder={`lng (100.06 or 100°54'24.6"E)`}
        value={draft.lng}
        onChange={(e) => set("lng", e.target.value)}
        onBlur={onCoordBlur("lng")}
      />
      <input className={fld} placeholder="elevation (m)" value={draft.elevation} onChange={(e) => set("elevation", e.target.value)} />
      <input className={fld} placeholder="weather station" value={draft.weatherStationId} onChange={(e) => set("weatherStationId", e.target.value)} />
    </div>
  );
}

function ProjectMembersPanel({
  projectId,
  projectName,
  allUsers,
  onRename,
}: {
  projectId: string;
  projectName: string;
  allUsers: { id: string; email: string }[];
  onRename: (name: string) => Promise<void>;
}) {
  const qc = useQueryClient();
  const listMembersFn = useServerFn(listProjectMembers);
  const addMemberFn = useServerFn(addProjectMember);
  const removeMemberFn = useServerFn(removeProjectMember);
  const setPermFn = useServerFn(setModulePermission);
  const upsertPinFn = useServerFn(upsertProjectPin);
  const [name, setName] = useState(projectName);
  const [pinDraft, setPinDraft] = useState({
    slug: "",
    type: "Commercial",
    status: "Ongoing",
    lat: "",
    lng: "",
    elevation: "",
    province: "",
    weatherStationId: "",
  });
  const [pinLoaded, setPinLoaded] = useState(false);

  const pinQ = useQuery({
    queryKey: ["gis-pin", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gis_pins")
        .select("slug, type, status, lat, lng, elevation, province, weather_station_id")
        .eq("project_id", projectId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });

  useEffect(() => {
    setName(projectName);
    setPinLoaded(false);
  }, [projectId, projectName]);

  useEffect(() => {
    if (pinQ.data && !pinLoaded) {
      setPinDraft({
        slug: pinQ.data.slug ?? "",
        type: pinQ.data.type ?? "Commercial",
        status: pinQ.data.status ?? "Ongoing",
        lat: String(pinQ.data.lat ?? ""),
        lng: String(pinQ.data.lng ?? ""),
        elevation: String(pinQ.data.elevation ?? ""),
        province: pinQ.data.province ?? "",
        weatherStationId: pinQ.data.weather_station_id ?? "",
      });
      setPinLoaded(true);
    } else if (!pinQ.data && pinQ.isFetched && !pinLoaded) {
      setPinDraft({ slug: "", type: "Commercial", status: "Ongoing", lat: "", lng: "", elevation: "", province: "", weatherStationId: "" });
      setPinLoaded(true);
    }
  }, [pinQ.data, pinQ.isFetched, pinLoaded]);

  const membersQ = useQuery({
    queryKey: ["project-members", projectId],
    queryFn: () => listMembersFn({ data: { projectId } }),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["project-members", projectId] });

  const membersByUser = new Map(
    (membersQ.data ?? []).map((m) => [m.userId, m] as const),
  );

  async function toggleModule(userId: string, mod: ModuleKey, on: boolean) {
    try {
      const member = membersByUser.get(userId);
      if (on) {
        if (!member) {
          await addMemberFn({ data: { projectId, userId } });
        }
        await setPermFn({
          data: { projectId, userId, module: mod, level: "editor" },
        });
      } else {
        await setPermFn({
          data: { projectId, userId, module: mod, level: null },
        });
        // If user now has zero perms, remove them as a member entirely.
        const remaining = MODULES.filter(
          (m) => m !== mod && member?.modules[m],
        );
        if (member && remaining.length === 0) {
          await removeMemberFn({ data: { projectId, userId } });
        }
      }
      await refresh();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function changeLevel(
    userId: string,
    mod: ModuleKey,
    level: PermissionLevel,
  ) {
    try {
      await setPermFn({ data: { projectId, userId, module: mod, level } });
      await refresh();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Project name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-sm"
          />
        </div>
        <button
          onClick={async () => {
            await onRename(name);
            toast.success("Renamed");
          }}
          className="rounded bg-accent px-3 py-1.5 text-xs text-accent-foreground"
        >
          Save
        </button>
      </div>

      <div className="rounded-lg border border-border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold">GIS Pin</h3>
            <p className="text-xs text-muted-foreground">
              {pinQ.data ? "Linked pin — edit and save to update." : "No pin yet — fill in fields and save to create one."}
            </p>
          </div>
          <button
            disabled={!pinLoaded}
            onClick={async () => {
              const lat = parseFloat(pinDraft.lat);
              const lng = parseFloat(pinDraft.lng);
              if (Number.isNaN(lat) || Number.isNaN(lng)) {
                toast.error("Lat/Lng must be valid numbers");
                return;
              }
              try {
                await upsertPinFn({
                  data: {
                    projectId,
                    slug: pinDraft.slug || projectId.slice(0, 8),
                    type: pinDraft.type,
                    status: pinDraft.status,
                    lat,
                    lng,
                    elevation: pinDraft.elevation ? parseFloat(pinDraft.elevation) : undefined,
                    province: pinDraft.province || "Unknown",
                    weatherStationId: pinDraft.weatherStationId || undefined,
                  },
                });
                await qc.invalidateQueries({ queryKey: ["gis-pin", projectId] });
                toast.success("Pin saved");
              } catch (err) {
                toast.error((err as Error).message);
              }
            }}
            className="rounded bg-accent px-3 py-1.5 text-xs text-accent-foreground disabled:opacity-50"
          >
            Save pin
          </button>
        </div>
        <div className="mt-3">
          <PinFieldsForm draft={pinDraft} setDraft={setPinDraft} />
        </div>
      </div>

      <div>
        <h3 className="text-2xl font-semibold tracking-tight">Members</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Toggle module access for each user. Turning a switch on grants{" "}
          <span className="font-medium">editor</span> by default — use the
          level picker to change it.
        </p>

        <div className="mt-6 overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="w-[40%] px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Name
                </th>
                {MODULES.map((m) => (
                  <th
                    key={m}
                    className="px-4 py-3 text-center text-sm font-bold"
                  >
                    {MODULE_LABEL[m]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allUsers.length === 0 && (
                <tr>
                  <td
                    colSpan={MODULES.length + 1}
                    className="px-4 py-6 text-center text-xs text-muted-foreground"
                  >
                    No users found.
                  </td>
                </tr>
              )}
              {allUsers.map((u) => {
                const member = membersByUser.get(u.id);
                return (
                  <tr key={u.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold ${avatarColor(u.id)}`}
                        >
                          {initials(u.email)}
                        </div>
                        <span className="truncate text-sm">{u.email}</span>
                      </div>
                    </td>
                    {MODULES.map((mod) => {
                      const level = member?.modules[mod] ?? null;
                      const on = level !== null;
                      return (
                        <td key={mod} className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <Switch
                              checked={on}
                              onCheckedChange={(v) => toggleModule(u.id, mod, v)}
                            />
                            {on && (
                              <Select
                                value={level ?? "editor"}
                                onValueChange={(v) =>
                                  changeLevel(u.id, mod, v as PermissionLevel)
                                }
                              >
                                <SelectTrigger className="h-7 w-[88px] text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {EDITABLE_LEVELS.map((l) => (
                                    <SelectItem key={l} value={l} className="text-xs">
                                      {l}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}