import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import { appIcons } from "../../globals";
import { selectedFilters, applyActiveFilters } from "../tables/classifier-hider";

export interface TandemPanelState {
  components: OBC.Components;
}

/*
export const tandemPanelTemplate: BUI.StatefullComponent<TandemPanelState> = (
  state,
) => {
  const { components } = state;
  const fragments = components.get(OBC.FragmentsManager);
  const classifier = components.get(OBC.Classifier);

  // Trigger classification grouping if not already run
  if (!classifier.list.has("Categories")) {
    classifier.byCategory();
  }

  // local caches for counts to resolve them asynchronously
  const modelCounts = new Map<string, number>();
  const categoryCounts = new Map<string, number>();

  // Define component mount ref to subscribe to lifecycle updates
  let isMounted = true;
  const [container, update] = BUI.Component.create<HTMLDivElement, TandemPanelState>((_) => {
    // ─── 1. Models Data ───
    const models = Array.from(fragments.list.entries());
    const visibleModels = models.filter(([_, m]) => {
      // Find out if at least one element is visible or mesh is visible
      if (typeof m.getVisible === "function") {
        return m.getVisible();
      }
      return m.object.visible;
    });

    const allModelsChecked = models.length > 0 && visibleModels.length === models.length;
    const modelsCountLabel = `(${visibleModels.length} of ${models.length})`;

    // ─── 2. Categories Data ───
    const categoriesGroup = classifier.list.get("Categories");
    const categoriesList = categoriesGroup ? Array.from(categoriesGroup.entries()) : [];
    
    const activeCategories = selectedFilters.get("Categories") || new Set<string>();
    const allCategoriesChecked = categoriesList.length > 0 && activeCategories.size === categoriesList.length;
    const categoriesCountLabel = `(${activeCategories.size} of ${categoriesList.length})`;

    // ─── Async Count Resolvers ───
    const getModelCount = (model: any, modelId: string): number => {
      if (modelCounts.has(modelId)) {
        return modelCounts.get(modelId)!;
      }
      
      // Resolve asynchronously
      if (typeof model.getLocalIds === "function") {
        try {
          const idsPromise = model.getLocalIds();
          Promise.resolve(idsPromise).then((ids: any) => {
            let count = 0;
            if (ids instanceof Set || ids instanceof Map) {
              count = ids.size;
            } else if (Array.isArray(ids)) {
              count = ids.length;
            } else if (ids && typeof ids.size === "number") {
              count = ids.size;
            } else if (ids && typeof ids.length === "number") {
              count = ids.length;
            }
            modelCounts.set(modelId, count);
            if (isMounted) update();
          }).catch((err) => {
            console.error(`Error resolving element count for model ${modelId}:`, err);
            modelCounts.set(modelId, 0);
          });
        } catch (err) {
          console.error(`Synchronous error resolving element count for model ${modelId}:`, err);
          modelCounts.set(modelId, 0);
        }
      } else {
        modelCounts.set(modelId, 0);
      }
      
      return 0;
    };

    const getCategoryCount = (categoryName: string, groupData: any): number => {
      if (categoryCounts.has(categoryName)) {
        return categoryCounts.get(categoryName)!;
      }

      // Resolve asynchronously
      if (groupData && typeof groupData.get === "function") {
        try {
          const mapPromise = groupData.get();
          Promise.resolve(mapPromise).then((modelIdMap: any) => {
            let count = 0;
            if (modelIdMap) {
              for (const mId in modelIdMap) {
                const expressIds = modelIdMap[mId];
                if (expressIds instanceof Set || expressIds instanceof Map) {
                  count += expressIds.size;
                } else if (Array.isArray(expressIds)) {
                  count += expressIds.length;
                }
              }
            }
            categoryCounts.set(categoryName, count);
            if (isMounted) update();
          }).catch((err) => {
            console.error(`Error resolving element count for category ${categoryName}:`, err);
            categoryCounts.set(categoryName, 0);
          });
        } catch (err) {
          console.error(`Synchronous error resolving element count for category ${categoryName}:`, err);
          categoryCounts.set(categoryName, 0);
        }
      } else {
        categoryCounts.set(categoryName, 0);
      }

      return 0;
    };

    // ─── Event Handlers ───
    const onToggleAllModels = async (e: Event) => {
      const checkbox = e.target as HTMLInputElement;
      const checked = checkbox.checked;
      for (const [, model] of models) {
        model.setVisible(checked);
      }
      await fragments.core.update(true);
      update();
    };

    const onToggleModel = async (e: Event, model: any) => {
      const checkbox = e.target as HTMLInputElement;
      model.setVisible(checkbox.checked);
      await fragments.core.update(true);
      update();
    };

    const onToggleAllCategories = async (e: Event) => {
      const checkbox = e.target as HTMLInputElement;
      const checked = checkbox.checked;

      let classificationSet = selectedFilters.get("Categories");
      if (!classificationSet) {
        classificationSet = new Set();
        selectedFilters.set("Categories", classificationSet);
      }

      for (const [name] of categoriesList) {
        if (checked) {
          classificationSet.add(name);
        } else {
          classificationSet.delete(name);
        }
      }

      if (!checked) {
        selectedFilters.delete("Categories");
      }

      await applyActiveFilters(components);
      update();
    };

    const onToggleCategory = async (e: Event, name: string) => {
      const checkbox = e.target as HTMLInputElement;
      let classificationSet = selectedFilters.get("Categories");
      if (!classificationSet) {
        classificationSet = new Set();
        selectedFilters.set("Categories", classificationSet);
      }

      if (checkbox.checked) {
        classificationSet.add(name);
      } else {
        classificationSet.delete(name);
        if (classificationSet.size === 0) {
          selectedFilters.delete("Categories");
        }
      }

      await applyActiveFilters(components);
      update();
    };

    // Interactive Checkbox Hover Micro-Animations
    const onCheckboxMouseEnter = (e: MouseEvent) => {
      const checkbox = e.currentTarget as HTMLInputElement;
      checkbox.style.transform = "scale(1.15)";
    };

    const onCheckboxMouseLeave = (e: MouseEvent) => {
      const checkbox = e.currentTarget as HTMLInputElement;
      checkbox.style.transform = "scale(1.0)";
    };

    const checkboxStyle = "accent-color: var(--accent); cursor: pointer; width: 14px; height: 14px; transition: transform 0.15s ease; flex-shrink: 0;";

    return BUI.html`
      <div style="display: flex; flex-direction: column; gap: 1rem; height: 100%; overflow: auto; padding: 0.75rem;">
        
        <!-- SOURCE FILES Section -->
        <div style="display: flex; flex-direction: column; gap: 0.5rem; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 0.75rem;">
          <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; margin-bottom: 0.25rem;">
            <span style="font-size: 0.85rem; font-weight: 700; color: var(--fg); text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 6px;">
              <bim-icon name=${appIcons.SOURCE} style="--bim-icon--c: var(--accent);"></bim-icon>
              Source Files
            </span>
          </div>

          <!-- All Files Header Checkbox -->
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 4px 0;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <input 
                type="checkbox" 
                style=${checkboxStyle}
                ?checked=${allModelsChecked} 
                @change=${onToggleAllModels}
                @mouseenter=${onCheckboxMouseEnter}
                @mouseleave=${onCheckboxMouseLeave}
              />
              <span style="font-weight: 600; font-size: 0.85rem; color: var(--fg);">ALL</span>
            </div>
            <span style="font-size: 0.75rem; color: var(--muted);">${modelsCountLabel}</span>
          </div>

          <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 0.25rem;">
            ${models.length === 0 ? BUI.html`
              <span style="font-size: 0.8rem; color: var(--muted-2); font-style: italic; text-align: center; padding: 8px; display: block;">No models loaded</span>
            ` : models.map(([modelId, model]) => {
              const name = model.name || modelId || "Unknown Model";
              const isChecked = visibleModels.some(([_, m]) => m === model);
              const count = getModelCount(model, modelId);
              return BUI.html`
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 4px 0; border-top: 1px solid rgba(255,255,255,0.02);">
                  <div style="display: flex; align-items: center; gap: 8px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; flex: 1; padding-right: 8px;">
                    <input 
                      type="checkbox" 
                      style=${checkboxStyle}
                      ?checked=${isChecked} 
                      @change=${(e: Event) => onToggleModel(e, model)}
                      @mouseenter=${onCheckboxMouseEnter}
                      @mouseleave=${onCheckboxMouseLeave}
                    />
                    <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.8rem; color: var(--fg);">${name}</span>
                  </div>
                  <span style="font-size: 0.75rem; color: var(--muted-2); font-family: var(--font-mono); flex-shrink: 0;">${count}</span>
                </div>
              `;
            })}
          </div>
        </div>

        <!-- CATEGORIES Section -->
        <div style="display: flex; flex-direction: column; gap: 0.5rem; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 0.75rem;">
          <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; margin-bottom: 0.25rem;">
            <span style="font-size: 0.85rem; font-weight: 700; color: var(--fg); text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 6px;">
              <bim-icon name=${appIcons.FILTER} style="--bim-icon--c: var(--accent);"></bim-icon>
              Categories
            </span>
          </div>

          <!-- All Categories Header Checkbox -->
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 4px 0;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <input 
                type="checkbox" 
                style=${checkboxStyle}
                ?checked=${allCategoriesChecked} 
                @change=${onToggleAllCategories}
                @mouseenter=${onCheckboxMouseEnter}
                @mouseleave=${onCheckboxMouseLeave}
              />
              <span style="font-weight: 600; font-size: 0.85rem; color: var(--fg);">ALL</span>
            </div>
            <span style="font-size: 0.75rem; color: var(--muted);">${categoriesCountLabel}</span>
          </div>

          <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 0.25rem; max-height: 400px; overflow-y: auto; padding-right: 2px;">
            ${categoriesList.length === 0 ? BUI.html`
              <span style="font-size: 0.8rem; color: var(--muted-2); font-style: italic; text-align: center; padding: 8px; display: block;">No categories available</span>
            ` : categoriesList.map(([name, groupData]) => {
              const isChecked = activeCategories.has(name);
              const count = getCategoryCount(name, groupData);
              return BUI.html`
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 4px 0; border-top: 1px solid rgba(255,255,255,0.02);">
                  <div style="display: flex; align-items: center; gap: 8px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; flex: 1; padding-right: 8px;">
                    <input 
                      type="checkbox" 
                      style=${checkboxStyle}
                      ?checked=${isChecked} 
                      @change=${(e: Event) => onToggleCategory(e, name)}
                      @mouseenter=${onCheckboxMouseEnter}
                      @mouseleave=${onCheckboxMouseLeave}
                    />
                    <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.8rem; color: var(--fg);">${name}</span>
                  </div>
                  <span style="font-size: 0.75rem; color: var(--muted-2); font-family: var(--font-mono); flex-shrink: 0;">${count}</span>
                </div>
              `;
            })}
          </div>
        </div>

      </div>
    `;
  }, state);

  const onCreated = (el?: Element) => {
    if (!el) return;
    const updatePanel = () => {
      modelCounts.clear();
      categoryCounts.clear();
      if (isMounted) update();
    };

    fragments.list.onItemSet.add(updatePanel);
    fragments.list.onItemDeleted.add(updatePanel);
    classifier.list.onItemSet.add(updatePanel);

    // Clean up listeners when component is disconnected
    const panel = el as any;
    const originalDisconnect = panel.disconnectedCallback;
    panel.disconnectedCallback = function (this: any) {
      isMounted = false;
      fragments.list.onItemSet.delete(updatePanel);
      fragments.list.onItemDeleted.delete(updatePanel);
      classifier.list.onItemSet.delete(updatePanel);
      if (originalDisconnect) {
        originalDisconnect.call(this);
      }
    };
  };

  return BUI.html`
    <bim-panel ${BUI.ref(onCreated)} style="height: 100%; display: flex; flex-direction: column; background: transparent; border: none;">
      ${container}
    </bim-panel>
  `;
};
*/

export const tandemPanelTemplate: BUI.StatefullComponent<TandemPanelState> = () => {
  return BUI.html`
    <div style="padding: 1rem; color: var(--muted);">
      Tandem View Development Paused.
    </div>
  `;
};

