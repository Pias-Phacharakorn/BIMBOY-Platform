import React from "react";

interface CustomViewViewProps {
  activeTab: string;
}

export function CustomViewView({ activeTab }: CustomViewViewProps) {
  return (
    <div className="flex flex-col w-full h-full items-center justify-center p-8 bg-[#0d0e12] text-muted border border-border rounded-lg">
      <div className="text-lg font-bold text-fg mb-2">{activeTab} View</div>
      <div className="text-xs opacity-75">This tab is ready for custom component implementation.</div>
    </div>
  );
}
