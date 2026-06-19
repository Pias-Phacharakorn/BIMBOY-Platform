import React from "react";
import { ViewportWrapper } from "../../components/ViewportWrapper";
import { ModelsPanel } from "./ModelsPanel";

interface ViewerViewProps {
  activeTab: string;
}

export function ViewerView({ activeTab }: ViewerViewProps) {
  const showSidebar = activeTab === "Models";

  return (
    <div className="flex w-full h-full min-h-0 bg-[#0d0e12] overflow-hidden gap-3 p-3">
      {/* Left Sidebar Panel: Only models panel is fully migrated for now */}
      {showSidebar && (
        <div className="w-72 flex-shrink-0 h-full">
          <ModelsPanel />
        </div>
      )}

      {/* Center Viewport Panel */}
      <div className="flex-1 h-full min-w-0 relative rounded-lg overflow-hidden border border-border">
        <ViewportWrapper />
      </div>
    </div>
  );
}
