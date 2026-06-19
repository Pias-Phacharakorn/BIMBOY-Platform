import * as OBC from "@thatopen/components";
import * as BUI from "@thatopen/ui";
import { ClassifierListState, ClassifierListTableData } from "./src/types";
import { classifierListTemplate } from "./src/template";
import { setDefaults } from "./src/set-defaults";

export const selectedFilters = new Map<string, Set<string>>();
export const activeUpdateFunctions = new Set<() => void>();

export const classifierList = (state: ClassifierListState) => {
  const component = BUI.Component.create<BUI.Table<ClassifierListTableData>, ClassifierListState>(
    classifierListTemplate,
    state
  );

  const [table, updateTable] = component;

  setDefaults(state, table, updateTable);

  const { components } = state;
  const classifier = components.get(OBC.Classifier);
  
  const updateFunction = () => {
    setTimeout(() => {
      table.loadData(true);
      updateTable();
    });
  };
  
  classifier.list.onItemSet.add(updateFunction);
  activeUpdateFunctions.add(updateFunction);

  const originalDisconnect = (table as any).disconnectedCallback;
  (table as any).disconnectedCallback = function (this: any) {
    classifier.list.onItemSet.delete(updateFunction);
    activeUpdateFunctions.delete(updateFunction);
    if (activeUpdateFunctions.size === 0) {
      selectedFilters.clear();
    }
    if (originalDisconnect) {
      originalDisconnect.call(this);
    }
  };

  return component;
};

export async function applyActiveFilters(components: OBC.Components) {
  const classifier = components.get(OBC.Classifier);
  const hider = components.get(OBC.Hider);

  let finalMap: OBC.ModelIdMap | null = null;
  let hasAnyFilter = false;

  for (const [classificationName, selectedGroupNames] of selectedFilters.entries()) {
    if (selectedGroupNames.size === 0) continue;
    hasAnyFilter = true;

    const classification = classifier.list.get(classificationName);
    if (!classification) continue;

    const unionMaps: OBC.ModelIdMap[] = [];
    for (const groupName of selectedGroupNames) {
      const groupData = classification.get(groupName);
      if (groupData) {
        const modelIdMap = await groupData.get();
        unionMaps.push(modelIdMap);
      }
    }

    if (unionMaps.length > 0) {
      const classificationUnionMap = OBC.ModelIdMapUtils.join(unionMaps);
      if (finalMap === null) {
        finalMap = classificationUnionMap;
      } else {
        finalMap = OBC.ModelIdMapUtils.intersect([finalMap, classificationUnionMap]);
      }
    }
  }

  if (hasAnyFilter) {
    if (finalMap && !OBC.ModelIdMapUtils.isEmpty(finalMap)) {
      await hider.isolate(finalMap);
    } else {
      await hider.set(false);
    }
  } else {
    await hider.set(true);
  }
}

export * from "./src/types";

