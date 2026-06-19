import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

type FragmentsInstance = {
  load: (buffer: ArrayBuffer, opts: { modelId: string; camera?: THREE.Camera }) => Promise<any>;
  disposeModel: (id: string) => Promise<void>;
  update: (force?: boolean) => Promise<void>;
  dispose: () => Promise<void>;
  models: any;
};

const Ctx = createContext<{ fragments: FragmentsInstance | null }>({ fragments: null });

export function useSharedFragments() {
  return useContext(Ctx).fragments;
}

/**
 * Single shared FragmentsModels instance for the whole scene.
 * The tutorial pattern (docs.thatopen.com) requires this so `autoCoordinate`
 * can align federated models against the first loaded model's base coords.
 */
export function FragmentsProvider({ children }: { children: ReactNode }) {
  const { scene, camera } = useThree();
  const [fragments, setFragments] = useState<FragmentsInstance | null>(null);
  const fragRef = useRef<FragmentsInstance | null>(null);
  const lastCam = useRef(new THREE.Matrix4());
  const idle = useRef(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { FragmentsModels } = await import("@thatopen/fragments");
      const workerUrl = await FragmentsModels.getWorker();
      if (cancelled) return;
      const f = new FragmentsModels(workerUrl) as unknown as FragmentsInstance;
      // Mirror the tutorial: when a model is added, bind it to the camera
      // and add to the scene. This is what triggers autoCoordinate to apply
      // base coordinates from the first model to subsequent ones.
      f.models.list.onItemSet.add(({ value: model }: any) => {
        try {
          model.useCamera?.(camera);
        } catch {/* ignore */}
        scene.add(model.object);
        f.update(true).catch(() => {});
      });
      f.models.list.onItemDeleted.add(({ value: model }: any) => {
        if (model?.object) scene.remove(model.object);
      });
      fragRef.current = f;
      setFragments(f);
    })();
    return () => {
      cancelled = true;
      const f = fragRef.current;
      fragRef.current = null;
      setFragments(null);
      if (f) f.dispose().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame(({ camera: cam }) => {
    const f = fragRef.current;
    if (!f) return;
    if (!cam.matrixWorld.equals(lastCam.current)) {
      lastCam.current.copy(cam.matrixWorld);
      idle.current = 0;
      f.update().catch(() => {});
      return;
    }
    idle.current += 1;
    if (idle.current % 30 === 0) f.update().catch(() => {});
  });

  return <Ctx.Provider value={{ fragments }}>{children}</Ctx.Provider>;
}
