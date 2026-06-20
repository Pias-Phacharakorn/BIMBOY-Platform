// @ts-nocheck
import * as BUI from "@thatopen/ui";
import { ClashData } from "../../../../bim-components";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function countWhere(list: ClashData[], pred: (c: ClashData) => boolean): number {
  return list.filter(pred).length;
}

function normalizeStatus(s: string): string {
  return s.toLowerCase().replace(".", "").replace("approved as noted", "approved").trim();
}

function normalizeType(t: string): string {
  return t.toLowerCase().replace(".", "").trim();
}

// ─── Sub-renders ──────────────────────────────────────────────────────────────

const renderStatCards = (list: ClashData[]) => {
  const total      = list.length;
  const newCount   = countWhere(list, c => normalizeStatus(c.status) === "new" || normalizeStatus(c.status).includes("active"));
  const unresolved = countWhere(list, c => normalizeStatus(c.status) === "unresolved");
  const resolved   = countWhere(list, c => normalizeStatus(c.status).includes("resolved") || normalizeStatus(c.status).includes("approved"));
  const major      = countWhere(list, c => normalizeType(c.type) === "major");
  const minor      = countWhere(list, c => normalizeType(c.type) === "minor");

  const cards = [
    { mod: "total", label: "TOTAL",      val: total      },
    { mod: "new",   label: "NEW",        val: newCount   },
    { mod: "unres", label: "UNRESOLVED", val: unresolved },
    { mod: "res",   label: "RESOLVED",   val: resolved   },
    { mod: "major", label: "MAJOR",      val: major      },
    { mod: "minor", label: "MINOR",      val: minor      },
  ];

  return BUI.html`
    <div class="cr-stat-row">
      ${cards.map(c => BUI.html`
        <div class="cr-stat-card cr-stat-card--${c.mod}">
          <div class="cr-stat-card__val">${c.val}</div>
          <div class="cr-stat-card__lbl">${c.label}</div>
        </div>
      `)}
    </div>
  `;
};

const renderBarRow = (label: string, count: number, total: number, color: string) => {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return BUI.html`
    <div class="cr-bar-row">
      <div class="cr-bar-meta">
        <span class="cr-bar-meta__name">${label}</span>
        <span>
          <span class="cr-bar-meta__count">${count}</span>
          <span class="cr-bar-meta__pct">${pct}%</span>
        </span>
      </div>
      <div class="cr-bar-track">
        <div class="cr-bar-fill" style="width: ${pct}%; background: ${color};"></div>
      </div>
    </div>
  `;
};

const renderStatusChart = (list: ClashData[]) => {
  const total      = list.length;
  const newCount   = countWhere(list, c => normalizeStatus(c.status) === "new" || normalizeStatus(c.status).includes("active"));
  const unresolved = countWhere(list, c => normalizeStatus(c.status) === "unresolved");
  const resolved   = countWhere(list, c => normalizeStatus(c.status).includes("resolved") || normalizeStatus(c.status).includes("approved"));

  return BUI.html`
    <div class="cr-chart-card">
      <div class="cr-chart-card__title">STATUS</div>
      <div class="cr-bar-rows">
        ${renderBarRow("New",        newCount,   total, "#0288d1")}
        ${renderBarRow("Unresolved", unresolved, total, "#ff9800")}
        ${renderBarRow("Resolved",   resolved,   total, "#4caf50")}
      </div>
    </div>
  `;
};

const renderTypeChart = (list: ClashData[]) => {
  const total = list.length;
  const major = countWhere(list, c => normalizeType(c.type) === "major");
  const minor = countWhere(list, c => normalizeType(c.type) === "minor");

  return BUI.html`
    <div class="cr-chart-card">
      <div class="cr-chart-card__title">TYPE</div>
      <div class="cr-bar-rows">
        ${renderBarRow("Major", major, total, "#F28B82")}
        ${renderBarRow("Minor", minor, total, "#F8BC04")}
      </div>
    </div>
  `;
};

// ─── Main export ──────────────────────────────────────────────────────────────

export const renderDashboard = (list: ClashData[]) => {
  if (list.length === 0) return BUI.html``;

  return BUI.html`
    <div class="cr-dash">
      ${renderStatCards(list)}
      <div class="cr-charts-row">
        ${renderStatusChart(list)}
        ${renderTypeChart(list)}
      </div>
    </div>
  `;
};

