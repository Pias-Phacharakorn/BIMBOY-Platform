import { useEffect } from "react";
import { useBimStore } from "@/react-components/store/bimStore";
import { useLoadCloudModelBatch } from "@/react-components/features/cloud-models/useCloudModels";
import { demoModelsService } from "./demoModelsService";
import { DEMO_ASSET_PREFIX } from "./demoProject";

/**
 * Guest counterpart to `useAutoLoadCloudModels`: loads the demo .frag files from
 * `public/resources/demo` once the engine is ready.
 *
 * Deliberately thin — the actual loading goes through `useLoadCloudModelBatch`
 * with a static downloader injected, so the demo inherits the first-load
 * serialisation ADR-0015 requires, the shared progress modal and the Stop button.
 *
 * No project-switch disposal branch here: a guest only ever opens one project.
 */
export function useGuestDemoModels(enabled: boolean) {
  const components = useBimStore((s) => s.components);
  const engineReady = useBimStore((s) => s.engineReady);
  const loadFiles = useLoadCloudModelBatch();

  useEffect(() => {
    if (!enabled || !engineReady || !components) return;

    let cancelled = false;

    (async () => {
      let files;
      try {
        files = await demoModelsService.listDemoFrags();
      } catch (err) {
        console.warn(
          "Guest demo: no models loaded. Add .frag files to public/resources/demo and list them in manifest.json.",
          err
        );
        return;
      }
      if (cancelled || files.length === 0) return;

      const alreadyLoaded = useBimStore.getState().loadedModelIds;
      const toLoad = files.filter((f) => !alreadyLoaded.includes(f.modelId));
      if (cancelled || toLoad.length === 0) return;

      await loadFiles(toLoad, DEMO_ASSET_PREFIX, components, demoModelsService.downloadDemoFrag);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, engineReady, components]);
}
