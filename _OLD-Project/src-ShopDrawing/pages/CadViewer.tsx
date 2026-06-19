import { useState, useRef, useCallback } from "react";
import CadFileUpload from "@/components/cad/CadFileUpload";
import CadFileList from "@/components/cad/CadFileList";
import CadCanvas, { DatabaseInfo, LayerInfo, insunitsToLabel, CadViewEntityOps } from "@/components/cad/CadCanvas";
import MarkupToolbar from "@/components/cad/MarkupToolbar";
import LayerPanel from "@/components/cad/LayerPanel";
import { supabase } from "@/integrations/supabase/client";
import { canManageDrawings } from "@/types/roles";
import { useUserRole } from "@/hooks/useUserRole";
import { useActiveProject } from "@/hooks/useActiveProject";

interface SelectedFile {
  id: string;
  name: string;
  file_url: string | null;
  file_type: string;
}

const CadViewer = () => {
  const { selectedProject } = useActiveProject();
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const { role } = useUserRole();

  const [layers, setLayers] = useState<LayerInfo[]>([]);
  const [cadUnits, setCadUnits] = useState<string>('units');
  const [worldTransformFn, setWorldTransformFn] = useState<
    ((pt: { x: number; y: number }) => { x: number; y: number }) | null
  >(null);
  const [entityOps, setEntityOps] = useState<CadViewEntityOps | null>(null);
  const [viewerContainer, setViewerContainer] = useState<HTMLDivElement | null>(null);

  const layerToggleFnRef = useRef<((layerName: string, isOff: boolean) => void) | null>(null);

  const handleDatabaseLoaded = useCallback((info: DatabaseInfo) => {
    setLayers(info.layers);
    setCadUnits(insunitsToLabel(info.insunits));
  }, []);

  const handleWorldTransformReady = useCallback(
    (fn: ((pt: { x: number; y: number }) => { x: number; y: number }) | null) => {
      setWorldTransformFn(() => fn);
    },
    []
  );

  const handleLayerToggleReady = useCallback(
    (fn: ((layerName: string, isOff: boolean) => void) | null) => {
      layerToggleFnRef.current = fn;
    },
    []
  );

  const handleEntityOpsReady = useCallback(
    (ops: CadViewEntityOps | null) => {
      setEntityOps(ops);
    },
    []
  );

  const handleToggleLayer = useCallback((layerName: string, isOff: boolean) => {
    layerToggleFnRef.current?.(layerName, isOff);
    setLayers(prev =>
      prev.map(l => l.name === layerName ? { ...l, isOff } : l)
    );
  }, []);

  const handleAnnotationsChange = useCallback(async (annotations: any[]) => {
    if (!selectedFile) return;
    await supabase.from('cad_files').update({ annotations }).eq('id', selectedFile.id);
  }, [selectedFile]);

  const handleOpenFile = useCallback((f: SelectedFile) => {
    setSelectedFile(f);
    setLayers([]);
    setCadUnits('units');
    setWorldTransformFn(null);
    setEntityOps(null);
    layerToggleFnRef.current = null;
  }, []);

  const sidebar = (
    <>
      <div className="p-3 border-b">
        <h2 className="font-semibold text-sm">CAD Files</h2>
      </div>
      {selectedProject && canManageDrawings(role) && (
        <div className="p-3 border-b">
          <CadFileUpload projectId={selectedProject} onUploadComplete={() => setRefreshKey(k => k + 1)} />
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-2">
        {selectedProject ? (
          <CadFileList
            projectId={selectedProject}
            refreshKey={refreshKey}
            onOpenFile={handleOpenFile}
          />
        ) : (
          <p className="text-sm text-muted-foreground p-2">Select a project first.</p>
        )}
      </div>
      {layers.length > 0 && (
        <div className="border-t">
          <LayerPanel layers={layers} onToggleLayer={handleToggleLayer} />
        </div>
      )}
    </>
  );

  return (
    <div className="h-full bg-background flex flex-col overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — desktop */}
        <aside className="w-64 border-r bg-background flex flex-col shrink-0 hidden md:flex">
          {sidebar}
        </aside>

        {/* Main viewer area */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Mobile: file list + layer panel */}
          <div className="md:hidden p-3 border-b space-y-3">
            {selectedProject && canManageDrawings(role) && (
              <CadFileUpload projectId={selectedProject} onUploadComplete={() => setRefreshKey(k => k + 1)} />
            )}
            {selectedProject && (
              <CadFileList
                projectId={selectedProject}
                refreshKey={refreshKey}
                onOpenFile={handleOpenFile}
              />
            )}
            {layers.length > 0 && (
              <LayerPanel layers={layers} onToggleLayer={handleToggleLayer} />
            )}
          </div>

          {selectedFile && (
            <MarkupToolbar
              viewerContainer={viewerContainer}
              onAnnotationsChange={handleAnnotationsChange}
              worldTransform={worldTransformFn}
              cadUnits={cadUnits}
              entityOps={entityOps}
            />
          )}

          <div className="flex-1">
            <CadCanvas
              fileUrl={selectedFile?.file_url || null}
              fileType={selectedFile?.file_type || 'dwg'}
              onDatabaseLoaded={handleDatabaseLoaded}
              onWorldTransformReady={handleWorldTransformReady}
              onLayerToggleReady={handleLayerToggleReady}
              onEntityOpsReady={handleEntityOpsReady}
              onContainerRef={setViewerContainer}
            />
          </div>
        </main>
      </div>
    </div>
  );
};

export default CadViewer;
