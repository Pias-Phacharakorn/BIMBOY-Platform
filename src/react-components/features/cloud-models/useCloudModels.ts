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
}

/**
 * Mutation to download a single cloud model and load it into the viewer.
 * Shared by CloudModelModal (manual load) and useAutoLoadCloudModels (auto load).
 */
export function useLoadCloudModel() {
  return useMutation({
    mutationFn: async ({ prefix, file, components }: LoadCloudModelVariables) => {
      const bytes = await cloudModelsService.downloadFragFile(prefix, file.name);
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

    const { setModelLoading, setLoadingFiles, updateLoadingFileStatus } = useBimStore.getState();
    setLoadingFiles(files.map((f) => ({ name: f.name, status: "pending" as const })));
    setModelLoading(true);

    let hasError = false;

    for (let i = 0; i < files.length; i += MAX_PARALLEL) {
      const batch = files.slice(i, i + MAX_PARALLEL);
      await Promise.all(
        batch.map(async (file) => {
          updateLoadingFileStatus(file.name, "loading");
          try {
            await loadCloudModel.mutateAsync({ prefix, file, components });
            updateLoadingFileStatus(file.name, "done");
          } catch (err) {
            console.warn(`Failed to load cloud model "${file.name}"`, err);
            updateLoadingFileStatus(file.name, "error");
            hasError = true;
          }
        })
      );
    }

    if (!hasError) {
      setTimeout(() => useBimStore.getState().setModelLoading(false), 1000);
    }

    return hasError;
  };
}
