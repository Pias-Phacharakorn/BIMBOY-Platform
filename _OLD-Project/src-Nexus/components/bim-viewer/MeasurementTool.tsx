import { useEffect, useMemo, useRef, useState } from "react";
import { useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { useDigitalTwinStore } from "@/store/useDigitalTwinStore";
import { fragModelRegistry } from "./FragModel";

/**
 * Distance / Area / Angle measurement tool. Lives inside the R3F Canvas.
 * Picks scene intersections (works with both ifcjson element meshes and FRAG
 * model objects). Renders polylines + Html labels with the running value.
 */
export function MeasurementTool() {
  const { camera, gl, scene } = useThree();
  const measureMode = useDigitalTwinStore((s) => s.measureMode);
  const measurePoints = useDigitalTwinStore((s) => s.measurePoints);
  const measurements = useDigitalTwinStore((s) => s.measurements);
  const addMeasurePoint = useDigitalTwinStore((s) => s.addMeasurePoint);
  const commitMeasurement = useDigitalTwinStore((s) => s.commitMeasurement);
  const setMeasureMode = useDigitalTwinStore((s) => s.setMeasureMode);

  const raycaster = useMemo(() => new THREE.Raycaster(), []);

  // Live hover-snap indicator: as the cursor moves while a measure mode is
  // active, raycast against FRAG models with SnappingClass POINT only.
  const [snapHint, setSnapHint] = useState<{
    point: [number, number, number];
  } | null>(null);
  const snapClassesRef = useRef<{
    POINT: unknown;
    list: unknown[];
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { SnappingClass } = await import("@thatopen/fragments");
        if (cancelled) return;
        snapClassesRef.current = {
          POINT: SnappingClass.POINT,
          list: [SnappingClass.POINT],
        };
      } catch {
        snapClassesRef.current = null;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (measureMode === "off") {
      setSnapHint(null);
      return;
    }
    const dom = gl.domElement;
    let raf = 0;
    let pending: { x: number; y: number } | null = null;
    let busy = false;
    async function runSnap() {
      raf = 0;
      if (!pending || busy) return;
      busy = true;
      const { x, y } = pending;
      pending = null;
      const snap = snapClassesRef.current;
      const mouse = new THREE.Vector2(x, y);
      let best: { point: THREE.Vector3; dist: number } | null = null;
      for (const fmodel of fragModelRegistry.values()) {
        try {
          const snapHits = snap && fmodel.raycastWithSnapping
            ? await fmodel.raycastWithSnapping({ camera, mouse, dom, snappingClasses: snap.list })
            : [];
          const arr = Array.isArray(snapHits) ? snapHits : [snapHits].filter(Boolean);
          for (const hit of arr) {
            if (!hit?.point) continue;
            const p = new THREE.Vector3(hit.point.x, hit.point.y, hit.point.z);
            const d = Number.isFinite(hit.rayDistance) ? hit.rayDistance : camera.position.distanceTo(p);
            if (!best || d < best.dist) best = { point: p, dist: d };
          }
        } catch {
          /* ignore */
        }
      }
      busy = false;
      if (best) setSnapHint({ point: [best.point.x, best.point.y, best.point.z] });
      else setSnapHint(null);
      if (pending) raf = requestAnimationFrame(runSnap);
    }
    function onMove(e: MouseEvent) {
      pending = { x: e.clientX, y: e.clientY };
      if (!raf) raf = requestAnimationFrame(runSnap);
    }
    function onLeave() {
      pending = null;
      setSnapHint(null);
    }
    dom.addEventListener("pointermove", onMove);
    dom.addEventListener("pointerleave", onLeave);
    return () => {
      dom.removeEventListener("pointermove", onMove);
      dom.removeEventListener("pointerleave", onLeave);
      if (raf) cancelAnimationFrame(raf);
      setSnapHint(null);
    };
  }, [measureMode, gl, camera]);

  // Click handler for measurement picking.
  useEffect(() => {
    if (measureMode === "off") return;
    const dom = gl.domElement;
    // Follow ThatOpen LengthMeasurement example: place each measurement
    // point with a double-click, finish multi-point measurements with
    // right-click (or Enter). This avoids accidental picks from camera-drag
    // clicks and matches the engine_components UX.
    async function onDblClick(e: MouseEvent) {
      e.preventDefault();
      e.stopPropagation();
      let pickedPoint: THREE.Vector3 | null = null;
      let pickedDist = Infinity;
      // FRAG models use their own picking pipeline — the THREE raycaster
      // won't hit their streamed geometry. Ask each loaded FRAG model first
      // so helpers / grid lines don't steal measurement clicks.
      const screenMouse = new THREE.Vector2(e.clientX, e.clientY);
      let snappingClasses: unknown[] | null = null;
      try {
        const { SnappingClass } = await import("@thatopen/fragments");
        snappingClasses = [SnappingClass.POINT];
      } catch {
        snappingClasses = null;
      }
      for (const fmodel of fragModelRegistry.values()) {
        try {
          const snapHits = snappingClasses && fmodel.raycastWithSnapping
            ? await fmodel.raycastWithSnapping({ camera, mouse: screenMouse, dom, snappingClasses })
            : null;
          let hits = Array.isArray(snapHits) ? snapHits : [];
          if (hits.length === 0) {
            const faceHit = await fmodel.raycast({ camera, mouse: screenMouse, dom });
            if (faceHit) hits = [faceHit];
          }
          for (const hit of hits) {
            if (!hit?.point) continue;
            const hp = new THREE.Vector3(hit.point.x, hit.point.y, hit.point.z);
            const d = Number.isFinite(hit.rayDistance) ? hit.rayDistance : camera.position.distanceTo(hp);
            if (d < pickedDist) {
              pickedDist = d;
              pickedPoint = hp;
            }
          }
        } catch {
          /* ignore */
        }
      }
      if (!pickedPoint) {
        const rect = dom.getBoundingClientRect();
        const mouse = new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1,
        );
        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObjects(scene.children.filter(isPickableObject), true).filter((h) => isPickableObject(h.object));
        if (hits.length) {
          pickedPoint = hits[0].point.clone();
          pickedDist = camera.position.distanceTo(pickedPoint);
        }
      }
      if (!pickedPoint) return;
      addMeasurePoint([pickedPoint.x, pickedPoint.y, pickedPoint.z]);
      const mode = useDigitalTwinStore.getState().measureMode;
      const pts = useDigitalTwinStore.getState().measurePoints;
      // Auto-commit fixed-arity measurements.
      if (mode === "distance" && pts.length === 2) commitMeasurement();
      if (mode === "angle" && pts.length === 3) commitMeasurement();
    }
    function onCtx(e: MouseEvent) {
      e.preventDefault();
      e.stopPropagation();
      // Right-click commits any in-progress measurement (matches the
      // example's "finish on demand" affordance for area / angle modes).
      commitMeasurement();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Enter") commitMeasurement();
      if (e.key === "Escape") setMeasureMode("off");
      if (e.key === "Delete" || e.key === "Backspace") {
        // Drop the in-progress preview by switching off, then back on.
        const m = useDigitalTwinStore.getState().measureMode;
        if (m !== "off") {
          setMeasureMode("off");
          setMeasureMode(m);
        }
      }
    }
    dom.addEventListener("dblclick", onDblClick);
    dom.addEventListener("contextmenu", onCtx);
    window.addEventListener("keydown", onKey);
    // Visual cue while a measure mode is active.
    const prevCursor = dom.style.cursor;
    dom.style.cursor = "crosshair";
    return () => {
      dom.removeEventListener("dblclick", onDblClick);
      dom.removeEventListener("contextmenu", onCtx);
      window.removeEventListener("keydown", onKey);
      dom.style.cursor = prevCursor;
    };
  }, [measureMode, gl, camera, scene, raycaster, addMeasurePoint, commitMeasurement, setMeasureMode]);

  return (
    <group userData={{ bimMeasure: true }}>
      {measurements.map((m) => (
        <MeasureLine key={m.id} points={m.points} label={formatMeasurement(m.kind, m.value)} kind={m.kind} />
      ))}
      {measurePoints.length > 0 && (
        <MeasureLine
          points={measurePoints}
          label={measurePoints.length > 1 ? formatLive(measureMode, measurePoints) : ""}
          kind={measureMode === "off" ? "distance" : measureMode}
          preview
        />
      )}
      {measurePoints.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.06, 12, 12]} />
          <meshBasicMaterial color="#f59e0b" depthTest={false} />
        </mesh>
      ))}
      {snapHint && <SnapIndicator point={snapHint.point} />}
    </group>
  );
}

