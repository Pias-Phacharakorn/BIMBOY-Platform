import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import { appIcons } from "../../globals";
import { ClashImport } from "../../bim-components";

export interface ClashFilterSectionState {
  components: OBC.Components;
  clashTable: HTMLElement;
}

export const clashFilterSectionTemplate: BUI.StatefullComponent<
  ClashFilterSectionState
> = (state, update) => {
  const { components, clashTable } = state;
  const clashReport = components.get(ClashImport);

  // ── Initialise listeners once ─────────────────────────────────────────────
  const s = state as ClashFilterSectionState & { _cfInit?: boolean };

  const onCreated = (e?: Element) => {
    if (!e || s._cfInit) return;
    s._cfInit = true;
    clashTable.addEventListener("dataloaded", () => update());
    document.addEventListener("clash-filters-changed", () => update());
  };

  // ── Derive display data from live list ────────────────────────────────────
  const hasData = clashReport.list.length > 0;
  const statuses = [...new Set(clashReport.list.map((c) => c.status).filter(Boolean))];
  const types    = [...new Set(clashReport.list.map((c) => c.type).filter(Boolean))];

  // ── Filter helpers ─────────────────────────────────────────────────────────
  const onSearch = (e: Event) => {
    const q = (e.target as HTMLInputElement).value;
    clashReport.setFilters(q, clashReport.selectedStatus, clashReport.selectedType);
  };

  const onStatusChip = (status: string) => {
    const next = clashReport.selectedStatus === status ? "" : status;
    clashReport.setFilters(clashReport.searchQuery, next, clashReport.selectedType);
  };

  const onTypeChip = (type: string) => {
    const next = clashReport.selectedType === type ? "" : type;
    clashReport.setFilters(clashReport.searchQuery, clashReport.selectedStatus, next);
  };

  const hasActiveFilters = !!(
    clashReport.searchQuery || clashReport.selectedStatus || clashReport.selectedType
  );

  // ── Status / type chip CSS modifier ───────────────────────────────────────
  const statusCls = (s: string) => {
    const v = s.toLowerCase();
    if (v === "new" || v.includes("active")) return "cf-chip--new";
    if (v === "unresolved")                   return "cf-chip--unres";
    if (v.includes("resolved") || v.includes("approved")) return "cf-chip--res";
    return "";
  };

  const typeCls = (t: string) => {
    const v = t.toLowerCase().replace(".", "").trim();
    if (v === "major") return "cf-chip--major";
    if (v === "minor") return "cf-chip--minor";
    return "";
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return BUI.html`
    <bim-panel-section ${BUI.ref(onCreated)} fixed icon=${appIcons.FILTER} label="Clash Filter">
      <div class="cf-panel">

        ${hasData ? BUI.html`

          <!-- ── Search ──────────────────────────────────────────────────── -->
          <div class="cf-group">
            <div class="cf-group-label">Search</div>
            <input
              type="text"
              class="cf-search"
              placeholder="ID, Name or Markup…"
              .value=${clashReport.searchQuery}
              @input=${onSearch}
            >
          </div>

          <!-- ── Status ──────────────────────────────────────────────────── -->
          <div class="cf-group cf-group--sep">
            <div class="cf-group-header">
              <div class="cf-group-label">Status</div>
              <button
                class="cf-clear-btn"
                @click=${() => clashReport.setFilters(clashReport.searchQuery, "", clashReport.selectedType)}
              >Clear</button>
            </div>
            <div class="cf-chips">
              ${statuses.map((s) => {
                const isActive = clashReport.selectedStatus === s;
                const label    = s.replace(".", "").replace("Approved as Noted", "Approved");
                const cls      = `cf-chip ${statusCls(s)} ${isActive ? "cf-chip--active" : ""}`.trim();
                return BUI.html`
                  <button class=${cls} @click=${() => onStatusChip(s)}>${label}</button>
                `;
              })}
            </div>
          </div>

          <!-- ── Type ────────────────────────────────────────────────────── -->
          <div class="cf-group cf-group--sep">
            <div class="cf-group-header">
              <div class="cf-group-label">Type</div>
              <button
                class="cf-clear-btn"
                @click=${() => clashReport.setFilters(clashReport.searchQuery, clashReport.selectedStatus, "")}
              >Clear</button>
            </div>
            <div class="cf-chips">
              ${types.map((t) => {
                const isActive = clashReport.selectedType === t;
                const cls      = `cf-chip ${typeCls(t)} ${isActive ? "cf-chip--active" : ""}`.trim();
                return BUI.html`
                  <button class=${cls} @click=${() => onTypeChip(t)}>${t.replace(".", "")}</button>
                `;
              })}
            </div>
          </div>

          <!-- ── Reset all ────────────────────────────────────────────────── -->
          ${hasActiveFilters ? BUI.html`
            <button
              class="cf-reset-btn"
              @click=${() => clashReport.setFilters("", "", "")}
            >⟲ Reset All Filters</button>
          ` : ""}

        ` : BUI.html`
          <div class="cf-empty">Please load a report first</div>
        `}

      </div>
    </bim-panel-section>
  `;
};
