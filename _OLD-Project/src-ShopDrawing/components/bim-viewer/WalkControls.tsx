import { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { PointerLockControls } from "@react-three/drei";
import * as THREE from "three";
import { useDigitalTwinStore } from "@/store/useDigitalTwinStore";

/**
 * First-person controls driven by the store's walkMode (gravity) / flyMode (fly).
 *  - walkMode = "gravity": stays glued to the top of whatever geometry is under the
 *    camera (raycast downward), so you walk on slabs / roofs / floors.
 *  - flyMode = "fly": free 6DOF — Space = up, Ctrl = down, movement follows look
 *    direction.
 *  - WASD / arrows to move; Shift = run.
 *
 * Only one mode can be active at a time; the toolbar enforces this.
 */
export function WalkControls() {
  const { camera, scene } = useThree();
  const walkMode = useDigitalTwinStore((s) => s.walkMode);
  const flyMode = useDigitalTwinStore((s) => s.flyMode);
  const eyeHeight = useDigitalTwinStore((s) => s.walkEyeHeight);
  const subMode: "fly" | "gravity" = flyMode ? "fly" : "gravity";
  const keys = useRef<Record<string, boolean>>({});
  const velocity = useRef(new THREE.Vector3());
  const down = useRef(new THREE.Vector3(0, -1, 0));
  const raycaster = useRef(new THREE.Raycaster());

  // On enter / mode change, settle the camera once.
  useEffect(() => {
    if (subMode === "gravity") {
      const groundY = sampleGroundY(scene, camera.position, raycaster.current, down.current);
      camera.position.y = (groundY ?? camera.position.y - eyeHeight) + eyeHeight;
    }
  }, [camera, scene, eyeHeight, subMode]);

  useEffect(() => {
    const downKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      keys.current[e.code] = true;
    };
    const upKey = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
    };
    window.addEventListener("keydown", downKey);
    window.addEventListener("keyup", upKey);
    return () => {
      window.removeEventListener("keydown", downKey);
      window.removeEventListener("keyup", upKey);
    };
  }, []);

  useFrame((_, delta) => {
    if (!walkMode && !flyMode) return;
    const k = keys.current;
    const run = k["ShiftLeft"] || k["ShiftRight"];
    const speed = (run ? 6 : 2.5) * delta;

    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    if (subMode === "gravity") forward.y = 0;
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    velocity.current.set(0, 0, 0);
    if (k["KeyW"] || k["ArrowUp"]) velocity.current.add(forward);
    if (k["KeyS"] || k["ArrowDown"]) velocity.current.sub(forward);
    if (k["KeyD"] || k["ArrowRight"]) velocity.current.add(right);
    if (k["KeyA"] || k["ArrowLeft"]) velocity.current.sub(right);

    if (subMode === "fly") {
      if (k["Space"]) velocity.current.y += 1;
      if (k["ControlLeft"] || k["ControlRight"]) velocity.current.y -= 1;
    }

    if (velocity.current.lengthSq() > 0) {
      velocity.current.normalize().multiplyScalar(speed);
      camera.position.add(velocity.current);
    }

    if (subMode === "gravity") {
      const groundY = sampleGroundY(scene, camera.position, raycaster.current, down.current);
      if (groundY !== null) {
        camera.position.y = groundY + eyeHeight;
      } else {
        // Fall back to fixed eye-height plane if nothing is below.
        camera.position.y = eyeHeight;
      }
    }
  });

  return <PointerLockControls makeDefault />;
}

/** Raycast straight down from above the camera, return the world Y of the first hit, or null. */
function sampleGroundY(
  scene: THREE.Scene,
  cameraPos: THREE.Vector3,
  raycaster: THREE.Raycaster,
  down: THREE.Vector3,
): number | null {
  // Start a bit above current camera so we still hit ground when standing on it.
  const origin = new THREE.Vector3(cameraPos.x, cameraPos.y + 50, cameraPos.z);
  raycaster.set(origin, down);
  raycaster.far = 500;
  const targets: THREE.Object3D[] = [];
  scene.traverse((o) => {
    const m = o as THREE.Mesh & { isMesh?: boolean };
    if (!m.visible) return;
    if (!m.isMesh) return;
    if (o.userData.bimClipperHelper) return;
    if (!hasValidRaycastGeometry(m)) return;
    targets.push(o);
  });
  let hits: THREE.Intersection[] = [];
  try {
    hits = raycaster.intersectObjects(targets, false);
  } catch (error) {
    console.warn("[WalkControls] skipped invalid ground raycast target", error);
    return null;
  }
  if (!hits.length) return null;
  return hits[0].point.y;
}

function hasValidRaycastGeometry(mesh: THREE.Mesh) {
  const geom = mesh.geometry as THREE.BufferGeometry | undefined;
  if (!geom || geom.userData?.disposed) return false;

  const pos = geom.attributes?.position as THREE.BufferAttribute | THREE.InterleavedBufferAttribute | undefined;
  const posArray = getAttributeArray(pos);
  if (!pos || !posArray || !Number.isFinite(pos.count) || pos.count <= 0) return false;

  const index = geom.index as THREE.BufferAttribute | undefined;
  const indexArray = index?.array;
  if (index && (!indexArray || !Number.isFinite(index.count) || index.count <= 0)) return false;

  return true;
}

function getAttributeArray(attribute?: THREE.BufferAttribute | THREE.InterleavedBufferAttribute) {
  if (!attribute) return null;
  const candidate = attribute as unknown as { array?: ArrayLike<number>; data?: { array?: ArrayLike<number> } };
  return candidate.array ?? candidate.data?.array ?? null;
}
