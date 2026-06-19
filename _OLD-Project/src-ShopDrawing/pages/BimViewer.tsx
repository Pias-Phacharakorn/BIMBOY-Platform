import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useActiveProject } from "@/hooks/useActiveProject";
import { useDigitalTwinStore } from "@/store/useDigitalTwinStore";
import { BimViewer } from "@/components/bim-viewer/BimViewer";

export default function BimViewerPage() {
  const { current } = useActiveProject();
  const setActiveProjectId = useDigitalTwinStore((s) => s.setActiveProjectId);

  // Sync the page-level active project into the BIM store so persistence
  // and the SourceFiles panel resolve uploads/listings to the right project.
  useEffect(() => {
    setActiveProjectId(current?.id ?? null);
  }, [current?.id, setActiveProjectId]);

  if (!current) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Select a project to view BIM models.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-64px)] w-full">
      <BimViewer />
    </div>
  );
}
