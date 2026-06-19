import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { BimViewer } from "@/components/bim-viewer/BimViewer";
import { useDigitalTwinStore } from "@/store/useDigitalTwinStore";

export const Route = createFileRoute("/_authenticated/bim")({
  ssr: false,
  component: () => (
    <AppLayout>
      <BimPage />
    </AppLayout>
  ),
});

function BimPage() {
  const active = useDigitalTwinStore((s) => s.bimActive);
  if (!active) return <Disabled />;
  return (
    <div className="h-full">
      <BimViewer />
    </div>
  );
}

function Disabled() {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="max-w-sm rounded-lg border border-dashed border-border bg-card p-6 text-center">
        <h2 className="font-semibold">BIM module disabled</h2>
        <p className="mt-1 text-xs text-muted-foreground">Enable the BIM Viewer module from the sidebar to load the 3D viewport.</p>
      </div>
    </div>
  );
}