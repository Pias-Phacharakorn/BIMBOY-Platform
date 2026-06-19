import { Suspense, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  Grid,
  Environment,
  GizmoHelper,
  GizmoViewcube,
  AdaptiveDpr,
  AdaptiveEvents,
} from "@react-three/drei";
import * as THREE from "three";
import { useDigitalTwinStore, IfcElement, getElementLevel } from "@/store/useDigitalTwinStore";
import { PropertiesPanel } from "./PropertiesPanel";
import { SourceFilesPanel } from "./SourceFilesPanel";
import { IotOverlay } from "./IotOverlay";
import { FragModel } from "./FragModel";
import { BimToolbar } from "./BimToolbar";
import { ViewerCommands } from "./ViewerCommands";
import { MiniMap } from "./MiniMap";
import { BimShortcuts } from "./BimShortcuts";
import { MeasurementTool } from "./MeasurementTool";
import { WalkControls } from "./WalkControls";
import { useBimPersistence } from "@/hooks/useBimPersistence";
import { useMqttMappingPersistence } from "@/hooks/useMqttMappingPersistence";
import { Box as BoxIcon, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Home } from "lucide-react";

function ElementMesh({ el }: { el: IfcElement }) {
  const mesh = useRef<THREE.Mesh>(null);
  const selectedId = useDigitalTwinStore((s) => s.selectedElementId);
  const alert = useDigitalTwinStore((s) => s.alertStates[el.id]);
  const select = useDigitalTwinStore((s) => s.selectElement);
  const hidden = useDigitalTwinStore((s) => !!s.hiddenIds[el.id]);
  const isolatedElementId = useDigitalTwinStore((s) => s.isolatedElementId);
  const catHidden = useDigitalTwinStore((s) => !!s.hiddenCategories[el.type]);
  const lvlHidden = useDigitalTwinStore((s) => !!s.hiddenLevels[getElementLevel(el)]);
  const ghostMode = useDigitalTwinStore((s) => s.ghostMode);
  const isSelected = selectedId === el.id;
  const isolateHidden = isolatedElementId != null && isolatedElementId !== el.id;
  const effectiveHidden = hidden || catHidden || lvlHidden || isolateHidden;

  useFrame(({ clock }) => {
    if (!mesh.current) return;
    const m = mesh.current.material as THREE.MeshStandardMaterial;
    if (alert) {
      const pulse = (Math.sin(clock.elapsedTime * 4) + 1) / 2;
      m.emissive = new THREE.Color(alert.level === "critical" ? "#ef4444" : "#f59e0b");
      m.emissiveIntensity = 0.4 + pulse * 0.6;
    } else if (isSelected) {
      m.emissive = new THREE.Color("#f59e0b");
      m.emissiveIntensity = 0.35;
    } else {
      m.emissiveIntensity = 0;
    }
  });

  return (
    <mesh
      ref={mesh}
      visible={ghostMode || !effectiveHidden}
      position={el.position}
      onClick={(e) => {
        e.stopPropagation();
        select(el.id);
      }}
    >
      <boxGeometry args={el.size} />
      <meshStandardMaterial
        color={el.color}
        metalness={0.2}
        roughness={0.6}
        transparent={ghostMode}
        opacity={ghostMode ? 0.1 : 1}
      />
    </mesh>
  );
}

