import { useParams } from "@tanstack/react-router";
import { AppShell } from "./AppShell";
import { WorkspaceHeader } from "./WorkspaceHeader";
import { getProjectById, projectMembers } from "../static-data";

export function ProjectSettingsPage() {
  const { projectId } = useParams({ strict: false });
  const project = getProjectById(projectId);

  return (
    <AppShell project={project}>
      <WorkspaceHeader
        title="Project Settings"
        actions={
          <button className="inline-flex items-center justify-center gap-2 min-h-8 px-3 border rounded-radius cursor-pointer text-xs font-semibold no-underline hover:-translate-y-[1px] active:translate-y-0 transition-all duration-120 border-[oklch(69%_0.15_252)] bg-gradient-to-b from-[oklch(70%_0.16_252)] to-[oklch(57%_0.16_252)] text-[oklch(99%_0.004_255)] hover:from-[oklch(73%_0.16_252)] hover:to-[oklch(60%_0.16_252)]" type="button">
            Save Changes
          </button>
        }
      />
      <div className="relative flex-1 min-w-0 overflow-auto bg-gradient-to-b from-[oklch(12%_0.014_255)] to-[oklch(9.8%_0.012_255)]">
        <div className="flex flex-col gap-8 max-w-[800px] p-10">
          <section className="flex flex-col gap-4 p-6 border border-border bg-[oklch(14.5%_0.014_255_/_94%)] rounded-radius shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <h2 className="text-[18px] font-semibold text-fg">General Information</h2>
            <div className="flex flex-col gap-2">
              <label className="text-muted text-[11px] font-bold tracking-wider uppercase" htmlFor="project-name">
                Project Name
              </label>
              <input
                id="project-name"
                className="w-full px-3 py-2 border border-border rounded-radius bg-surface text-fg outline-none focus-visible:ring-2 focus-visible:ring-accent/50 read-only:opacity-80"
                type="text"
                value={project.projectName}
                readOnly
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-muted text-[11px] font-bold tracking-wider uppercase" htmlFor="project-number">
                Project Number
              </label>
              <input
                id="project-number"
                className="w-full px-3 py-2 border border-border rounded-radius bg-surface text-fg outline-none focus-visible:ring-2 focus-visible:ring-accent/50 read-only:opacity-80"
                type="text"
                value={project.display.label}
                readOnly
              />
            </div>
          </section>

          <section className="flex flex-col gap-4 p-6 border border-border bg-[oklch(14.5%_0.014_255_/_94%)] rounded-radius shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <h2 className="text-[18px] font-semibold text-fg">Members & Permissions</h2>
            <table className="w-full border-collapse text-fg text-[13px]">
              <thead>
                <tr className="border-b border-border-strong text-muted text-[11px] font-bold tracking-wider text-left uppercase">
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {projectMembers.map((member) => (
                  <tr className="hover:bg-[oklch(18%_0.02_255)] transition-colors duration-120" key={member.email}>
                    <td className="px-4 py-3 border-b border-border text-fg">{member.email}</td>
                    <td className="px-4 py-3 border-b border-border">
                      <span className={`inline-flex items-center min-h-5 px-2 py-0.5 border rounded-full text-[10px] font-bold tracking-wider uppercase ${
                        member.role === "Admin"
                          ? "border-[oklch(70%_0.14_150_/_42%)] bg-[oklch(70%_0.14_150_/_13%)] text-status-ok"
                          : "border-border-strong bg-[oklch(18%_0.02_255)] text-muted"
                      }`}>{member.role}</span>
                    </td>
                    <td className="px-4 py-3 border-b border-border text-muted">{member.status}</td>
                    <td className="px-4 py-3 border-b border-border text-right">
                      <button className="inline-flex items-center justify-center gap-2 min-h-8 px-3 border border-transparent rounded-radius bg-transparent text-muted cursor-pointer text-xs font-semibold hover:border-border hover:bg-surface-alt hover:text-fg transition-all duration-120" type="button">
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="inline-flex items-center justify-center gap-2 min-h-8 px-3 border border-border-strong rounded-radius bg-gradient-to-b from-surface-raised to-surface-alt text-fg cursor-pointer text-xs font-semibold no-underline hover:border-[oklch(50%_0.05_252)] hover:bg-[oklch(25%_0.026_255)] hover:-translate-y-[1px] active:translate-y-0 transition-all duration-120 w-fit" type="button">
              Invite Member
            </button>
          </section>

          <section className="flex flex-col gap-4 p-6 border border-border bg-[oklch(14.5%_0.014_255_/_94%)] rounded-radius shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <h2 className="text-[18px] font-semibold text-fg">Data Connections</h2>
            <div className="flex flex-col gap-2">
              <label className="text-muted text-[11px] font-bold tracking-wider uppercase" htmlFor="sheets-url">
                Google Sheets URL (BIM Data)
              </label>
              <input
                id="sheets-url"
                className="w-full px-3 py-2 border border-border rounded-radius bg-surface text-fg outline-none focus-visible:ring-2 focus-visible:ring-accent/50 read-only:opacity-80 placeholder-muted-2"
                type="text"
                placeholder="https://docs.google.com/spreadsheets/d/..."
                readOnly
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-muted text-[11px] font-bold tracking-wider uppercase" htmlFor="cde-storage">
                CDE Storage (Google Drive)
              </label>
              <div className="flex gap-2">
                <input
                  id="cde-storage"
                  className="w-full px-3 py-2 border border-border rounded-radius bg-surface text-fg outline-none focus-visible:ring-2 focus-visible:ring-accent/50 read-only:opacity-80"
                  type="text"
                  value="Connected: Site_Drives/Project_HXP_II"
                  readOnly
                />
                <button className="inline-flex items-center justify-center gap-2 min-h-8 px-3 border border-border-strong rounded-radius bg-gradient-to-b from-surface-raised to-surface-alt text-fg cursor-pointer text-xs font-semibold no-underline hover:border-[oklch(50%_0.05_252)] hover:bg-[oklch(25%_0.026_255)] hover:-translate-y-[1px] active:translate-y-0 transition-all duration-120" type="button">
                  Change
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
