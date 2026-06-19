import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { IotDashboard } from "@/components/iot-dashboard/IotDashboard";
import { useDigitalTwinStore } from "@/store/useDigitalTwinStore";

export const Route = createFileRoute("/_authenticated/iot")({
  component: () => (
    <AppLayout>
      <Page />
    </AppLayout>
  ),
});

function Page() {
  const active = useDigitalTwinStore((s) => s.iotActive);
  if (!active)
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-sm rounded-lg border border-dashed border-border bg-card p-6 text-center">
          <h2 className="font-semibold">IoT module disabled</h2>
          <p className="mt-1 text-xs text-muted-foreground">Enable the IoT Dashboard from the sidebar to subscribe to live MQTT data.</p>
        </div>
      </div>
    );
  return <IotDashboard />;
}