function SnapIndicator({
  point,
}: {
  point: [number, number, number];
}) {
  const color = "#22d3ee";
  return (
    <group position={point}>
      <mesh>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshBasicMaterial color={color} depthTest={false} transparent opacity={0.95} />
      </mesh>
    </group>
  );
}

function isPickableObject(obj: THREE.Object3D) {
  let current: THREE.Object3D | null = obj;
  while (current) {
    if (current.userData.bimSectionHelper || current.userData.bimMeasure) return false;
    if (current.type === "GridHelper" || current.name.toLowerCase().includes("grid")) return false;
    current = current.parent;
  }
  return true;
}

function MeasureLine({
  points,
  label,
  kind,
  preview,
}: {
  points: [number, number, number][];
  label: string;
  kind: "distance" | "area" | "angle";
  preview?: boolean;
}) {
  const ref = useRef<THREE.BufferGeometry>(null);
  useEffect(() => {
    if (!ref.current) return;
    const arr = new Float32Array(points.flat());
    ref.current.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    if (kind === "area" && points.length >= 3 && !preview) {
      const closed = new Float32Array([...points.flat(), ...points[0]]);
      ref.current.setAttribute("position", new THREE.BufferAttribute(closed, 3));
    }
    ref.current.computeBoundingSphere();
  }, [points, kind, preview]);

  const mid = points[Math.floor(points.length / 2)] ?? points[0];
  return (
    <group>
      <line>
        <bufferGeometry ref={ref} />
        <lineBasicMaterial
          color={preview ? "#fbbf24" : "#f59e0b"}
          linewidth={2}
          depthTest={false}
          transparent
          opacity={preview ? 0.7 : 1}
        />
      </line>
      {label && mid && (
        <Html position={mid} center distanceFactor={10} zIndexRange={[100, 0]}>
          <div className="pointer-events-none rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold text-black shadow">
            {label}
          </div>
        </Html>
      )}
    </group>
  );
}

function formatMeasurement(kind: "distance" | "area" | "angle", v: number) {
  if (kind === "distance") return `${v.toFixed(2)} m`;
  if (kind === "area") return `${v.toFixed(2)} m²`;
  return `${v.toFixed(1)}°`;
}

function formatLive(
  mode: "off" | "distance" | "area" | "angle",
  pts: [number, number, number][],
) {
  if (mode === "distance" && pts.length >= 2) {
    const [a, b] = pts;
    return `${Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]).toFixed(2)} m`;
  }
  if (mode === "area" && pts.length >= 2) return `${pts.length} pts (right-click to finish)`;
  if (mode === "angle" && pts.length >= 2) return `${pts.length}/3`;
  return "";
}