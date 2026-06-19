import { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useDigitalTwinStore } from "@/store/useDigitalTwinStore";

/**
 * Lives inside <Canvas/>. Bridges store-level viewer commands to the
 * three.js scene: section-plane clipping + focus-on-element camera moves.
 */
export function ViewerCommands() {
  const { gl, camera, controls, scene } = useThree() as unknown as {
    gl: THREE.WebGLRenderer;
    camera: THREE.PerspectiveCamera;
    scene: THREE.Scene;
    controls: { target: THREE.Vector3; update: () => void } | null;
  };

  const sectionEnabled = useDigitalTwinStore((s) => s.sectionEnabled);
  const sectionY = useDigitalTwinStore((s) => s.sectionY);
  const sectionPlaneCenter = useDigitalTwinStore((s) => s.sectionPlaneCenter);
  const sectionPlaneSize = useDigitalTwinStore((s) => s.sectionPlaneSize);
  const sectionAxisX = useDigitalTwinStore((s) => s.sectionAxisX);
  const sectionAxisZ = useDigitalTwinStore((s) => s.sectionAxisZ);
  const sectionX = useDigitalTwinStore((s) => s.sectionX);
  const sectionZ = useDigitalTwinStore((s) => s.sectionZ);
  const focusTick = useDigitalTwinStore((s) => s.focusTick);
  const focusElementId = useDigitalTwinStore((s) => s.focusElementId);
  const fitTick = useDigitalTwinStore((s) => s.fitTick);
  const screenshotTick = useDigitalTwinStore((s) => s.screenshotTick);
  const applyViewTick = useDigitalTwinStore((s) => s.applyViewTick);
  const homeViewTick = useDigitalTwinStore((s) => s.homeViewTick);
  const setLastCameraState = useDigitalTwinStore((s) => s.setLastCameraState);

  const planeRef = useRef(new THREE.Plane(new THREE.Vector3(0, -1, 0), 2));
  const planeXRef = useRef(new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0));
  const planeZRef = useRef(new THREE.Plane(new THREE.Vector3(0, 0, -1), 0));
  const helperRef = useRef<THREE.Group | null>(null);
  const target = useRef<{ pos: THREE.Vector3; look: THREE.Vector3; t: number } | null>(null);
  const camPublishRef = useRef(0);

  // Enable local clipping once
  useEffect(() => {
    gl.localClippingEnabled = true;
  }, [gl]);

  // Apply / remove clipping plane globally
  useEffect(() => {
    planeRef.current.constant = sectionY;
    planeXRef.current.constant = sectionX;
    planeZRef.current.constant = sectionZ;
    const planes: THREE.Plane[] = [];
    if (sectionEnabled) planes.push(planeRef.current);
    if (sectionAxisX) planes.push(planeXRef.current);
    if (sectionAxisZ) planes.push(planeZRef.current);
    gl.clippingPlanes = planes;
    if (!helperRef.current) {
      const group = new THREE.Group();
      group.userData.bimSectionHelper = true;
      const fill = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({
          color: 0xf59e0b,
          depthWrite: false,
          opacity: 0.05,
          side: THREE.DoubleSide,
          transparent: true,
        }),
      );
      fill.rotation.x = -Math.PI / 2;
      const grid = new THREE.GridHelper(1, 12, 0xf59e0b, 0xf59e0b);
      const gridMat = grid.material as THREE.Material | THREE.Material[];
      if (Array.isArray(gridMat)) gridMat.forEach((m) => { m.transparent = true; m.opacity = 0.25; });
      else { gridMat.transparent = true; gridMat.opacity = 0.25; }
      group.add(fill, grid);
      group.renderOrder = 10;
      helperRef.current = group;
      scene.add(group);
    }
    helperRef.current.visible = sectionEnabled;
    helperRef.current.position.set(sectionPlaneCenter[0], sectionY, sectionPlaneCenter[2]);
    helperRef.current.scale.set(sectionPlaneSize, sectionPlaneSize, sectionPlaneSize);
  }, [gl, scene, sectionEnabled, sectionY, sectionPlaneCenter, sectionPlaneSize, sectionAxisX, sectionAxisZ, sectionX, sectionZ]);

  useEffect(() => {
    return () => {
      if (!helperRef.current) return;
      scene.remove(helperRef.current);
      helperRef.current.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.GridHelper) {
          obj.geometry.dispose();
          const material = obj.material;
          if (Array.isArray(material)) material.forEach((m) => m.dispose());
          else material.dispose();
        }
      });
      helperRef.current = null;
    };
  }, [scene]);

  // Focus handler
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
      if (!child.visible || child.userData.bimSectionHelper) continue;
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

  // Screenshot: render once and download the canvas as PNG.
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

  // Apply a saved view: lerp camera + target.
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

  // Home view: snap to a standard 3/4 perspective.
  useEffect(() => {
    if (homeViewTick === 0) return;
    const box = new THREE.Box3();
    for (const child of scene.children) {
      if (!child.visible || child.userData.bimSectionHelper) continue;
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
    // Publish camera state to the store ~5x/sec for saved-view capture.
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