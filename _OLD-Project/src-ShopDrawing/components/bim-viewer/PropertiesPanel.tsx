import { useState, useEffect, useMemo } from "react";
import { useDigitalTwinStore } from "@/store/useDigitalTwinStore";
import { X, Radio, PanelRightClose, Search, Copy, ChevronDown, ChevronRight, BookmarkPlus } from "lucide-react";
import { useCanEdit } from "@/hooks/useCanEdit";
import { toast } from "sonner";

export function PropertiesPanel({ onCollapse }: { onCollapse?: () => void }) {
  const selectedId = useDigitalTwinStore((s) => s.selectedElementId);
  const selectedIds = useDigitalTwinStore((s) => s.selectedElementIds);
  const model = useDigitalTwinStore((s) => s.activeIfcModel);
  const select = useDigitalTwinStore((s) => s.selectElement);
  const setElementMqtt = useDigitalTwinStore((s) => s.setElementMqtt);
  const saveSelectionSet = useDigitalTwinStore((s) => s.saveSelectionSet);
  const alert = useDigitalTwinStore((s) => (selectedId ? s.alertStates[selectedId] : undefined));
  const elementsById = useMemo(() => {
    type El = NonNullable<typeof model>["elements"][number];
    const m = new Map<string, El>();
    if (model) for (const el of model.elements) m.set(el.id, el);
    return m;
  }, [model]);
  const el = selectedId ? elementsById.get(selectedId) ?? null : null;
  const [topicDraft, setTopicDraft] = useState("");
  const [query, setQuery] = useState("");
  const canEdit = useCanEdit();
  const multi = selectedIds.length > 1;

  useEffect(() => {
    setTopicDraft(el?.mqttTopic ?? "");
  }, [el?.id, el?.mqttTopic]);

  return (
    <div className="flex-1 min-h-0 overflow-auto">
      <div className="flex items-center justify-between border-b border-border px-4 py-3 sticky top-0 bg-card z-10">
        <h3 className="text-sm font-semibold">
          Properties
          {multi && (
            <span className="ml-2 rounded bg-accent/20 px-1.5 py-0.5 text-[10px] font-medium text-accent">
              {selectedIds.length} selected
            </span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          {multi && (
            <button
              onClick={() => {
                const name = window.prompt("Selection set name?", `Set ${Date.now().toString(36).slice(-4)}`);
                if (!name) return;
                saveSelectionSet(name);
                toast.success(`Saved set "${name}"`);
              }}
              className="text-muted-foreground hover:text-foreground"
              title="Save selection as set"
            >
              <BookmarkPlus className="h-4 w-4" />
            </button>
          )}
          {el && (
            <button onClick={() => select(null)} className="text-muted-foreground hover:text-foreground" title="Clear selection">
              <X className="h-4 w-4" />
            </button>
          )}
          {onCollapse && (
            <button onClick={onCollapse} className="text-muted-foreground hover:text-foreground" title="Collapse properties panel">
              <PanelRightClose className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      {multi ? (
        <MultiSelectionSummary />
      ) : !el ? (
        <ItemsList />
      ) : (
        <div className="text-xs">
          {alert && (
            <div className="m-3 rounded-md border border-destructive/40 bg-destructive/10 p-2.5">
              <p className="font-semibold text-destructive">{alert.level === "critical" ? "Critical" : "Warning"}</p>
              <p className="mt-1 text-foreground/80">{alert.message}</p>
            </div>
          )}
          <div className="sticky top-12 z-[5] flex items-center gap-2 border-b border-border bg-card px-3 py-2">
            <Search className="h-3 w-3 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter properties…"
              className="flex-1 bg-transparent text-[11px] outline-none placeholder:text-muted-foreground"
            />
            {query && (
              <button onClick={() => setQuery("")} className="text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <PropertyTable groups={buildGroups(el)} query={query} />
          {canEdit && (
            <div className="m-3 rounded-md bg-muted p-3 space-y-2">
              <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                <Radio className="h-3 w-3" /> Tag / Reference
              </p>
              <input
                value={topicDraft}
                onChange={(e) => setTopicDraft(e.target.value)}
                placeholder="zone/area/equipment-id"
                className="w-full rounded border border-border bg-background px-2 py-1 font-mono text-[11px] outline-none focus:border-accent"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setElementMqtt(el.id, topicDraft.trim() || null)}
                  className="flex-1 rounded bg-accent px-2 py-1 text-[11px] font-medium text-accent-foreground hover:opacity-90"
                >
                  Save tag
                </button>
                {el.mqttTopic && (
                  <button
                    onClick={() => {
                      setElementMqtt(el.id, null);
                      setTopicDraft("");
                    }}
                    className="rounded border border-border px-2 py-1 text-[11px] hover:bg-background"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type PropRow = { key: string; value: string };
type PropGroup = { title: string; rows: PropRow[] };

function buildGroups(el: NonNullable<ReturnType<typeof useDigitalTwinStore.getState>["activeIfcModel"]>["elements"][number]): PropGroup[] {
  const identity: PropRow[] = [
    { key: "Name", value: el.name },
    { key: "Category", value: el.type },
    { key: "Id", value: el.id },
  ];
  const geometry: PropRow[] = [
    { key: "Position X", value: el.position[0].toFixed(3) },
    { key: "Position Y", value: el.position[1].toFixed(3) },
    { key: "Position Z", value: el.position[2].toFixed(3) },
    { key: "Size X", value: el.size[0].toFixed(3) },
    { key: "Size Y", value: el.size[1].toFixed(3) },
    { key: "Size Z", value: el.size[2].toFixed(3) },
  ];
  const byGroup = new Map<string, PropRow[]>();
  for (const [k, v] of Object.entries(el.properties)) {
    const dot = k.indexOf(".");
    const group = dot > 0 ? k.slice(0, dot) : "Attributes";
    const key = dot > 0 ? k.slice(dot + 1) : k;
    if (!byGroup.has(group)) byGroup.set(group, []);
    const display =
      v === null || v === undefined || (typeof v === "string" && v.trim() === "")
        ? "—"
        : String(v);
    byGroup.get(group)!.push({ key, value: display });
  }
  const groups: PropGroup[] = [
    { title: "Identity", rows: identity },
    ...Array.from(byGroup.entries()).map(([title, rows]) => ({ title, rows })),
    { title: "Geometry", rows: geometry },
  ];
  if (el.mqttTopic) {
    groups.push({ title: "Tag", rows: [{ key: "Reference", value: el.mqttTopic }] });
  }
  return groups;
}

function PropertyTable({ groups, query }: { groups: PropGroup[]; query: string }) {
  const q = query.trim().toLowerCase();
  const filtered = q
    ? groups
        .map((g) => ({
          ...g,
          rows: g.rows.filter(
            (r) => r.key.toLowerCase().includes(q) || r.value.toLowerCase().includes(q),
          ),
        }))
        .filter((g) => g.rows.length > 0)
    : groups;
  return (
    <div className="border-b border-border">
      <div className="grid grid-cols-[1fr_1.2fr] border-b border-border bg-muted/60 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span>Property</span>
        <span>Value</span>
      </div>
      {filtered.map((g) => (
        <CollapsibleGroup key={g.title} group={g} forceOpen={q.length > 0} />
      ))}
      {filtered.length === 0 && (
        <p className="px-3 py-3 text-[11px] italic text-muted-foreground">
          No properties match "{query}".
        </p>
      )}
    </div>
  );
}

function CollapsibleGroup({ group, forceOpen }: { group: PropGroup; forceOpen: boolean }) {
  const [open, setOpen] = useState(true);
  const isOpen = forceOpen || open;
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1 bg-muted/40 px-2 py-1 text-[11px] font-semibold text-foreground/90 hover:bg-muted/60"
      >
        {isOpen ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
        <span>{group.title}</span>
        <span className="ml-auto font-mono text-[10px] text-muted-foreground">{group.rows.length}</span>
      </button>
      {isOpen &&
        group.rows.map((r) => (
          <div
            key={r.key}
            className="group grid grid-cols-[1fr_1.2fr_auto] items-center gap-2 border-b border-border/40 px-2 py-1 hover:bg-muted/30"
          >
            <span className="truncate text-accent" title={r.key}>{r.key}</span>
            <span className="truncate font-mono text-[11px] text-foreground" title={r.value}>
              {r.value}
            </span>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(r.value);
                  toast.success("Copied");
                } catch {
                  toast.error("Copy failed");
                }
              }}
              className="opacity-0 transition-opacity group-hover:opacity-100 text-muted-foreground hover:text-foreground"
              title="Copy value"
            >
              <Copy className="h-3 w-3" />
            </button>
          </div>
        ))}
    </div>
  );
}

function MultiSelectionSummary() {
  const ids = useDigitalTwinStore((s) => s.selectedElementIds);
  const model = useDigitalTwinStore((s) => s.activeIfcModel);
  const select = useDigitalTwinStore((s) => s.selectElement);
  const toggle = useDigitalTwinStore((s) => s.toggleSelectedElement);
  const elementsById = useMemo(() => {
    type El = NonNullable<typeof model>["elements"][number];
    const m = new Map<string, El>();
    if (model) for (const el of model.elements) m.set(el.id, el);
    return m;
  }, [model]);
  const byCat = new Map<string, number>();
  for (const id of ids) {
    const el = elementsById.get(id);
    const cat = el?.type ?? "Unknown";
    byCat.set(cat, (byCat.get(cat) ?? 0) + 1);
  }
  return (
    <div className="p-3 space-y-3 text-xs">
      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">By category</p>
        <div className="space-y-1">
          {Array.from(byCat.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([cat, n]) => (
              <div key={cat} className="flex justify-between rounded bg-muted/40 px-2 py-1">
                <span className="truncate">{cat}</span>
                <span className="font-mono text-[10px] text-muted-foreground">{n}</span>
              </div>
            ))}
        </div>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{ids.length} elements</p>
        <div className="max-h-[40vh] space-y-1 overflow-auto pr-1">
          {ids.slice(0, 100).map((id) => {
            const el = elementsById.get(id);
            return (
              <div key={id} className="flex items-center gap-1 rounded border border-border/60 bg-background px-2 py-1">
                <button onClick={() => select(id)} className="flex-1 truncate text-left text-[11px] hover:text-accent" title="Make primary">
                  {el?.name ?? id}
                </button>
                <button onClick={() => toggle(id, true)} className="text-muted-foreground hover:text-destructive" title="Remove from selection">
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
          {ids.length > 100 && (
            <p className="text-[10px] italic text-muted-foreground">+{ids.length - 100} more…</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ItemsList() {
  const model = useDigitalTwinStore((s) => s.activeIfcModel);
  const select = useDigitalTwinStore((s) => s.selectElement);
  const [q, setQ] = useState("");
  if (!model) return <p className="p-4 text-xs text-muted-foreground">No model loaded.</p>;
  const filtered = model.elements.filter(
    (e) => !q || e.name.toLowerCase().includes(q.toLowerCase()) || e.id.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <div className="p-3 space-y-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {model.elements.length} items
      </p>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search items…"
        className="w-full rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:border-accent"
      />
      <div className="max-h-[70vh] space-y-1 overflow-auto pr-1">
        {filtered.slice(0, 200).map((e) => (
          <button
            key={e.id}
            onClick={() => select(e.id)}
            className="flex w-full items-center justify-between rounded border border-border/60 bg-background px-2 py-1.5 text-left text-xs hover:border-accent"
          >
            <span className="truncate">{e.name}</span>
            {e.mqttTopic && <Radio className="h-3 w-3 shrink-0 text-accent" />}
          </button>
        ))}
        {filtered.length === 0 && <p className="text-xs text-muted-foreground">No matches.</p>}
      </div>
    </div>
  );
}
