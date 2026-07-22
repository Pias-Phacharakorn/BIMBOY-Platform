import { useQuery, useMutation } from "@tanstack/react-query";
import * as OBC from "@thatopen/components";
import { cloudModelsService } from "./cloudModelsService";
import type { CloudFragFile } from "./cloudModelsService";
import { useBimStore } from "@/react-components/store/bimStore";

export const cloudModelsKeys = {
  all: ["cloud-models"] as const,
  list: (prefix: string) => [...cloudModelsKeys.all, "list", prefix] as const,
};

/**
 * Hook to query the list of .frag files available for a project's storage prefix.
 */
export function useCloudModelFiles(prefix: string, enabled: boolean) {
  return useQuery<CloudFragFile[]>({
    queryKey: cloudModelsKeys.list(prefix),
    queryFn: () => cloudModelsService.listFragFiles(prefix),
    enabled: enabled && !!prefix,
  });
}

interface LoadCloudModelVariables {
  prefix: string;
  file: CloudFragFile;
  components: OBC.Components;
  signal?: AbortSignal;
}

/**
 * Mutation to download a single cloud model and load it into the viewer.
 * Shared by CloudModelModal (manual load) and useAutoLoadCloudModels (auto load).
 * Pass a signal to abort the download and skip loading a cancelled file.
 */
export function useLoadCloudModel() {
  return useMutation({
    mutationFn: async ({ prefix, file, components, signal }: LoadCloudModelVariables) => {
      const bytes = await cloudModelsService.downloadFragFile(prefix, file.name, signal);
      // Download resolved just before a cancel — don't load an aborted file.
      if (signal?.aborted) return;
      const fragments = components.get(OBC.FragmentsManager);
      const model = await fragments.core.load(bytes, { modelId: file.modelId });

      if (model) {
        (model as any).name = file.name;
      }

      useBimStore.getState().addLoadedModel(file.modelId);
    },
  });
}

const MAX_PARALLEL = 10;

/**
 * Returns a function that loads a batch of cloud models while driving the
 * shared `isModelLoading`/`loadingFiles` progress state in bimStore — the
 * single loading-feedback path used by both CloudModelModal's manual "Load
 * Models" button and useAutoLoadCloudModels. Resolves to `true` if any file
 * failed to load.
 */
export function useLoadCloudModelBatch() {
  const loadCloudModel = useLoadCloudModel();

  return async function loadFiles(
    files: CloudFragFile[],
    prefix: string,
    components: OBC.Components
  ): Promise<boolean> {
    if (files.length === 0) return false;

    const {
      setModelLoading,
      setLoadingFiles,
      updateLoadingFileStatus,
      setLoadingAbortController,
    } = useBimStore.getState();
    setLoadingFiles(files.map((f) => ({ name: f.name, status: "pending" as const })));

    // Controller for the "Stop" button — cancelModelLoading() aborts this.
    const controller = new AbortController();
    setLoadingAbortController(controller);
    setModelLoading(true);

    let hasError = false;

    for (let i = 0; i < files.length; i += MAX_PARALLEL) {
      // Cancelled between waves — stop launching new downloads.
      if (controller.signal.aborted) break;
      const batch = files.slice(i, i + MAX_PARALLEL);
      await Promise.all(
        batch.map(async (file) => {
          updateLoadingFileStatus(file.name, "loading");
          try {
            await loadCloudModel.mutateAsync({
              prefix,
              file,
              components,
              signal: controller.signal,
            });
            // A cancel may have flipped this file to 'cancelled' already.
            if (!controller.signal.aborted) updateLoadingFileStatus(file.name, "done");
          } catch (err) {
            // An aborted download is a cancel, not a failure — cancelModelLoading
            // owns the 'cancelled' status, so leave it be.
            if (controller.signal.aborted) return;
            console.warn(`Failed to load cloud model "${file.name}"`, err);
            updateLoadingFileStatus(file.name, "error");
            hasError = true;
          }
        })
      );
    }

    // This run's controller is spent — don't let it abort a later batch.
    if (useBimStore.getState().loadingAbortController === controller) {
      setLoadingAbortController(null);
    }

    // Keep the modal open on error (Close button) or cancel (Stop → Close);
    // only auto-dismiss on a fully clean run.
    if (!hasError && !controller.signal.aborted) {
      setTimeout(() => useBimStore.getState().setModelLoading(false), 1000);
    }

    return hasError;
  };
}
