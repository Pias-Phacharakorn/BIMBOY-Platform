import { useEffect, useRef } from "react";
import * as OBC from "@thatopen/components";
import { useProject } from "@/react-components/features/projects/useProjects";
import { useAuth } from "@/react-components/features/auth/useAuth";
import { useBimStore } from "@/react-components/store/bimStore";
import { cloudModelsService } from "./cloudModelsService";
import { useLoadCloudModelBatch } from "./useCloudModels";

/**
 * Automatically loads all .frag files from a project's cloud storage folder
 * into the viewer as soon as the project opens. On project switch (while the
 * OBC engine stays alive), disposes the previous project's models first.
 */
export function useAutoLoadCloudModels(projectId: string | null | undefined) {
  const { data: project } = useProject(projectId);
  // Guests load from public/resources/demo via useGuestDemoModels instead — this
  // path would be an unauthenticated Supabase storage list.
  const { isGuest } = useAuth();
  const components = useBimStore((s) => s.components);
  const engineReady = useBimStore((s) => s.engineReady);
  const resetLoadedModels = useBimStore((s) => s.resetLoadedModels);
  const loadFiles = useLoadCloudModelBatch();
  const prevProjectIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (isGuest) return;
    if (!engineReady || !components || !project) return;

    const prefix = `${project.projectnumber}_${project.projectName}/02_frag`;
    const isProjectSwitch =
      prevProjectIdRef.current !== undefined &&
      prevProjectIdRef.current !== projectId;
    prevProjectIdRef.current = projectId;

    let cancelled = false;

    (async () => {
      if (isProjectSwitch) {
        const fragments = components.get(OBC.FragmentsManager);
        const idsToDispose = useBimStore.getState().loadedModelIds;
        for (const modelId of idsToDispose) {
          try {
            await fragments.core.disposeModel(modelId);
          } catch (err) {
            console.warn(`Failed to dispose model "${modelId}" on project switch`, err);
          }
        }
        resetLoadedModels();
      }

      // Per-project opt-out: bail AFTER the switch-dispose above (so leaving a
      // project still cleans up its models) but BEFORE listing/loading, so the
      // new project's auto-load is suppressed when the toggle is off.
      if (!project.autoLoadCloudModels) return;

      let files;
      try {
        files = await cloudModelsService.listFragFiles(prefix);
      } catch (err) {
        console.warn("Auto-load: failed to list cloud models", err);
        return;
      }
      if (cancelled) return;

      const currentlyLoaded = useBimStore.getState().loadedModelIds;
      const toLoad = files.filter((f) => !currentlyLoaded.includes(f.modelId));
      if (cancelled || toLoad.length === 0) return;

      await loadFiles(toLoad, prefix, components);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineReady, components, project, projectId, isGuest]);
}
