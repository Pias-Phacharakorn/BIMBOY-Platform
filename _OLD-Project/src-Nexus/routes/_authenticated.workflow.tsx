import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { WorkflowEngine } from "@/components/workflow-engine/WorkflowEngine";
import { useDigitalTwinStore } from "@/store/useDigitalTwinStore";

export const Route = createFileRoute("/_authenticated/workflow")({
  component: () => (
    <AppLayout>
      <Page />
    </AppLayout>
  ),
});

function Page() {
  const active = useDigitalTwinStore((s) => s.workflowActive);
  if (!active)
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-sm rounded-lg border border-dashed border-border bg-card p-6 text-center">
          <h2 className="font-semibold">Workflow module disabled</h2>
          <p className="mt-1 text-xs text-muted-foreground">Enable the Threshold & Workflow Engine from the sidebar to run automations.</p>
        </div>
      </div>
    );
  return (
    <div className="h-full">
      <WorkflowEngine />
    </div>
  );
}