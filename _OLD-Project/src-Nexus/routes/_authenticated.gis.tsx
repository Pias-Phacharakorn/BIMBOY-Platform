import { createFileRoute } from "@tanstack/react-router";
import { RittaGisModule } from "@/components/ritta-gis/RittaGisModule";

export const Route = createFileRoute("/_authenticated/gis")({
  ssr: false,
  component: GisPage,
});

function GisPage() {
  // RITTA GIS owns the entire viewport — bypass the standard AppLayout
  // chrome so the Cesium globe acts as the absolute base layer.
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-slate-950">
      <RittaGisModule />
    </div>
  );
}