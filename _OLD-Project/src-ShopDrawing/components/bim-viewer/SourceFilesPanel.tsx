import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Eye, EyeOff, Trash2 } from "lucide-react";
import { useDigitalTwinStore, getElementLevel } from "@/store/useDigitalTwinStore";
import { BimUpload } from "./BimUpload";
import { ModelTree } from "./ModelTree";
import { useCanEdit } from "@/hooks/useCanEdit";
import { supabase } from "@/integrations/supabase/client";
import { deleteBimFiles } from "@/lib/bimStorage";
import { toast } from "sonner";

export function SourceFilesPanel() {
  const models = useDigitalTwinStore((s) => s.models);
  const toggleModel = useDigitalTwinStore((s) => s.toggleModelVisible);
  const setAllModels = useDigitalTwinStore((s) => s.setAllModelsVisible);
  const removeModel = useDigitalTwinStore((s) => s.removeModel);
  const hiddenCategories = useDigitalTwinStore((s) => s.hiddenCategories);
  const toggleCategory = useDigitalTwinStore((s) => s.toggleCategory);
  const setAllCategories = useDigitalTwinStore((s) => s.setAllCategoriesVisible);
  const hiddenLevels = useDigitalTwinStore((s) => s.hiddenLevels);
  const toggleLevel = useDigitalTwinStore((s) => s.toggleLevel);
  const setAllLevels = useDigitalTwinStore((s) => s.setAllLevelsVisible);
  const projectId = useDigitalTwinStore((s) => s.activeProjectId);
  const canEdit = useCanEdit();

  const [filesOpen, setFilesOpen] = useState(true);
  const [catsOpen, setCatsOpen] = useState(true);
  const [levelsOpen, setLevelsOpen] = useState(true);
  const [showAllFiles, setShowAllFiles] = useState(false);
  const [showAllCats, setShowAllCats] = useState(false);
  const [showAllLevels, setShowAllLevels] = useState(false);

  const visibleCount = models.filter((m) => m.visible).length;
  const allVisible = models.length > 0 && visibleCount === models.length;

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of models) for (const el of m.elements) counts.set(el.type, (counts.get(el.type) ?? 0) + 1);
    return Array.from(counts.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }));
  }, [models]);

  const visibleCatCount = categories.filter((c) => !hiddenCategories[c.name]).length;
  const allCatsVisible = categories.length > 0 && visibleCatCount === categories.length;

  const levels = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of models) for (const el of m.elements) counts.set(getElementLevel(el), (counts.get(getElementLevel(el)) ?? 0) + 1);
    return Array.from(counts.entries())
      .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
      .map(([name, count]) => ({ name, count }));
  }, [models]);

  const visibleLevelCount = levels.filter((l) => !hiddenLevels[l.name]).length;
  const allLevelsVisible = levels.length > 0 && visibleLevelCount === levels.length;

  const displayedFiles = showAllFiles ? models : models.slice(0, 3);
  const displayedCats = showAllCats ? categories : categories.slice(0, 5);
  const displayedLevels = showAllLevels ? levels : levels.slice(0, 5);

  async function onRemove(modelId: string, storagePath?: string) {
    if (!projectId) return;
    if (!confirm("Remove this model? This deletes the database row, cached fragments, and all storage files.")) return;
    removeModel(modelId);
    try {
      const { data: row } = await supabase
        .from("bim_models")
        .select("ifc_path, fragments_path, properties_path")
        .eq("id", modelId)
        .maybeSingle();
      const paths = new Set<string>();
      if (row?.ifc_path) paths.add(row.ifc_path);
      if (row?.fragments_path) paths.add(row.fragments_path);
      if (row?.properties_path) paths.add(row.properties_path);
      if (storagePath) paths.add(storagePath);

      // sweep any stray files for this model under the project folder
      try {
        const { data: listed } = await supabase.storage
          .from("bim-files")
          .list(projectId, { limit: 1000 });
        listed?.forEach((f) => {
          if (f.name.startsWith(modelId)) paths.add(`${projectId}/${f.name}`);
        });
      } catch (err) {
        console.warn("[bim] list storage failed", err);
      }

      const { error: delErr } = await supabase.from("bim_models").delete().eq("id", modelId);
      if (delErr) throw delErr;
      if (paths.size) await deleteBimFiles(Array.from(paths));
      toast.success("Model removed");
    } catch (err) {
      console.error(err);
      toast.error(`Couldn't remove: ${(err as Error).message}`);
    }
  }

  return (
    <div className="border-b border-border bg-card">
      <Section
        title="SOURCE FILES"
        open={filesOpen}
        onToggle={() => setFilesOpen((v) => !v)}
        action={canEdit ? <BimUpload compact /> : null}
      >
        <Row
          label="ALL"
          count={`(${visibleCount} of ${models.length})`}
          checked={allVisible}
          indeterminate={visibleCount > 0 && !allVisible}
          onToggle={() => setAllModels(!allVisible)}
          emphasized
          disabled={models.length === 0}
        />
        {displayedFiles.map((m) => (
          <Row
            key={m.id}
            label={truncate(m.name, 28)}
            count={m.elements.length || undefined}
            checked={m.visible}
            onToggle={() => toggleModel(m.id)}
            trailing={
              canEdit ? (
                <button
                  onClick={() => onRemove(m.id, m.storagePath)}
                  className="text-muted-foreground/60 hover:text-destructive"
                  title="Remove model"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              ) : null
            }
          />
        ))}
        {models.length === 0 && (
          <p className="px-3 py-2 text-[11px] italic text-muted-foreground">
            No models yet. Import a .ifc or .frag file.
          </p>
        )}
        {models.length > 3 && <MoreToggle expanded={showAllFiles} onClick={() => setShowAllFiles((v) => !v)} />}
      </Section>

      <Section title="CATEGORIES" open={catsOpen} onToggle={() => setCatsOpen((v) => !v)}>
        <Row
          label="ALL"
          count={`(${visibleCatCount} of ${categories.length})`}
          checked={allCatsVisible}
          indeterminate={visibleCatCount > 0 && !allCatsVisible}
          onToggle={() => setAllCategories(!allCatsVisible)}
          emphasized
          disabled={categories.length === 0}
        />
        {displayedCats.map((c) => (
          <Row
            key={c.name}
            label={c.name}
            count={c.count}
            checked={!hiddenCategories[c.name]}
            onToggle={() => toggleCategory(c.name)}
          />
        ))}
        {categories.length === 0 && (
          <p className="px-3 py-2 text-[11px] italic text-muted-foreground">No categories detected.</p>
        )}
        {categories.length > 5 && <MoreToggle expanded={showAllCats} onClick={() => setShowAllCats((v) => !v)} />}
      </Section>

      <Section title="LEVELS" open={levelsOpen} onToggle={() => setLevelsOpen((v) => !v)}>
        <Row
          label="ALL"
          count={`(${visibleLevelCount} of ${levels.length})`}
          checked={allLevelsVisible}
          indeterminate={visibleLevelCount > 0 && !allLevelsVisible}
          onToggle={() => setAllLevels(!allLevelsVisible)}
          emphasized
          disabled={levels.length === 0}
        />
        {displayedLevels.map((l) => (
          <Row
            key={l.name}
            label={l.name}
            count={l.count}
            checked={!hiddenLevels[l.name]}
            onToggle={() => toggleLevel(l.name)}
          />
        ))}
        {levels.length === 0 && (
          <p className="px-3 py-2 text-[11px] italic text-muted-foreground">No levels detected.</p>
        )}
        {levels.length > 5 && <MoreToggle expanded={showAllLevels} onClick={() => setShowAllLevels((v) => !v)} />}
      </Section>

      <ModelTree />
    </div>
  );
}

