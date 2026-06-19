import { useEffect, useMemo, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";

export function MiniMap({ size = 200, padding = 16 }: { size?: number; padding?: number }) {
  const { scene, camera, gl, size: viewport } = useThree();
  const boundsRef = useRef({
    box: new THREE.Box3(),
    center: new THREE.Vector3(),
    size: new THREE.Vector3(),
    half: 10,
    nextUpdate: 0,
    valid: false,
  });
  const camDir = useRef(new THREE.Vector3());
  const prevClear = useRef(new THREE.Color());
  const prevViewport = useRef(new THREE.Vector4());
  const prevScissor = useRef(new THREE.Vector4());

  const ortho = useMemo(() => {
    const cam = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 5000);
    cam.up.set(0, 0, -1);
    return cam;
  }, []);

  const overlay = useMemo(() => new THREE.Scene(), []);
  const marker = useMemo(() => {
    const g = new THREE.Group();
    const triGeom = new THREE.BufferGeometry();
    triGeom.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([0, 0, -1.2, -0.8, 0, 0.8, 0.8, 0, 0.8], 3),
    );
    triGeom.setIndex([0, 1, 2]);
    const tri = new THREE.Mesh(
      triGeom,
      new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide, depthTest: false }),
    );
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1.1, 24),
      new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.6,
        depthTest: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    tri.renderOrder = 999;
    ring.renderOrder = 999;
    g.add(tri, ring);
    return g;
  }, []);

  useEffect(() => {
    overlay.add(marker);
    return () => {
      overlay.remove(marker);
    };
  }, [overlay, marker]);

  const borderRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const parent = gl.domElement.parentElement;
    if (!parent) return;
    const el = document.createElement("div");
    el.style.cssText = `position:absolute;right:${padding}px;bottom:${padding}px;width:${size}px;height:${size}px;border:1px solid hsl(217 33% 25%);border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.4);pointer-events:none;z-index:5;`;
    parent.appendChild(el);
    borderRef.current = el;
    return () => {
      el.remove();
      borderRef.current = null;
    };
  }, [gl, size, padding]);

  useFrame(({ clock }) => {
    if (clock.elapsedTime >= boundsRef.current.nextUpdate) {
      const { box, center, size: sizeV } = boundsRef.current;
      box.makeEmpty();
      scene.traverse((obj) => {
        if (!obj.visible || obj.userData.bimClipperHelper) return;
        if (obj.type === "GridHelper") return;
        const name = (obj.name || "").toLowerCase();
        if (name.includes("grid") || name.includes("infinite")) return;
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        box.expandByObject(mesh);
      });
      boundsRef.current.valid = !box.isEmpty();
      if (boundsRef.current.valid) {
        box.getCenter(center);
        box.getSize(sizeV);
        boundsRef.current.half = Math.max(sizeV.x, sizeV.z, 4) * 0.7;
      }
      boundsRef.current.nextUpdate = clock.elapsedTime + 0.5;
    }

    if (!boundsRef.current.valid) return;

    const { box, center, size: sizeV, half } = boundsRef.current;

    ortho.left = -half;
    ortho.right = half;
    ortho.top = half;
    ortho.bottom = -half;
    ortho.position.set(center.x, box.max.y + Math.max(sizeV.y, 10) * 2, center.z);
    ortho.lookAt(center.x, center.y, center.z);
    ortho.updateProjectionMatrix();

    camera.getWorldDirection(camDir.current);
    const heading = Math.atan2(camDir.current.x, camDir.current.z);
    marker.position.set(camera.position.x, center.y, camera.position.z);
    marker.rotation.set(0, heading + Math.PI, 0);
    marker.scale.setScalar(half * 0.06);

    const inset = Math.min(
      size,
      Math.max(96, viewport.width - padding * 2),
      Math.max(96, viewport.height - padding * 2),
    );
    const x = viewport.width - inset - padding;
    const y = padding;

    const prevAutoClear = gl.autoClear;
    const prevScissorTest = gl.getScissorTest();
    gl.getViewport(prevViewport.current);
    gl.getScissor(prevScissor.current);
    gl.getClearColor(prevClear.current);
    const prevAlpha = gl.getClearAlpha();
    const prevShadowEnabled = gl.shadowMap.enabled;

    gl.autoClear = false;
    gl.setScissorTest(true);
    gl.setScissor(x, y, inset, inset);
    gl.setViewport(x, y, inset, inset);

    gl.setClearColor(0x0f172a, 0.95);
    gl.clear(true, true, false);
    gl.setClearColor(prevClear.current, prevAlpha);

    gl.shadowMap.enabled = false;
    gl.render(scene, ortho);
    gl.clearDepth();
    gl.render(overlay, ortho);
    gl.shadowMap.enabled = prevShadowEnabled;

    gl.autoClear = prevAutoClear;
    gl.setScissorTest(prevScissorTest);
    gl.setViewport(prevViewport.current);
    gl.setScissor(prevScissor.current);
  }, 2);

  return null;
}
