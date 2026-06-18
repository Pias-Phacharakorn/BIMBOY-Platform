import { useState } from "react";
import { useParams } from "react-router-dom";
import { AppShell } from "./AppShell";
import { WorkspaceHeader } from "./WorkspaceHeader";
import {
  bepCards,
  bepRules,
  bimFacts,
  cdeCards,
  cdeTasks,
  getProjectById,
  namingCards,
  namingRules,
  standardFacts,
  type StandardCard,
  type StandardTabId,
} from "../static-data";

const tabLabels: Record<StandardTabId, string> = {
  bep: "BIM Execution Plan",
  naming: "Document naming control",
  cde: "Project CDE",
};

const tabOrder: StandardTabId[] = ["bep", "naming", "cde"];

function FactSection({ title, facts }: { title: string; facts: string[][] }) {
  return (
    <section className="standard-section">
      <div className="standard-kicker">{title}</div>
      <div className="standard-facts">
        {facts.map(([label, value]) => (
          <div className="fact-row" key={label}>
            <span className="fact-label">{label}</span>
            <span className="fact-value">{value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function StandardCardGrid({ cards }: { cards: StandardCard[] }) {
  return (
    <div className="standard-grid">
      {cards.map((card) => (
        <article className="standard-card" key={card.title}>
          <div className="standard-kicker">{card.kicker}</div>
          <h3 className={card.title.includes("HXP-") ? "mono" : ""}>{card.title}</h3>
          <p>{card.body}</p>
        </article>
      ))}
    </div>
  );
}

export function ProjectStandardPage() {
  const { projectId } = useParams();
  const project = getProjectById(projectId);
  const [activeTab, setActiveTab] = useState<StandardTabId>("bep");

  return (
    <AppShell project={project}>
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
        actions={
          <>
            <button className="btn" type="button">
              Export PDF
            </button>
            <button className="btn btn-primary" type="button">
              Update Standard
            </button>
          </>
        }
      />
      <div className="workspace-area">
        <div className="standard-shell">
          <aside className="standard-rail">
            <FactSection title="Project information" facts={standardFacts} />
            <FactSection title="BIM management" facts={bimFacts} />
            <section className="standard-section">
              <div className="standard-kicker">Project CDE shortcuts</div>
              <button className="quick-link" type="button" onClick={() => setActiveTab("cde")}>
                <strong>Owner Hub</strong>
                <span>SharePoint</span>
              </button>
              <button className="quick-link" type="button" onClick={() => setActiveTab("cde")}>
                <strong>Design Team Hub</strong>
                <span>SharePoint</span>
              </button>
              <button className="quick-link" type="button" onClick={() => setActiveTab("cde")}>
                <strong>ACC Model Space</strong>
                <span>Autodesk</span>
              </button>
            </section>
          </aside>

          <section className="standard-main">
            <div className="standard-hero">
              <div>
                <div className="standard-kicker">BIM project standard</div>
                <h1 className="standard-title">One controlled place for BEP, naming rules, and CDE access.</h1>
                <p className="standard-subtitle">
                  Use this screen as the live project standard index: confirm execution rules, validate document names,
                  and route teams to the approved common data environment.
                </p>
              </div>
              <div className="standard-score">
                <span className="standard-kicker">Compliance</span>
                <strong>86%</strong>
              </div>
            </div>

            <div className="standard-tabs" aria-label="Project standard sections">
              {tabOrder.map((tab) => (
                <button
                  className={`standard-tab ${activeTab === tab ? "active" : ""}`}
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                >
                  {tabLabels[tab]}
                </button>
              ))}
            </div>

            {activeTab === "bep" ? (
              <div className="standard-content active">
                <StandardCardGrid cards={bepCards} />
                <div className="standard-split">
                  <article className="standard-card">
                    <div className="standard-kicker">Execution checklist</div>
                    <div className="rule-list">
                      {bepRules.map((rule) => (
                        <div className="rule-item" key={rule.code}>
                          <span className="rule-code">{rule.code}</span>
                          <div>
                            <div className="rule-title">{rule.title}</div>
                            <div className="rule-note">{rule.note}</div>
                          </div>
                          <span className={`status-mini ${rule.tone}`}>{rule.status}</span>
                        </div>
                      ))}
                    </div>
                  </article>

                  <article className="standard-card path-card">
                    <div className="standard-kicker">Configuration sequence</div>
                    <div className="path-node">
                      <span className="node-dot" />
                      <div>
                        <strong>Search Viewer</strong>
                        <br />
                        Drag Viewer column into the viewer field.
                      </div>
                    </div>
                    <div className="path-node">
                      <span className="node-dot" />
                      <div>
                        <strong>Map ExternalElementId</strong>
                        <br />
                        Apply to every ExternalElementId field one by one.
                      </div>
                    </div>
                    <div className="path-node">
                      <span className="node-dot" />
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
              <div className="standard-content active">
                <StandardCardGrid cards={namingCards} />
                <table className="tech-table">
                  <thead>
                    <tr>
                      <th>Field</th>
                      <th>Example</th>
                      <th>Rule</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {namingRules.map((rule) => (
                      <tr key={rule.field}>
                        <td>{rule.field}</td>
                        <td className="mono">{rule.example}</td>
                        <td>{rule.rule}</td>
                        <td>
                          <span className={`status-mini ${rule.tone}`}>{rule.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {activeTab === "cde" ? (
              <div className="standard-content active">
                <StandardCardGrid cards={cdeCards} />
                <div className="standard-split">
                  <article className="standard-card">
                    <div className="standard-kicker">Remaining task status</div>
                    <table className="tech-table">
                      <thead>
                        <tr>
                          <th>Category</th>
                          <th>Task detail</th>
                          <th>Response by</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cdeTasks.map((task) => (
                          <tr key={task.detail}>
                            <td>{task.category}</td>
                            <td>{task.detail}</td>
                            <td>{task.responseBy}</td>
                            <td>
                              <span className={`status-mini ${task.tone}`}>{task.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </article>

                  <article className="standard-card path-card">
                    <div className="standard-kicker">Approved locations</div>
                    <div className="path-node">
                      <span className="node-dot" />
                      <div>
                        <strong>01 WIP</strong>
                        <br />
                        Discipline working files only.
                      </div>
                    </div>
                    <div className="path-node">
                      <span className="node-dot" />
                      <div>
                        <strong>02 Shared</strong>
                        <br />
                        Cross-discipline coordination packages.
                      </div>
                    </div>
                    <div className="path-node">
                      <span className="node-dot" />
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
