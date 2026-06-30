import { useState } from "react";
import { Icon } from "@/react-components/components/ui";
import { useUpdateProject } from "@/react-components/features/projects/useProjects";
import type { AppProject } from "@/types";

interface ProjectPowerBISettingsProps {
  project: AppProject;
}

export function ProjectPowerBISettings({ project }: ProjectPowerBISettingsProps) {
  const updateProjectMutation = useUpdateProject();

  const [tabTitle, setTabTitle] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Safely extract existing powerbiTabs
  const currentTabs = (project as any).powerbiTabs || [];

  const handleAddTab = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanTitle = tabTitle.trim();
    const cleanUrl = url.trim();

    if (!cleanTitle) {
      setError("Tab Title cannot be empty.");
      return;
    }

    if (!cleanUrl) {
      setError("Power BI Link URL cannot be empty.");
      return;
    }

    if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
      setError("Please enter a valid URL (starting with http:// or https://).");
      return;
    }

    const newTab = {
      id: String(Date.now()),
      tabTitle: cleanTitle,
      url: cleanUrl,
    };

    const updatedTabs = [...currentTabs, newTab];

    try {
      await updateProjectMutation.mutateAsync({
        id: project.id,
        project: {
          powerbi_tabs: updatedTabs as any,
        },
      });
      setTabTitle("");
      setUrl("");
    } catch (err: any) {
      setError(err.message || "Failed to add Power BI tab.");
    }
  };

  const handleDeleteTab = async (id: string, title: string) => {
    if (window.confirm(`Are you sure you want to delete "${title}" tab?`)) {
      const updatedTabs = currentTabs.filter((t: any) => t.id !== id);
      try {
        await updateProjectMutation.mutateAsync({
          id: project.id,
          project: {
            powerbi_tabs: updatedTabs as any,
          },
        });
      } catch (err: any) {
        alert(err.message || "Failed to delete Power BI tab.");
      }
    }
  };

  return (
    <section className="flex flex-col gap-6 p-6 border border-border bg-[oklch(14.5%_0.014_255_/_94%)] rounded-radius shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] text-fg">
      <div className="flex flex-col gap-1">
        <h2 className="text-[16px] font-bold text-fg">Configure Power BI Tabs</h2>
        <p className="text-xs text-muted">
          Add or edit dashboards (e.g. Power BI shareable links) to show up under the PowerBI page.
        </p>
      </div>

      <hr className="border-border" />

      {/* Add New Tab Section */}
      <form
        className="flex flex-col gap-4 p-5 border border-border bg-surface/30 rounded-radius relative"
        onSubmit={handleAddTab}
      >
        <h3 className="text-sm font-bold text-fg">Add New Tab</h3>

        {error && (
          <div className="flex items-center gap-2 p-3 text-xs text-status-danger bg-status-danger/10 border border-status-danger/20 rounded-radius">
            <Icon name="WARNING" size={14} />
            <span>{error}</span>
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex flex-col gap-1.5 flex-1">
            <label className="text-muted text-[10px] font-bold tracking-wider uppercase" htmlFor="tab-title">
              Tab Title
            </label>
            <input
              id="tab-title"
              className="w-full px-3 py-1.5 border border-border-strong bg-[#1b1c21] rounded-radius text-fg text-sm outline-none focus:border-accent placeholder:text-muted-2/40"
              type="text"
              required
              placeholder="e.g. Document Overall"
              value={tabTitle}
              onChange={(e) => setTabTitle(e.target.value)}
              disabled={updateProjectMutation.isPending}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-muted text-[10px] font-bold tracking-wider uppercase" htmlFor="tab-url">
            Partner URL (Power BI Link)
          </label>
          <input
            id="tab-url"
            className="w-full px-3 py-1.5 border border-border-strong bg-[#1b1c21] rounded-radius text-fg text-sm outline-none focus:border-accent placeholder:text-muted-2/40"
            type="url"
            required
            placeholder="https://app.powerbi.com/view?r=..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={updateProjectMutation.isPending}
          />
        </div>

        <div className="flex justify-end mt-2">
          <button
            className="inline-flex items-center justify-center gap-2 min-h-8 px-4 py-1.5 border rounded-radius cursor-pointer text-xs font-semibold border-[oklch(69%_0.15_252)] bg-gradient-to-b from-[oklch(70%_0.16_252)] to-[oklch(57%_0.16_252)] text-[oklch(99%_0.004_255)] hover:from-[oklch(73%_0.16_252)] hover:to-[oklch(60%_0.16_252)] disabled:opacity-60 disabled:cursor-not-allowed"
            type="submit"
            disabled={updateProjectMutation.isPending}
          >
            {updateProjectMutation.isPending ? "Adding..." : "Add Tab"}
          </button>
        </div>
      </form>

      {/* Configured Tabs Table */}
      <div className="flex flex-col gap-3 mt-2">
        <h3 className="text-sm font-bold text-fg">Configured Tabs</h3>

        {currentTabs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-sm text-muted-2 border border-dashed border-border rounded-radius bg-surface/10">
            <span>No Power BI tabs configured for this project.</span>
          </div>
        ) : (
          <div className="overflow-x-auto border border-border rounded-radius bg-surface/10">
            <table className="w-full border-collapse text-left text-xs text-fg">
              <thead>
                <tr className="border-b border-border bg-surface/50 text-[10px] uppercase font-bold tracking-wider text-muted">
                  <th className="px-4 py-3">Tab Title</th>
                  <th className="px-4 py-3">URL Link</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {currentTabs.map((t: any) => (
                  <tr key={t.id} className="hover:bg-surface/20 transition-colors duration-120">
                    <td className="px-4 py-3 font-semibold text-fg">{t.tabTitle}</td>
                    <td className="px-4 py-3 font-mono text-muted truncate max-w-[300px]" title={t.url}>
                      {t.url}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        className="inline-flex items-center justify-center w-8 h-8 rounded-radius text-muted hover:text-status-danger hover:bg-status-danger/10 border border-transparent hover:border-status-danger/25 transition-all duration-120 cursor-pointer"
                        type="button"
                        onClick={() => handleDeleteTab(t.id, t.tabTitle)}
                      >
                        <Icon name="CLOSE" size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
