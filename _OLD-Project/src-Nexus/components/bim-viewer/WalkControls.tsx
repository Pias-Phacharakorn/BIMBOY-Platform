import { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { PointerLockControls } from "@react-three/drei";
import * as THREE from "three";
import { useDigitalTwinStore } from "@/store/useDigitalTwinStore";

/**
 * First-person walk mode: PointerLock for mouse-look + WASD for movement,
 * Space to jump (small hop), Shift to sprint. Camera y is clamped to the
 * configured eye height so users walk at ~1.7 m above ground.
 */
export function WalkControls() {
  const { camera } = useThree();
  const eyeHeight = useDigitalTwinStore((s) => s.walkEyeHeight);
  const keys = useRef<Record<string, boolean>>({});
  const velocity = useRef(new THREE.Vector3());

  useEffect(() => {
    // Snap camera to eye height when entering walk mode.
    camera.position.y = eyeHeight;
  }, [camera, eyeHeight]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      keys.current[e.code] = true;
    };
    const up = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useFrame((_, delta) => {
    const k = keys.current;
    const speed = (k["ShiftLeft"] || k["ShiftRight"] ? 6 : 2.5) * delta;
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
    velocity.current.set(0, 0, 0);
    if (k["KeyW"] || k["ArrowUp"]) velocity.current.add(forward);
    if (k["KeyS"] || k["ArrowDown"]) velocity.current.sub(forward);
    if (k["KeyD"] || k["ArrowRight"]) velocity.current.add(right);
    if (k["KeyA"] || k["ArrowLeft"]) velocity.current.sub(right);
    if (velocity.current.lengthSq() > 0) {
      velocity.current.normalize().multiplyScalar(speed);
      camera.position.add(velocity.current);
    }
    // Lock to eye height (no gravity / collision yet).
    camera.position.y = eyeHeight;
  });

  return <PointerLockControls makeDefault />;
}
