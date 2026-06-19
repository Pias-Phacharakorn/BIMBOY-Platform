import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import { ClashImport } from "../../bim-components";
import { clashTable as createClashTable } from "../tables/clash-table";

export interface ClashTableSectionState {
  components: OBC.Components;
  clashTable?: HTMLElement;
}

export const clashTableSectionTemplate: BUI.StatefullComponent<ClashTableSectionState> = (state) => {
  const { components } = state;
  const clashImport = components.get(ClashImport);
  const [clashTable] = state.clashTable ? [state.clashTable] : createClashTable({ components });

  // ─── Progress bar sub-component ───────────────────────────────────────────

  interface ProgressState { value: number; message: string; visible: boolean; }

  const [progressBar, updateProgressBar] = BUI.Component.create<HTMLDivElement, ProgressState>(
    (progress) => BUI.html`
      <div style="display: ${progress.visible ? "flex" : "none"}; flex-direction: column; gap: 0.25rem; padding: 0.5rem; background: rgba(255,255,255,0.05); border-radius: 4px;">
        <div style="display: flex; justify-content: space-between; font-size: 0.75rem; opacity: 0.8;">
          <span>${progress.message}</span>
          <span>${progress.value}%</span>
        </div>
        <div style="height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden;">
          <div style="width: ${progress.value}%; height: 100%; background: var(--bim-ui_accent-base, #ca8134); transition: width 0.3s ease;"></div>
        </div>
      </div>
    `,
    { value: 0, message: "", visible: false }
  );

  // Ensure old progress listener is removed to prevent duplicates
  if ((clashImport as any)._uiProgressListener) {
    clashImport.onProgress.remove((clashImport as any)._uiProgressListener);
  }
  const onProgress = ({ progress: val, message: msg }: any) => {
    updateProgressBar({
      value: val,
      message: msg,
      visible: (val > 0 && val < 100) || msg === "Done!",
    });
  };
  (clashImport as any)._uiProgressListener = onProgress;
  clashImport.onProgress.add(onProgress);

  // ─── Template ─────────────────────────────────────────────────────────────

  return BUI.html`
    <bim-panel-section fixed icon="material-symbols:table" label="Clash Table">
      <div style="display: flex; flex-direction: column; gap: 0.5rem;">
        ${progressBar}
        ${clashTable}
      </div>
    </bim-panel-section>
  `;
};