export function BimViewer() {
  const models = useDigitalTwinStore((s) => s.models);
  const select = useDigitalTwinStore((s) => s.selectElement);
  const requestHomeView = useDigitalTwinStore((s) => s.requestHomeView);
  const quality = useDigitalTwinStore((s) => s.qualityPreset);
  const walkMode = useDigitalTwinStore((s) => s.walkMode);
  const ghostMode = useDigitalTwinStore((s) => s.ghostMode);
  useBimPersistence();
  useMqttMappingPersistence();
  const [filterCollapsed, setFilterCollapsed] = useState(false);
  const [propsCollapsed, setPropsCollapsed] = useState(false);

  const hasAnyModel = models.length > 0;
  const hasFrag = models.some((m) => m.fileType === "frag");

  const aa = quality !== "low";
  const showShadows = quality === "high";
  const showEnv = quality !== "low";
  const dpr: [number, number] = quality === "low" ? [0.6, 1] : quality === "medium" ? [1, 1.5] : [1, 2];

  const headline =
    models.length === 0 ? "Loading…" : models.length === 1 ? models[0].name : `${models.length} models · federated`;
  const totalElements = models.reduce((sum, m) => sum + (m.visible ? m.elements.length : 0), 0);

  return (
    <div className="relative flex h-full w-full min-h-0 min-w-0">
      <aside
        className={`${filterCollapsed ? "w-10" : "w-72"} shrink-0 border-r border-border bg-card overflow-auto transition-all duration-200`}
      >
        {filterCollapsed ? (
          <button
            onClick={() => setFilterCollapsed(false)}
            className="flex h-full w-full flex-col items-center gap-2 py-3 text-muted-foreground hover:text-foreground"
            title="Expand filter panel"
          >
            <PanelLeftOpen className="h-4 w-4" />
            <span className="text-xs font-semibold [writing-mode:vertical-rl]">Filter</span>
          </button>
        ) : (
          <FilterPanel onCollapse={() => setFilterCollapsed(true)} />
        )}
      </aside>
      <div className="relative flex-1 min-w-0 min-h-0">
        <div className="absolute left-4 top-4 z-10 flex items-center gap-2 rounded-md bg-card/80 px-3 py-2 backdrop-blur border border-border">
          <BoxIcon className="h-4 w-4 text-accent" />
          <span className="text-sm font-medium">{headline}</span>
          <span className="text-xs text-muted-foreground">· {totalElements} elements</span>
        </div>
        <BimToolbar />
        <button
          onClick={() => requestHomeView()}
          className="absolute right-[164px] top-3 z-20 flex h-8 w-8 items-center justify-center text-cyan-400 hover:text-cyan-300"
        >
          <Home className="h-5 w-5" />
        </button>
        <Canvas
          shadows={showShadows ? "percentage" : false}
          dpr={dpr}
          camera={{ position: [6, 5, 7], fov: 50 }}
          gl={{ preserveDrawingBuffer: true, powerPreference: "high-performance", antialias: aa }}
          onPointerMissed={() => {
            // FRAG clicks are handled by FragModel's raycast — ignore R3F miss.
            if (hasFrag) return;
            select(null);
          }}
          style={{ background: "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)" }}
        >
          <ambientLight intensity={0.6} />
          <directionalLight position={[5, 8, 5]} intensity={1.1} castShadow={showShadows} />
          {showEnv && (
            <Suspense fallback={null}>
              <Environment preset="city" />
            </Suspense>
          )}
          <AdaptiveDpr pixelated />
          <AdaptiveEvents />
          <Grid args={[20, 20]} cellColor="#334155" sectionColor="#475569" infiniteGrid fadeDistance={30} />
          {models.map((m) =>
            m.fileType === "frag" ? (
              <FragModel key={m.id} model={m} />
            ) : (
              (m.visible || ghostMode) && m.elements.map((el) => <ElementMesh key={el.id} el={el} />)
            ),
          )}
          {walkMode ? <WalkControls /> : <OrbitControls makeDefault enableDamping />}
          <GizmoHelper alignment="top-right" margin={[80, 80]}>
            <GizmoViewcube color="#22d3ee" textColor="#ff3df0" strokeColor="#00ffe0" hoverColor="#ff3df0" />
          </GizmoHelper>
          <ViewerCommands />
          <MiniMap />
          <MeasurementTool />
        </Canvas>

        <IotOverlay />
      </div>
      <BimShortcuts />
      <aside
        className={`${propsCollapsed ? "w-10" : "w-80"} shrink-0 border-l border-border bg-card overflow-auto flex flex-col transition-all duration-200`}
      >
        {propsCollapsed ? (
          <button
            onClick={() => setPropsCollapsed(false)}
            className="flex h-full w-full flex-col items-center gap-2 py-3 text-muted-foreground hover:text-foreground"
            title="Expand properties panel"
          >
            <PanelRightOpen className="h-4 w-4" />
            <span className="text-xs font-semibold [writing-mode:vertical-rl]">Properties</span>
          </button>
        ) : (
          <PropertiesPanel onCollapse={() => setPropsCollapsed(true)} />
        )}
      </aside>
    </div>
  );
}

function FilterPanel({ onCollapse }: { onCollapse: () => void }) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3 sticky top-0 bg-card z-10">
        <h3 className="text-sm font-semibold">Filter</h3>
        <button
          onClick={onCollapse}
          className="text-muted-foreground hover:text-foreground"
          title="Collapse filter panel"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>
      <SourceFilesPanel />
    </div>
  );
}
