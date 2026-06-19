import { useCallback, useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import * as OBC from "@thatopen/components";
import { useDigitalTwinStore } from "@/store/useDigitalTwinStore";
import { fragModelRegistry } from "./FragModel";
import { useSharedFragments } from "./FragmentsProvider";
import {
  setThatOpenClipperPlanes,
  setClearClipperPlanesFn,
  setDeleteSelectedClipperPlaneFn,
} from "./ThatOpenClipperBridge";

export function ClipperTool() {
  const orbitControls = useThree((s) => s.controls) as unknown as { enabled: boolean } | null;
  const { gl, scene, camera } = useThree() as unknown as {
    gl: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
  };

  const enabled = useDigitalTwinStore((s) => s.clipperEnabled);
  const setClipperPlaneCount = useDigitalTwinStore((s) => s.setClipperPlaneCount);
  const fragments = useSharedFragments();

  const componentsRef = useRef<OBC.Components | null>(null);
  const worldRef = useRef<any>(null);
  const clipperRef = useRef<OBC.Clipper | null>(null);
  const raycaster = useRef(new THREE.Raycaster());
  const lastInteractedIdRef = useRef<string | null>(null);

  const syncClipper = useCallback(() => {
    const clipper = clipperRef.current;
    if (!clipper) return;

    const planes = [...clipper.list.values()].filter((plane) => plane.enabled).map((plane) => plane.three);

    gl.localClippingEnabled = true;
    gl.clippingPlanes = [];
    setThatOpenClipperPlanes(planes);
    setClipperPlaneCount(planes.length);

    scene.traverse((o) => {
      if (o.userData.bimClipperHelper) return;
      const mesh = o as THREE.Mesh;
      const mat = (mesh as any).material as THREE.Material | THREE.Material[] | undefined;
      if (!mat) return;
      const list = Array.isArray(mat) ? mat : [mat];
      for (const m of list) {
        (m as any).clippingPlanes = planes;
        (m as any).clipIntersection = false;
        m.needsUpdate = true;
      }
    });

    fragments?.update(true).catch(() => {});
  }, [fragments, gl, scene, setClipperPlaneCount]);

  useEffect(() => {
    gl.localClippingEnabled = true;
    const components = createClipperComponents();
    const world = createClipperWorld(components, scene, camera, gl);
    const clipper = components.get(OBC.Clipper);
    clipper.localClippingPlanes = true;
    clipper.autoScalePlanes = true;
    clipper.setup({ color: new THREE.Color(0xf59e0b), opacity: 0.01, size: 0.5 });
    clipper.enabled = false;
    clipper.visible = true;

    componentsRef.current = components;
    worldRef.current = world;
    clipperRef.current = clipper;

    const update = () => {
      markClipperHelpers(clipper);
      syncClipper();
    };
    clipper.onAfterCreate.add(update);
    clipper.onAfterDelete.add(update);
    clipper.onAfterDrag.add(update);

    const trackLast = (plane: any) => {
      const id = [...clipper.list.entries()].find(([, p]) => p === plane)?.[0];
      if (id) lastInteractedIdRef.current = id;
    };
    clipper.onAfterCreate.add(trackLast);
    clipper.onAfterDrag.add(trackLast);

    setClearClipperPlanesFn(() => {
      clipper.deleteAll();
      lastInteractedIdRef.current = null;
      syncClipper();
    });
    setDeleteSelectedClipperPlaneFn(() => {
      const world = worldRef.current;
      if (!world) return;
      const id = lastInteractedIdRef.current;
      if (id && clipper.list.has(id)) {
        clipper.delete(world, id);
      } else {
        // fallback: delete hovered, or last in list
        const ids = [...clipper.list.keys()];
        if (ids.length === 0) return;
        const before = ids.length;
        clipper.delete(world);
        if (clipper.list.size === before) {
          clipper.delete(world, ids[ids.length - 1]);
        }
      }
      lastInteractedIdRef.current = null;
      syncClipper();
    });
    syncClipper();

    return () => {
      clipper.onAfterCreate.remove(update);
      clipper.onAfterDelete.remove(update);
      clipper.onAfterDrag.remove(update);
      clipper.onAfterCreate.remove(trackLast);
      clipper.onAfterDrag.remove(trackLast);
      clipper.deleteAll();
      setClearClipperPlanesFn(null);
      setDeleteSelectedClipperPlaneFn(null);
      setThatOpenClipperPlanes([]);
      setClipperPlaneCount(0);
      gl.clippingPlanes = [];
      scene.traverse((o) => {
        const mat = (o as any).material as THREE.Material | THREE.Material[] | undefined;
        if (!mat) return;
        const list = Array.isArray(mat) ? mat : [mat];
        for (const m of list) {
          (m as any).clippingPlanes = [];
          m.needsUpdate = true;
        }
      });
      components.dispose();
      componentsRef.current = null;
      worldRef.current = null;
      clipperRef.current = null;
    };
  }, [camera, gl, scene, setClipperPlaneCount, syncClipper]);

  // Disable orbit controls while dragging a clipper gizmo
  useEffect(() => {
    const clipper = clipperRef.current;
    if (!clipper) return;
    const attach = (plane: any) => {
      const onStart = () => {
        if (orbitControls) orbitControls.enabled = false;
      };
      const onEnd = () => {
        if (orbitControls) orbitControls.enabled = true;
      };
      plane.onDraggingStarted.add(onStart);
      plane.onDraggingEnded.add(onEnd);
    };
    clipper.onAfterCreate.add(attach);
    for (const p of clipper.list.values()) attach(p);
    return () => {
      clipper.onAfterCreate.remove(attach);
    };
  }, [orbitControls]);

  useEffect(() => {
    const clipper = clipperRef.current;
    if (clipper) clipper.enabled = enabled;
  }, [enabled]);

  useEffect(() => {
    const dom = gl.domElement;
    const handle = async (e: MouseEvent) => {
      const clipper = clipperRef.current;
      const world = worldRef.current;
      if (!clipper?.enabled || !world) return;
      e.preventDefault();
      e.stopPropagation();

      const hit = await pickSurface(e, dom, camera, scene, raycaster.current);
      if (!hit) return;

      const normal = hit.normal.clone().normalize().negate();
      const id = clipper.createFromNormalAndCoplanarPoint(world, normal, hit.point.clone());
      const plane = clipper.list.get(id);
      if (plane) {
        plane.visible = true;
      }
      markClipperHelpers(clipper);
      syncClipper();
    };
    dom.addEventListener("dblclick", handle);
    return () => dom.removeEventListener("dblclick", handle);
  }, [camera, gl, scene, syncClipper]);

  useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      const clipper = clipperRef.current;
      const world = worldRef.current;
      if (!clipper?.enabled || !world) return;
      if (e.code !== "Delete" && e.code !== "Backspace") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const before = [...clipper.list.keys()];
      await clipper.delete(world);
      if (before.length === clipper.list.size && before.length > 0) {
        clipper.delete(world, before[before.length - 1]);
      }
      syncClipper();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [syncClipper]);

  return null;
}

