import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Box as BoxIcon } from "lucide-react";
import { useDigitalTwinStore, getElementLevel } from "@/store/useDigitalTwinStore";

/**
 * Spatial hierarchy: Project → (per-model) → Level → Category → Element.
 * Click any element to select it; the existing FRAG highlight + properties
 * panel takes over from there.
 */
export function ModelTree() {
  const models = useDigitalTwinStore((s) => s.models);
  const select = useDigitalTwinStore((s) => s.selectElement);
  const selectedId = useDigitalTwinStore((s) => s.selectedElementId);
  const requestFocus = useDigitalTwinStore((s) => s.requestFocus);
  const [open, setOpen] = useState(true);
  const [openModels, setOpenModels] = useState<Record<string, boolean>>({});
  const [openLevels, setOpenLevels] = useState<Record<string, boolean>>({});
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({});

  const tree = useMemo(() => {
    return models.map((m) => {
      const byLevel = new Map<string, Map<string, { id: string; name: string }[]>>();
      for (const el of m.elements) {
        const lvl = getElementLevel(el);
        if (!byLevel.has(lvl)) byLevel.set(lvl, new Map());
        const byCat = byLevel.get(lvl)!;
        if (!byCat.has(el.type)) byCat.set(el.type, []);
        byCat.get(el.type)!.push({ id: el.id, name: el.name });
      }
      return { model: m, byLevel };
    });
  }, [models]);

  if (models.length === 0) return null;

  return (
    <div className="border-b border-border bg-card">
      <div className="flex items-center justify-between px-3 py-2">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-foreground/80 hover:text-foreground"
        >
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          Model Tree
        </button>
      </div>
      {open && (
        <div className="max-h-72 overflow-auto pb-2 text-xs">
          {tree.map(({ model, byLevel }) => {
            const mKey = model.id;
            const mOpen = openModels[mKey] ?? true;
            return (
              <div key={mKey}>
                <TreeRow
                  depth={0}
                  open={mOpen}
                  hasChildren
                  onToggle={() => setOpenModels((s) => ({ ...s, [mKey]: !mOpen }))}
                  label={model.name}
                  count={model.elements.length}
                  emphasized
                />
                {mOpen &&
                  Array.from(byLevel.entries())
                    .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
                    .map(([lvl, byCat]) => {
                      const lKey = `${mKey}::${lvl}`;
                      const lOpen = openLevels[lKey] ?? false;
                      const lvlCount = Array.from(byCat.values()).reduce((s, a) => s + a.length, 0);
                      return (
                        <div key={lKey}>
                          <TreeRow
                            depth={1}
                            open={lOpen}
                            hasChildren
                            onToggle={() => setOpenLevels((s) => ({ ...s, [lKey]: !lOpen }))}
                            label={lvl}
                            count={lvlCount}
                          />
                          {lOpen &&
                            Array.from(byCat.entries())
                              .sort((a, b) => a[0].localeCompare(b[0]))
                              .map(([cat, items]) => {
                                const cKey = `${lKey}::${cat}`;
                                const cOpen = openCats[cKey] ?? false;
                                return (
                                  <div key={cKey}>
                                    <TreeRow
                                      depth={2}
                                      open={cOpen}
                                      hasChildren
                                      onToggle={() =>
                                        setOpenCats((s) => ({ ...s, [cKey]: !cOpen }))
                                      }
                                      label={cat}
                                      count={items.length}
                                    />
                                    {cOpen &&
                                      items.slice(0, 200).map((it) => (
                                        <button
                                          key={it.id}
                                          onClick={() => {
                                            select(it.id);
                                            requestFocus(it.id);
                                          }}
                                          className={`flex w-full items-center gap-1 px-3 py-0.5 pl-[52px] text-left text-[11px] hover:bg-muted/50 ${
                                            selectedId === it.id
                                              ? "bg-accent/20 text-accent"
                                              : "text-muted-foreground"
                                          }`}
                                        >
                                          <BoxIcon className="h-3 w-3 shrink-0" />
                                          <span className="truncate">{it.name}</span>
                                        </button>
                                      ))}
                                    {cOpen && items.length > 200 && (
                                      <p className="pl-[52px] text-[10px] italic text-muted-foreground">
                                        +{items.length - 200} more (truncated)
                                      </p>
                                    )}
                                  </div>
                                );
                              })}
                        </div>
                      );
                    })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TreeRow({
  depth,
  open,
  hasChildren,
  onToggle,
  label,
  count,
  emphasized,
}: {
  depth: number;
  open: boolean;
  hasChildren: boolean;
  onToggle: () => void;
  label: string;
  count?: number;
  emphasized?: boolean;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex w-full items-center gap-1 py-1 pr-3 text-left hover:bg-muted/50"
      style={{ paddingLeft: 12 + depth * 14 }}
    >
      {hasChildren ? (
        open ? (
          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
        )
      ) : (
        <span className="w-3" />
      )}
      <span className={`flex-1 truncate ${emphasized ? "font-semibold" : ""}`}>{label}</span>
      {count !== undefined && (
        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{count}</span>
      )}
    </button>
  );
}