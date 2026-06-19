import { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useDigitalTwinStore } from "@/store/useDigitalTwinStore";

export function ViewerCommands() {
  const { gl, camera, controls, scene } = useThree() as unknown as {
    gl: THREE.WebGLRenderer;
    camera: THREE.PerspectiveCamera;
    scene: THREE.Scene;
    controls: { target: THREE.Vector3; update: () => void } | null;
  };

  const focusTick = useDigitalTwinStore((s) => s.focusTick);
  const focusElementId = useDigitalTwinStore((s) => s.focusElementId);
  const fitTick = useDigitalTwinStore((s) => s.fitTick);
  const screenshotTick = useDigitalTwinStore((s) => s.screenshotTick);
  const applyViewTick = useDigitalTwinStore((s) => s.applyViewTick);
  const homeViewTick = useDigitalTwinStore((s) => s.homeViewTick);
  const setLastCameraState = useDigitalTwinStore((s) => s.setLastCameraState);

  const target = useRef<{ pos: THREE.Vector3; look: THREE.Vector3; t: number } | null>(null);
  const camPublishRef = useRef(0);

  useEffect(() => {
    gl.localClippingEnabled = true;
  }, [gl]);


  useEffect(() => {
    if (!focusElementId) return;
    const model = useDigitalTwinStore.getState().activeIfcModel;
    const el = model?.elements.find((e) => e.id === focusElementId);
    if (!el) return;
    const center = new THREE.Vector3(el.position[0], el.position[1], el.position[2]);
    const maxDim = Math.max(el.size[0], el.size[1], el.size[2], 0.5);
    const dist = maxDim * 3.5 + 2;
    const dir = new THREE.Vector3(1, 0.8, 1).normalize();
    const pos = center.clone().add(dir.multiplyScalar(dist));
    target.current = { pos, look: center, t: 0 };
  }, [focusTick, focusElementId]);

  useEffect(() => {
    if (fitTick === 0) return;
    const box = new THREE.Box3();
    for (const child of scene.children) {
      if (!child.visible || child.userData.bimClipperHelper) continue;
      if (child.type === "GridHelper" || child.name.toLowerCase().includes("grid")) continue;
      box.expandByObject(child);
    }
    if (box.isEmpty()) return;
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);
    const radius = Math.max(size.x, size.y, size.z, 1);
    const dir = new THREE.Vector3(1, 0.75, 1).normalize();
    target.current = { pos: center.clone().add(dir.multiplyScalar(radius * 1.4)), look: center, t: 0 };
    camera.near = Math.max(0.1, radius / 1000);
    camera.far = radius * 100;
    camera.updateProjectionMatrix();
  }, [fitTick, scene, camera]);

  useEffect(() => {
    if (screenshotTick === 0) return;
    try {
      gl.render(scene, camera);
      const url = gl.domElement.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `bim-view-${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error("[screenshot] failed", err);
    }
  }, [screenshotTick, gl, scene, camera]);

  useEffect(() => {
    if (applyViewTick === 0) return;
    const v = useDigitalTwinStore.getState().pendingView;
    if (!v) return;
    target.current = {
      pos: new THREE.Vector3(...v.camera.pos),
      look: new THREE.Vector3(...v.camera.target),
      t: 0,
    };
  }, [applyViewTick]);

  useEffect(() => {
    if (homeViewTick === 0) return;
    const box = new THREE.Box3();
    for (const child of scene.children) {
      if (!child.visible || child.userData.bimClipperHelper) continue;
      if (child.type === "GridHelper") continue;
      box.expandByObject(child);
    }
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    if (!box.isEmpty()) {
      box.getCenter(center);
      box.getSize(size);
    }
    const radius = Math.max(size.x || 5, size.y || 5, size.z || 5);
    const dir = new THREE.Vector3(1, 0.75, 1).normalize();
    target.current = { pos: center.clone().add(dir.multiplyScalar(radius * 1.6)), look: center, t: 0 };
  }, [homeViewTick, scene]);

  useFrame((_, delta) => {
    camPublishRef.current += delta;
    if (camPublishRef.current > 0.2) {
      camPublishRef.current = 0;
      const t = controls?.target ?? new THREE.Vector3();
      setLastCameraState({
        pos: [camera.position.x, camera.position.y, camera.position.z],
        target: [t.x, t.y, t.z],
      });
    }
    if (!target.current) return;
    const t = (target.current.t = Math.min(1, target.current.t + delta * 1.6));
    const ease = 1 - Math.pow(1 - t, 3);
    camera.position.lerp(target.current.pos, ease * 0.25);
    if (controls?.target) {
      controls.target.lerp(target.current.look, ease * 0.25);
      controls.update();
    } else {
      camera.lookAt(target.current.look);
    }
    if (t >= 1) target.current = null;
  });

  return null;
}
