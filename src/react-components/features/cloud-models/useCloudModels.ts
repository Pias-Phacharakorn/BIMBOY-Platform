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

/**
 * How a model's bytes are obtained. Defaults to Supabase storage; the guest demo
 * injects a static `fetch` from public/resources/demo instead, so it reuses this
 * loader's first-load serialisation (ADR-0015), progress modal and Stop button
 * rather than duplicating them.
 */
export type FragDownloader = (
  prefix: string,
  fileName: string,
  signal?: AbortSignal
) => Promise<Uint8Array>;

interface LoadCloudModelVariables {
  prefix: string;
  file: CloudFragFile;
  components: OBC.Components;
  signal?: AbortSignal;
  download?: FragDownloader;
}

/**
 * Mutation to download a single cloud model and load it into the viewer.
 * Shared by CloudModelModal (manual load) and useAutoLoadCloudModels (auto load).
 * Pass a signal to abort the download and skip loading a cancelled file.
 */
export function useLoadCloudModel() {
  return useMutation({
    mutationFn: async ({ prefix, file, components, signal, download }: LoadCloudModelVariables) => {
      const fetchBytes = download ?? cloudModelsService.downloadFragFile;
      const bytes = await fetchBytes(prefix, file.name, signal);
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
    components: OBC.Components,
    download?: FragDownloader
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

    /**
     * ⚠️ **The very first model into an empty scene loads alone, and that is a correctness fix,
     * not a throttle.** FRAGS and OBC each pick a "first model" to coordinate everything else
     * against, by two different rules that only agree when one load is in flight:
     *
     * - `FragmentsModels.load` sets `baseCoordinates` from the first model to **finish**
     *   (`await model._setup(...)`, then the `baseCoordinates === null` check), and positions
     *   every later model at `baseCoordinates − ownCoordinates`.
     * - `FragmentsManager`'s `onModelLoaded` handler sets `baseCoordinationMatrix` from
     *   `[...this.list.values()][0]` — and `list` **is** `core.models.list`, which `load()` writes
     *   *before* awaiting `_setup`, so it is the first model to **start**.
     *
     * Load ten at once and the first to start is usually not the first to finish, so the two
     * bases name different models. Nothing warns: models are placed off one base and
     * `OBF.ClipStyler`'s section fills off the other, leaving every fill displaced from its own
     * geometry by the constant difference between them (measured at 23.5 units on this project).
     * With one load in flight the two rules cannot disagree, and both bases stay latched for the
     * rest of the session.
     *
     * Only the *first* wave is serialised, and only into an empty scene — once
     * `fragments.list` is non-empty the bases are already set, so later loads run full width.
     */
    const fragments = components.get(OBC.FragmentsManager);
    const serialiseFirstLoad = fragments.list.size === 0;

    for (let i = 0; i < files.length; ) {
      // Cancelled between waves — stop launching new downloads.
      if (controller.signal.aborted) break;
      const waveSize = i === 0 && serialiseFirstLoad ? 1 : MAX_PARALLEL;
      const batch = files.slice(i, i + waveSize);
      i += waveSize;
      await Promise.all(
        batch.map(async (file) => {
          updateLoadingFileStatus(file.name, "loading");
          try {
            await loadCloudModel.mutateAsync({
              prefix,
              file,
              components,
              signal: controller.signal,
              download,
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
