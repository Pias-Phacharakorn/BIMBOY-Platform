import { useState } from "react";
import { useParams } from "@tanstack/react-router";
import { AppShell, WorkspaceHeader } from "@/react-components/components/layout";
import { useProject, useIsProjectAdmin } from "@/react-components/features/projects/useProjects";
import { useAuth } from "@/react-components/features/auth/useAuth";
import type { StandardCard, StandardTabId } from "@/types";

const standardFacts = [
  ["Project code", "HXP-II"],
  ["Project name", "Hospital Expansion Phase II"],
  ["Project owner", "City Health Authority"],
  ["Project type", "Healthcare building"],
  ["Consultant", "FEC, MITR"],
];

const bimFacts = [
  ["BIM uses", "Design authoring, 3D coordination"],
  ["BIM goals", "Eliminate major conflicts"],
  ["Modeling / clash detection", "RVT2025 / Navisworks"],
  ["Collaboration platform", "ACC project hub"],
];

const bepCards: StandardCard[] = [
  {
    kicker: "BIM uses",
    title: "Design authoring and 3D coordination",
    body: "Authoring discipline models remain separated until coordination sign-off. Published federations must include model version and package stage.",
  },
  {
    kicker: "Model goal",
    title: "Reduce major clashes before issue",
    body: "Critical and high clashes require owner, response date, and linked report before the package can move to review.",
  },
  {
    kicker: "Tools",
    title: "RVT2025 / Navisworks / ACC",
    body: "RVT is the authoring source, Navisworks is the coordination record, and ACC is the approved exchange platform.",
  },
];

const bepRules = [
  {
    code: "01",
    title: "Model origin and coordinates locked",
    note: "Shared coordinates must be verified before first discipline upload.",
    status: "Current",
    tone: "ok" as const,
  },
  {
    code: "02",
    title: "Viewer fields mapped for ACC data pane",
    note: "Use ExternalElementId first; Element ID is the fallback when mapping fails.",
    status: "Review",
    tone: "warn" as const,
  },
  {
    code: "03",
    title: "Clash reports issued weekly",
    note: "MEP, structure, architecture, and specialist models must be included.",
    status: "Current",
    tone: "ok" as const,
  },
];

const namingCards: StandardCard[] = [
  {
    kicker: "Pattern",
    title: "HXP-ZZ-DR-A-0001-S2-P01",
    body: "Every issued document must include project, originator, type, discipline, number, status, and revision.",
  },
  {
    kicker: "Blocked state",
    title: "Missing discipline code",
    body: "Uploads without discipline, status, or revision are held in draft until corrected by the package owner.",
  },
  {
    kicker: "Active rule set",
    title: "ISO 19650 style control",
    body: "Names are validated against the project matrix before document status can move to shared or published.",
  },
];

const namingRules = [
  { field: "Project code", example: "HXP", rule: "Must match active project code", status: "Valid", tone: "ok" as const },
  { field: "Originator", example: "ARC", rule: "Approved company code only", status: "Valid", tone: "ok" as const },
  { field: "Discipline", example: "A / S / M / E", rule: "Required before shared status", status: "Check", tone: "warn" as const },
  { field: "Revision", example: "P01 / C02", rule: "Preliminary or contract sequence", status: "Valid", tone: "ok" as const },
];

const cdeCards: StandardCard[] = [
  {
    kicker: "Owner hub",
    title: "Client review and approvals",
    body: "SharePoint workspace for owner-facing packages, meeting records, and approval responses.",
  },
  {
    kicker: "Design team hub",
    title: "Consultant working exchange",
    body: "Controlled folders for WIP packages, discipline comments, and returned review actions.",
  },
  {
    kicker: "ACC model space",
    title: "Federated model coordination",
    body: "Approved source for model sharing, coordination views, issues, and Navisworks report records.",
  },
];

const cdeTasks = [
  {
    category: "BIM",
    detail: "Update underground model from 2D shop drawings this week",
    responseBy: "MEP Base Building",
    status: "Open",
    tone: "warn" as const,
  },
  {
    category: "BIM Design",
    detail: "Confirm equipment placement in PoE and telco coordination zone",
    responseBy: "MEP Data Hall",
    status: "Closed",
    tone: "ok" as const,
  },
  {
    category: "Document",
    detail: "Upload for-construction drawing package to shared CDE folder",
    responseBy: "Document Control",
    status: "Open",
    tone: "warn" as const,
  },
];

const tabLabels: Record<StandardTabId, string> = {
  bep: "BIM Execution Plan",
  naming: "Document naming control",
  cde: "Project CDE",
};

const tabOrder: StandardTabId[] = ["bep", "naming", "cde"];

