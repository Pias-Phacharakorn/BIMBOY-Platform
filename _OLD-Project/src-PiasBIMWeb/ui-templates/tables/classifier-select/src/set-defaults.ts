import * as OBC from "@thatopen/components";
import * as BUI from "@thatopen/ui";
import { ClassifierListState, ClassifierListTableData } from "./types";
import { selectedFilters, activeUpdateFunctions, applyActiveFilters } from "../index";

function checkIsDisabled(components: OBC.Components, classificationName: string, groupName: string): boolean {
  const classifier = components.get(OBC.Classifier);

  if (selectedFilters.get(classificationName)?.has(groupName)) {
    return false;
  }

  let otherFiltersMap: OBC.ModelIdMap | null = null;
  let hasOtherFilters = false;

  for (const [otherName, selectedGroups] of selectedFilters.entries()) {
    if (otherName === classificationName || selectedGroups.size === 0) continue;
    hasOtherFilters = true;

    const classification = classifier.list.get(otherName);
    if (!classification) continue;

    const unionMaps: OBC.ModelIdMap[] = [];
    for (const gName of selectedGroups) {
      const groupData = classification.get(gName);
      if (groupData && groupData.map) {
        unionMaps.push(groupData.map);
      }
    }
    
    if (unionMaps.length > 0) {
      const unionMap = OBC.ModelIdMapUtils.join(unionMaps);
      if (otherFiltersMap === null) {
        otherFiltersMap = unionMap;
      } else {
        otherFiltersMap = OBC.ModelIdMapUtils.intersect([otherFiltersMap, unionMap]);
      }
    }
  }

  if (!hasOtherFilters || !otherFiltersMap) {
    return false;
  }

  const classification = classifier.list.get(classificationName);
  if (!classification) return true;

  const groupData = classification.get(groupName);
  if (!groupData || !groupData.map) return true;

  const intersection = OBC.ModelIdMapUtils.intersect([groupData.map, otherFiltersMap]);
  return OBC.ModelIdMapUtils.isEmpty(intersection);
}

export const setDefaults = (
  state: ClassifierListState,
  table: BUI.Table<ClassifierListTableData>,
  updateTable: () => void,
) => {
  const { components } = state;

  table.noIndentation = true;
  table.headersHidden = true;
  table.hiddenColumns = ["Classification"];
  table.columns = [
    { name: "Selected", width: "1.5rem" },
    "Name"
  ];

  table.dataTransform = {
    Selected: (cellValue, rowData) => {
      const { Name, Classification } = rowData;
      if (!(Name && Classification)) return cellValue;

      const isChecked = selectedFilters.get(Classification)?.has(Name) || false;
      const isDisabled = checkIsDisabled(components, Classification, Name);

      const onChange = async (e: Event) => {
        const checkbox = e.target as BUI.Checkbox;

        let classificationSet = selectedFilters.get(Classification);
        if (!classificationSet) {
          classificationSet = new Set();
          selectedFilters.set(Classification, classificationSet);
        }

        if (checkbox.checked) {
          classificationSet.add(Name);
        } else {
          classificationSet.delete(Name);
          if (classificationSet.size === 0) {
            selectedFilters.delete(Classification);
          }
        }

        await applyActiveFilters(components);

        for (const updateFn of activeUpdateFunctions) {
          updateFn();
        }
      };

      return BUI.html`
        <bim-checkbox ?checked=${isChecked} ?disabled=${isDisabled} @change=${onChange}></bim-checkbox>
      `;
    },

    Name: (cellValue, rowData) => {
      const { Name, Classification } = rowData;
      if (!(Name && Classification)) return cellValue;

      const isDisabled = checkIsDisabled(components, Classification, Name);
      const style = isDisabled ? "color: var(--muted-2, #888); opacity: 0.6; pointer-events: none;" : "";

      return BUI.html`
        <span style="${style}">${cellValue}</span>
      `;
    }
  };
};