function createClipperComponents() {
  const instances = new Map<string, any>();
  const fakeFragments = {
    initialized: false,
    onFragmentsLoaded: createEvent(),
    core: { models: { materials: { list: createDataMap() } } },
  };
  const fakeConfigManager = { list: new Map() };
  const components: any = {
    list: instances,
    add(uuid: string, instance: any) {
      instances.set(uuid, instance);
    },
    get(Component: any) {
      const uuid = Component.uuid;
      if (uuid === (OBC.FragmentsManager as any).uuid) return fakeFragments;
      if (uuid === (OBC.ConfigManager as any).uuid) return fakeConfigManager;
      if (instances.has(uuid)) return instances.get(uuid);
      return new Component(components);
    },
    dispose() {
      for (const instance of instances.values()) instance?.dispose?.();
      instances.clear();
    },
  };
  return components as OBC.Components;
}

function createDataMap() {
  const map = new Map();
  return Object.assign(map, {
    onItemSet: createEvent(),
    onBeforeDelete: createEvent(),
    onItemDeleted: createEvent(),
  });
}

function createClipperWorld(
  components: OBC.Components,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  gl: THREE.WebGLRenderer,
) {
  const renderer: any = {
    three: gl,
    clippingPlanes: [] as THREE.Plane[],
    worlds: new Map(),
    currentWorld: null,
    onWorldChanged: createEvent(),
    onClippingPlanesUpdated: createEvent(),
    setPlane(active: boolean, plane: THREE.Plane & { isLocal?: boolean }, isLocal?: boolean) {
      plane.isLocal = isLocal;
      const index = this.clippingPlanes.indexOf(plane);
      if (active && index === -1) this.clippingPlanes.push(plane);
      if (!active && index !== -1) this.clippingPlanes.splice(index, 1);
      this.three.clippingPlanes = this.clippingPlanes.filter((p: THREE.Plane & { isLocal?: boolean }) => !p.isLocal);
    },
    updateClippingPlanes() {
      this.onClippingPlanesUpdated.trigger();
    },
  };

  const world: any = {
    uuid: THREE.MathUtils.generateUUID(),
    scene: { three: scene },
    camera: {
      three: camera,
      enabled: true,
      controls: {
        addEventListener: () => {},
        removeEventListener: () => {},
      },
    },
    renderer,
    meshes: new Set<THREE.Mesh>(),
    isDisposing: false,
    onDisposed: createEvent(),
    dispose() {
      this.isDisposing = true;
      this.onDisposed.trigger();
    },
  };
  renderer.currentWorld = world;
  renderer.worlds.set(world.uuid, world);
  components.get(OBC.Worlds).list.set(world.uuid, world);
  return world;
}

