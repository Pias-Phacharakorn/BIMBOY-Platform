import { useState, useEffect } from "react";
import * as OBC from "@thatopen/components";
import { useBimStore } from "../../store/bimStore";
import { Icon } from "../../components/Icon";
import { LoadModelButton } from "./LoadModelButton";
import { CloudModelButton } from "./CloudModelButton";

export function ModelsPanel() {
  const components = useBimStore((state) => state.components);
  const [models, setModels] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!components) {
      setModels([]);
      return;
    }

    const fragments = components.get(OBC.FragmentsManager);

    const updateModelsList = () => {
      setModels(Array.from(fragments.list.values()));
    };

    // Initialize list
    updateModelsList();

    // Listen to changes
    fragments.list.onItemSet.add(updateModelsList);
    fragments.list.onItemDeleted.add(updateModelsList);

    return () => {
      fragments.list.onItemSet.remove(updateModelsList);
      fragments.list.onItemDeleted.remove(updateModelsList);
    };
  }, [components]);

  const handleDownload = (model: any) => {
    if (!components) return;
    try {
      const fragments = components.get(OBC.FragmentsManager);
      const data = fragments.export(model);
      const blob = new Blob([data]);
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = model.name ? model.name : `${model.uuid}.frag`;
      a.click();

      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export/download model:", err);
    }
  };

  const handleDelete = (model: any) => {
    if (!components) return;
    const confirmDelete = confirm(`Are you sure you want to unload "${model.name || model.uuid}"?`);
    if (!confirmDelete) return;

    try {
      const fragments = components.get(OBC.FragmentsManager);
      fragments.disposeGroup(model);
    } catch (err) {
      console.error("Failed to unload model:", err);
    }
  };

  const filteredModels = models.filter((m) => {
    const name = (m.name || m.uuid || "").toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });

  return (
    <div className="react-bui-panel select-none">
      {/* Panel Header */}
      <div className="react-bui-panel-header">
        <Icon name="MODEL" style={{ color: "var(--accent)" }} />
        <span>Models List</span>
      </div>

      {/* Toolbar */}
      <div className="react-bui-toolbar">
        <input
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="react-bui-input"
        />
        <CloudModelButton />
        <LoadModelButton />
      </div>

      {/* Table List container */}
      <div className="react-bui-table">
        {filteredModels.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 border border-dashed border-border rounded-lg m-4 p-4 bg-white/1">
            <Icon name="MODEL" size={32} className="opacity-20 mb-2" />
            <span className="text-xs text-muted text-center font-medium">
              No models loaded
            </span>
            <span className="text-[10px] text-muted/80 text-center mt-1">
              Load a local IFC/FRAG or select from the cloud.
            </span>
          </div>
        ) : (
          <>
            <div className="react-bui-table-header">
              <div>Name</div>
              <div style={{ marginRight: "12px" }}>Schema</div>
              <div>Actions</div>
            </div>

            {filteredModels.map((model) => (
              <div key={model.uuid} className="react-bui-table-row">
                <div className="react-bui-table-cell name-cell">
                  <Icon name="MODEL" size={14} style={{ color: "var(--muted)" }} />
                  <span title={model.name || model.uuid}>{model.name || model.uuid}</span>
                </div>
                
                <div className={`react-bui-table-cell schema-badge ${!model.schema ? "opacity-0 border-none bg-transparent" : ""}`}>
                  {model.schema || ""}
                </div>

                <div className="react-bui-table-cell actions-cell">
                  <button
                    onClick={() => handleDownload(model)}
                    className="react-bui-row-btn"
                    title="Download FRAG"
                    type="button"
                  >
                    <Icon name="DOWNLOAD" size={12} />
                  </button>
                  <button
                    onClick={() => handleDelete(model)}
                    className="react-bui-row-btn btn-delete"
                    title="Unload model"
                    type="button"
                  >
                    <Icon name="CLOSE" size={12} />
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
