// @ts-nocheck
// Isolated .frag loader for the AR page. Spins up a bare OBC.Components +
// FragmentsManager used ONLY to download and decode fragment models — it is
// deliberately NOT wired to any world/renderer. The decoded model.object
// (a THREE.Object3D) is handed back to ArModelViewer, which adds it to the
// single XR WebGLRenderer's scene. This keeps the proven "one WebGL context"
// property of the /ar page intact.
import { useCallback, useEffect, useRef } from "react";
import * as OBC from "@thatopen/components";
import fragmentsWorkerUrl from "@thatopen/fragments/worker?url";
import { cloudModelsService } from "@/react-components/features/cloud-models/cloudModelsService";

export function useArModelLoader() {
  const componentsRef = useRef<OBC.Components | null>(null);

  const getComponents = useCallback(() => {
    if (!componentsRef.current) {
      const components = new OBC.Components();
      const fragments = components.get(OBC.FragmentsManager);
      // Same worker the main viewer uses — resolved from node_modules so it cannot drift from the
      // installed @thatopen/fragments. See setupFragmentsManager for why the /public copy went.
      fragments.init(fragmentsWorkerUrl);
      components.init();
      componentsRef.current = components;
    }
    return componentsRef.current;
  }, []);

  /**
   * Downloads + decodes a single .frag and returns its THREE.Object3D.
   * `cullingCamera` (the AR scene's base camera) is registered so Fragments
   * generates visible geometry; we force an update to push it immediately.
   */
  const loadFrag = useCallback(
    async (prefix: string, fileName: string, modelId: string, cullingCamera: any) => {
      const components = getComponents();
      const fragments = components.get(OBC.FragmentsManager);

      const bytes = await cloudModelsService.downloadFragFile(prefix, fileName);
      const model = await fragments.core.load(bytes, { modelId });

      if (model) {
        try {
          model.useCamera(cullingCamera);
        } catch {
          // culling camera optional — model still renders without it
        }
      }
      await fragments.core.update(true);

      return model?.object ?? null;
    },
    [getComponents]
  );

  useEffect(() => {
    return () => {
      if (componentsRef.current) {
        try {
          componentsRef.current.dispose();
        } catch {
          // ignore disposal errors on unmount
        }
        componentsRef.current = null;
      }
    };
  }, []);

  return { loadFrag };
}