function createEvent() {
  const listeners = new Set<(...args: any[]) => void>();
  return {
    add: (fn: (...args: any[]) => void) => listeners.add(fn),
    remove: (fn: (...args: any[]) => void) => listeners.delete(fn),
    trigger: (...args: any[]) => listeners.forEach((fn) => fn(...args)),
    reset: () => listeners.clear(),
  };
}

async function pickSurface(
  e: MouseEvent,
  dom: HTMLCanvasElement,
  camera: THREE.PerspectiveCamera,
  scene: THREE.Scene,
  raycaster: THREE.Raycaster,
) {
  const fragHits = await Promise.all(
    [...fragModelRegistry.values()].map(async (fmodel) => {
      if (!fmodel?.object?.visible) return null;
      try {
        const hit = await fmodel.raycast({ camera, mouse: new THREE.Vector2(e.clientX, e.clientY), dom });
        const normal = hit?.normal ?? hit?.faceNormal;
        if (!hit?.point || !normal) return null;
        return {
          point: hit.point.clone ? hit.point.clone() : new THREE.Vector3(hit.point.x, hit.point.y, hit.point.z),
          normal: normal.clone ? normal.clone() : new THREE.Vector3(normal.x, normal.y, normal.z),
          distance: hit.distance ?? camera.position.distanceTo(hit.point),
        };
      } catch {
        return null;
      }
    }),
  );

  const rect = dom.getBoundingClientRect();
  const mouse = new THREE.Vector2(
    ((e.clientX - rect.left) / rect.width) * 2 - 1,
    -((e.clientY - rect.top) / rect.height) * 2 + 1,
  );
  raycaster.setFromCamera(mouse, camera);
  const targets = collectPickableMeshes(scene);
  const meshHit = raycaster.intersectObjects(targets, false).find((hit) => hit.face);
  const meshResult = meshHit?.face
    ? {
        point: meshHit.point.clone(),
        normal: meshHit.face.normal
          .clone()
          .applyMatrix3(new THREE.Matrix3().getNormalMatrix(meshHit.object.matrixWorld))
          .normalize(),
        distance: meshHit.distance,
      }
    : null;

  return [...fragHits.filter(Boolean), meshResult].filter(Boolean).sort((a, b) => a!.distance - b!.distance)[0] ?? null;
}

function collectPickableMeshes(scene: THREE.Scene) {
  const fragmentRoots = new Set([...fragModelRegistry.values()].map((fmodel) => fmodel.object).filter(Boolean));
  const targets: THREE.Mesh[] = [];
  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.visible || !mesh.isMesh) return;
    if (!isClipperPickable(mesh, fragmentRoots)) return;
    if (!hasValidGeometry(mesh)) return;
    targets.push(mesh);
  });
  return targets;
}

function hasValidGeometry(mesh: THREE.Mesh) {
  const geom = mesh.geometry as THREE.BufferGeometry | undefined;
  if (!geom) return false;
  const pos = geom.attributes?.position as THREE.BufferAttribute | undefined;
  if (!pos) return false;
  const arr = (pos as any).array;
  if (!arr || arr.length === 0) return false;
  if (geom.index) {
    const idxArr = (geom.index as any).array;
    if (!idxArr) return false;
  }
  return true;
}

function isClipperPickable(obj: THREE.Object3D, fragmentRoots: Set<THREE.Object3D>) {
  let current: THREE.Object3D | null = obj;
  while (current) {
    if (current.userData.bimClipperHelper || current.userData.bimMeasure) return false;
    if (current.type === "GridHelper" || current.name.toLowerCase().includes("grid")) return false;
    if (fragmentRoots.has(current)) return false;
    current = current.parent;
  }
  return true;
}


function markClipperHelpers(clipper: OBC.Clipper) {
  for (const plane of clipper.list.values()) {
    plane.helper.userData.bimClipperHelper = true;
    plane.helper.traverse((obj) => {
      obj.userData.bimClipperHelper = true;
    });
    const controlHelper = plane.controls?.getHelper?.();
    if (controlHelper) {
      controlHelper.userData.bimClipperHelper = true;
      controlHelper.traverse((obj) => {
        obj.userData.bimClipperHelper = true;
      });
    }
  }
}