function FactSection({ title, facts }: { title: string; facts: string[][] }) {
  return (
    <section className="p-[18px] border-b border-border last:border-b-0">
      <div className="text-muted text-[10px] font-bold tracking-wider uppercase mb-2.5">{title}</div>
      <div className="grid gap-2.5">
        {facts.map(([label, value]) => (
          <div className="grid gap-0.5" key={label}>
            <span className="text-muted text-xs">{label}</span>
            <span className="text-fg font-semibold">{value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function StandardCardGrid({ cards }: { cards: StandardCard[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-5">
      {cards.map((card) => (
        <article className="border border-border bg-[oklch(14.5%_0.014_255_/_94%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] rounded-radius p-4" key={card.title}>
          <div className="text-muted text-[10px] font-bold tracking-wider uppercase mb-2.5">{card.kicker}</div>
          <h3 className={`text-[14px] font-semibold text-fg mb-2 ${card.title.includes("HXP-") ? "font-mono" : ""}`}>{card.title}</h3>
          <p className="text-muted text-[13px] leading-relaxed">{card.body}</p>
        </article>
      ))}
    </div>
  );
}

export function StandardView() {
  const { projectId } = useParams({ strict: false });
  const { data: project, isLoading } = useProject(projectId);
  const { user, profile } = useAuth();
  const showSettings = useIsProjectAdmin(project?.id, user?.id, profile?.hub_role === "hub_admin");
  const [activeTab, setActiveTab] = useState<StandardTabId>("bep");

  if (isLoading) {
    return (
      <div className="flex w-screen h-screen items-center justify-center bg-bg text-fg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-border border-t-accent rounded-full animate-spin" />
          <span className="text-sm text-muted">Loading project standard...</span>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex w-screen h-screen items-center justify-center bg-bg text-fg">
        <div className="text-center p-6 border border-border bg-surface rounded-radius max-w-md">
          <h2 className="text-lg font-bold mb-2">Project Not Found</h2>
        </div>
      </div>
    );
  }

  return (
    <AppShell project={project} showSettings={showSettings}>
      <WorkspaceHeader
        title="Project Standard"
        tabs={tabOrder.map((tab) => tabLabels[tab])}
        activeTab={tabLabels[activeTab]}
        onTabChange={(label) => {
          const nextTab = tabOrder.find((tab) => tabLabels[tab] === label);
          if (nextTab) {
            setActiveTab(nextTab);
          }
        }}
      />
      <div className="relative flex-1 min-w-0 overflow-auto bg-gradient-to-b from-[oklch(12%_0.014_255)] to-[oklch(9.8%_0.012_255)]">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)] gap-6 p-6 min-h-full">
          <aside className="border border-border bg-[oklch(14.5%_0.014_255_/_94%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] rounded-radius align-self-start overflow-hidden h-fit">
            <FactSection title="Project information" facts={standardFacts} />
            <FactSection title="BIM management" facts={bimFacts} />
            <section className="p-[18px]">
              <div className="text-muted text-[10px] font-bold tracking-wider uppercase mb-2.5">Project CDE shortcuts</div>
              <button className="flex items-center justify-between gap-3 w-full min-h-[40px] mt-2 p-[10px_12px] border border-border rounded-radius bg-surface-alt text-fg cursor-pointer text-left transition-all duration-125 hover:border-accent hover:bg-[oklch(26%_0.055_252_/_72%)]" type="button" onClick={() => setActiveTab("cde")}>
                <strong>Owner Hub</strong>
                <span className="text-muted text-[11px]">SharePoint</span>
              </button>
              <button className="flex items-center justify-between gap-3 w-full min-h-[40px] mt-2 p-[10px_12px] border border-border rounded-radius bg-surface-alt text-fg cursor-pointer text-left transition-all duration-125 hover:border-accent hover:bg-[oklch(26%_0.055_252_/_72%)]" type="button" onClick={() => setActiveTab("cde")}>
                <strong>Design Team Hub</strong>
                <span className="text-muted text-[11px]">SharePoint</span>
              </button>
              <button className="flex items-center justify-between gap-3 w-full min-h-[40px] mt-2 p-[10px_12px] border border-border rounded-radius bg-surface-alt text-fg cursor-pointer text-left transition-all duration-125 hover:border-accent hover:bg-[oklch(26%_0.055_252_/_72%)]" type="button" onClick={() => setActiveTab("cde")}>
                <strong>ACC Model Space</strong>
                <span className="text-muted text-[11px]">Autodesk</span>
              </button>
            </section>
          </aside>

          <section className="border border-border bg-[oklch(14.5%_0.014_255_/_94%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] rounded-radius min-w-0 overflow-hidden h-fit">
            <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-5 p-[22px_24px] border-b border-border bg-[radial-gradient(circle_at_92%_10%,oklch(66%_0.17_252_/_16%),transparent_32%),_var(--color-surface)]">
              <div>
                <div className="text-muted text-[10px] font-bold tracking-wider uppercase mb-2.5">BIM project standard</div>
                <h1 className="text-2xl font-bold tracking-tight text-fg leading-tight">One controlled place for BEP, naming rules, and CDE access.</h1>
                <p className="max-w-[760px] mt-1.5 text-muted text-sm leading-relaxed">
                  Use this screen as the live project standard index: confirm execution rules, validate document names,
                  and route teams to the approved common data environment.
                </p>
              </div>
              <div className="grid min-w-[128px] place-content-center p-4 border border-border rounded-radius bg-surface-alt text-center">
                <span className="text-muted text-[10px] font-bold tracking-wider uppercase mb-1">Compliance</span>
                <strong className="text-accent-2 font-mono text-[28px] font-bold leading-none">86%</strong>
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto p-[12px_16px] border-b border-border bg-bg" aria-label="Project standard sections">
              {tabOrder.map((tab) => (
                <button
                  className={`min-h-[36px] px-3 py-2 border rounded-radius bg-transparent cursor-pointer whitespace-nowrap transition-all duration-120 ${
                    activeTab === tab
                      ? "border-accent bg-accent-muted text-fg"
                      : "border-border text-muted hover:border-accent hover:bg-accent-muted hover:text-fg"
                  }`}
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                >
                  {tabLabels[tab]}
                </button>
              ))}
            </div>

            {activeTab === "bep" ? (
              <div className="p-6">
                <StandardCardGrid cards={bepCards} />
                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)] gap-4">
                  <article className="border border-border bg-[oklch(14.5%_0.014_255_/_94%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] rounded-radius p-4">
                    <div className="text-muted text-[10px] font-bold tracking-wider uppercase mb-2.5">Execution checklist</div>
                    <div className="grid gap-2.5 mt-3">
                      {bepRules.map((rule) => (
                        <div className="grid grid-cols-[34px_minmax(0,1fr)_auto] gap-3 items-center p-3 border border-border rounded-radius bg-surface-alt" key={rule.code}>
                          <span className="text-accent-2 font-mono text-xs font-semibold">{rule.code}</span>
                          <div>
                            <div className="text-fg font-semibold">{rule.title}</div>
                            <div className="text-muted text-xs mt-0.5">{rule.note}</div>
                          </div>
                          <span className={`inline-flex items-center min-h-5 px-2 py-0.5 border rounded-full text-[10px] font-bold tracking-wider uppercase ${
                            rule.tone === "ok"
                              ? "border-[oklch(70%_0.14_150_/_42%)] bg-[oklch(70%_0.14_150_/_13%)] text-status-ok"
                              : rule.tone === "warn"
                              ? "border-[oklch(77%_0.14_76_/_42%)] bg-[oklch(77%_0.14_76_/_13%)] text-status-warn"
                              : "border-border-strong bg-[oklch(18%_0.02_255)] text-muted"
                          }`}>{rule.status}</span>
                        </div>
                      ))}
                    </div>
                  </article>

                  <article className="border border-border bg-[oklch(14.5%_0.014_255_/_94%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] rounded-radius p-4 flex flex-col gap-4">
                    <div className="text-muted text-[10px] font-bold tracking-wider uppercase mb-1">Configuration sequence</div>
                    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2.5 items-center text-muted text-[13px] leading-snug">
                      <span className="w-2.25 h-2.25 rounded-full bg-accent-2 shadow-[0_0_0_5px_rgba(116,193,212,0.1)]" />
                      <div>
                        <strong>Search Viewer</strong>
                        <br />
                        Drag Viewer column into the viewer field.
                      </div>
                    </div>
                    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2.5 items-center text-muted text-[13px] leading-snug">
                      <span className="w-2.25 h-2.25 rounded-full bg-accent-2 shadow-[0_0_0_5px_rgba(116,193,212,0.1)]" />
                      <div>
                        <strong>Map ExternalElementId</strong>
                        <br />
                        Apply to every ExternalElementId field one by one.
                      </div>
                    </div>
                    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2.5 items-center text-muted text-[13px] leading-snug">
                      <span className="w-2.25 h-2.25 rounded-full bg-accent-2 shadow-[0_0_0_5px_rgba(116,193,212,0.1)]" />
                      <div>
                        <strong>Fallback Element ID</strong>
                        <br />
                        Use only when ExternalElementId does not map.
                      </div>
                    </div>
                  </article>
                </div>
              </div>
            ) : null}

            {activeTab === "naming" ? (
              <div className="p-6">
                <StandardCardGrid cards={namingCards} />
                <table className="w-full border-collapse text-fg text-[13px]">
                  <thead>
                    <tr className="border-b border-border-strong text-muted text-[11px] font-bold tracking-wider text-left uppercase">
                      <th className="px-4 py-3">Field</th>
                      <th className="px-4 py-3">Example</th>
                      <th className="px-4 py-3">Rule</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {namingRules.map((rule) => (
                      <tr className="hover:bg-[oklch(18%_0.02_255)] transition-colors duration-120" key={rule.field}>
                        <td className="px-4 py-3 border-b border-border text-fg font-semibold">{rule.field}</td>
                        <td className="px-4 py-3 border-b border-border font-mono text-sm">{rule.example}</td>
                        <td className="px-4 py-3 border-b border-border text-muted">{rule.rule}</td>
                        <td className="px-4 py-3 border-b border-border">
                          <span className={`inline-flex items-center min-h-5 px-2 py-0.5 border rounded-full text-[10px] font-bold tracking-wider uppercase ${
                            rule.tone === "ok"
                              ? "border-[oklch(70%_0.14_150_/_42%)] bg-[oklch(70%_0.14_150_/_13%)] text-status-ok"
                              : rule.tone === "warn"
                              ? "border-[oklch(77%_0.14_76_/_42%)] bg-[oklch(77%_0.14_76_/_13%)] text-status-warn"
                              : "border-border-strong bg-[oklch(18%_0.02_255)] text-muted"
                          }`}>{rule.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {activeTab === "cde" ? (
              <div className="p-6">
                <StandardCardGrid cards={cdeCards} />
                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)] gap-4">
                  <article className="border border-border bg-[oklch(14.5%_0.014_255_/_94%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] rounded-radius p-4">
                    <div className="text-muted text-[10px] font-bold tracking-wider uppercase mb-2.5">Remaining task status</div>
                    <table className="w-full border-collapse text-fg text-[13px] mt-3">
                      <thead>
                        <tr className="border-b border-border-strong text-muted text-[11px] font-bold tracking-wider text-left uppercase">
                          <th className="px-4 py-3">Category</th>
                          <th className="px-4 py-3">Task detail</th>
                          <th className="px-4 py-3">Response by</th>
                          <th className="px-4 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cdeTasks.map((task) => (
                          <tr className="hover:bg-[oklch(18%_0.02_255)] transition-colors duration-120" key={task.detail}>
                            <td className="px-4 py-3 border-b border-border text-fg font-semibold">{task.category}</td>
                            <td className="px-4 py-3 border-b border-border text-fg">{task.detail}</td>
                            <td className="px-4 py-3 border-b border-border text-muted">{task.responseBy}</td>
                            <td className="px-4 py-3 border-b border-border">
                              <span className={`inline-flex items-center min-h-5 px-2 py-0.5 border rounded-full text-[10px] font-bold tracking-wider uppercase ${
                                task.tone === "ok"
                                  ? "border-[oklch(70%_0.14_150_/_42%)] bg-[oklch(70%_0.14_150_/_13%)] text-status-ok"
                                  : task.tone === "warn"
                                  ? "border-[oklch(77%_0.14_76_/_42%)] bg-[oklch(77%_0.14_76_/_13%)] text-status-warn"
                                  : "border-border-strong bg-[oklch(18%_0.02_255)] text-muted"
                              }`}>{task.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </article>

                  <article className="border border-border bg-[oklch(14.5%_0.014_255_/_94%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] rounded-radius p-4 flex flex-col gap-4">
                    <div className="text-muted text-[10px] font-bold tracking-wider uppercase mb-1">Approved locations</div>
                    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2.5 items-center text-muted text-[13px] leading-snug">
                      <span className="w-2.25 h-2.25 rounded-full bg-accent-2 shadow-[0_0_0_5px_rgba(116,193,212,0.1)]" />
                      <div>
                        <strong>01 WIP</strong>
                        <br />
                        Discipline working files only.
                      </div>
                    </div>
                    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2.5 items-center text-muted text-[13px] leading-snug">
                      <span className="w-2.25 h-2.25 rounded-full bg-accent-2 shadow-[0_0_0_5px_rgba(116,193,212,0.1)]" />
                      <div>
                        <strong>02 Shared</strong>
                        <br />
                        Cross-discipline coordination packages.
                      </div>
                    </div>
                    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2.5 items-center text-muted text-[13px] leading-snug">
                      <span className="w-2.25 h-2.25 rounded-full bg-accent-2 shadow-[0_0_0_5px_rgba(116,193,212,0.1)]" />
                      <div>
                        <strong>03 Published</strong>
                        <br />
                        Approved issue and client records.
                      </div>
                    </div>
                  </article>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