function Section({
  title,
  open,
  onToggle,
  action,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-border last:border-b-0">
      <div className="flex items-center justify-between px-3 py-2">
        <button
          onClick={onToggle}
          className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-foreground/80 hover:text-foreground"
        >
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          {title}
        </button>
        {action}
      </div>
      {open && <div className="pb-1">{children}</div>}
    </div>
  );
}

function Row({
  label,
  count,
  checked,
  indeterminate,
  emphasized,
  disabled,
  trailing,
  onToggle,
}: {
  label: string;
  count?: number | string;
  checked: boolean;
  indeterminate?: boolean;
  emphasized?: boolean;
  disabled?: boolean;
  trailing?: React.ReactNode;
  onToggle: () => void;
}) {
  return (
    <div className={`group flex items-center gap-2 px-3 py-1 text-xs ${disabled ? "opacity-40" : "hover:bg-muted/50"}`}>
      <button
        onClick={() => !disabled && onToggle()}
        disabled={disabled}
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border ${
          checked ? "border-accent bg-accent text-accent-foreground" : "border-border bg-background"
        }`}
        aria-label={checked ? "Hide" : "Show"}
      >
        {checked && !indeterminate && <CheckIcon />}
        {indeterminate && <span className="h-0.5 w-2 bg-accent-foreground" />}
      </button>
      <span
        className={`flex-1 truncate ${emphasized ? "font-semibold" : "font-normal"} ${!checked && !disabled ? "text-muted-foreground" : ""}`}
        title={label}
      >
        {label}
      </span>
      {count !== undefined && (
        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{count}</span>
      )}
      {trailing && <span className="shrink-0">{trailing}</span>}
      {checked ? (
        <Eye className="hidden h-3 w-3 text-muted-foreground/40 group-hover:block" />
      ) : (
        <EyeOff className="hidden h-3 w-3 text-muted-foreground/40 group-hover:block" />
      )}
    </div>
  );
}

function MoreToggle({ expanded, onClick }: { expanded: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-center gap-1 py-1 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
    >
      {expanded ? "less" : "more"}
      <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
    </button>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M3 8.5l3.5 3.5L13 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function truncate(s: string, n: number) {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}
