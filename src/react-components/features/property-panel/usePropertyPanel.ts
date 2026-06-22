import { useState, useEffect, useMemo } from "react";
import * as OBC from "@thatopen/components";
import { useBimStore } from "@/react-components/store/bimStore";

export interface PropRow {
  key: string;
  value: string;
}

export interface PropGroup {
  title: string;
  rows: PropRow[];
}

function getPropertyValue(obj: any, keys: string[]): any {
  if (!obj || typeof obj !== "object") return undefined;
  for (const key of keys) {
    const val = obj[key];
    if (val !== undefined && val !== null) {
      if (typeof val === "object" && "value" in val) {
        return val.value;
      }
      return val;
    }
  }
  return undefined;
}

function parseIfcData(ifcData: any, expressId: number, model: any): PropGroup[] {
  const groups: PropGroup[] = [];

  // 1. Item Group
  const getName = () => {
    return String(getPropertyValue(ifcData, ["Name", "name", "NAME"]) || "-");
  };

  const getGuid = () => {
    return String(getPropertyValue(ifcData, ["_guid", "globalId", "GlobalId", "globalID", "GlobalID", "guid", "Guid", "GUID"]) || "-");
  };

  const getCategory = () => {
    return String(getPropertyValue(ifcData, ["_category", "type", "Template"]) || "-");
  };

  const getSourceFile = () => {
    const nameToUse = model.name || model.uuid || "";
    return nameToUse.replace(/\.(ifc|frag)$/i, "") || "-";
  };

  const getLocalId = () => {
    return String(getPropertyValue(ifcData, ["_localId", "localId", "localID", "expressId", "expressID"]) || expressId);
  };

  // 1. Item Group
  const itemRows: PropRow[] = [];
  itemRows.push({ key: "Name", value: getName() });
  itemRows.push({ key: "Type", value: getCategory() });
  itemRows.push({ key: "Source File", value: getSourceFile() });
  itemRows.push({ key: "Express ID", value: getLocalId() });

  groups.push({ title: "Item", rows: itemRows });

  // 2. GUID Group
  groups.push({
    title: "GUID",
    rows: [{ key: "Value", value: getGuid() }],
  });

  // 3. Location Group (from ContainedInStructure)
  if (ifcData.ContainedInStructure && Array.isArray(ifcData.ContainedInStructure)) {
    const locationRows: PropRow[] = [];
    for (const container of ifcData.ContainedInStructure) {
      const type = String(getPropertyValue(container, ["_category", "type"]) || "");
      const name = getPropertyValue(container, ["Name", "name", "NAME"]);
      if (name) {
        const upperType = type.toUpperCase();
        if (upperType === "IFCBUILDINGSTOREY") {
          locationRows.push({ key: "Level", value: String(name) });
        } else if (upperType === "IFCSPACE") {
          locationRows.push({ key: "Space", value: String(name) });
        } else {
          const cleanType = type.replace(/^IFC/i, "").toLowerCase();
          const capitalizedType = cleanType ? (cleanType.charAt(0).toUpperCase() + cleanType.slice(1)) : "Structure";
          locationRows.push({ key: capitalizedType, value: String(name) });
        }
      }
    }
    if (locationRows.length > 0) {
      groups.push({ title: "Location", rows: locationRows });
    }
  }

  // 4. Material Group (from HasAssociations)
  if (ifcData.HasAssociations && Array.isArray(ifcData.HasAssociations)) {
    const materialNames: string[] = [];
    for (const assoc of ifcData.HasAssociations) {
      const name = getPropertyValue(assoc, ["Name", "name", "NAME"]);
      const type = String(getPropertyValue(assoc, ["_category", "type"]) || "").toUpperCase();

      if (name && (type === "IFCMATERIAL" || type === "IFCMATERIALLAYER" || type === "IFCMATERIALPROFILE")) {
        materialNames.push(String(name));
      } else if (type === "IFCMATERIALLAYERSETUSAGE" || type === "IFCMATERIALLAYERSET" || type === "IFCMATERIALPROFILESETUSAGE" || type === "IFCMATERIALPROFILESET") {
        if (name) {
          materialNames.push(String(name));
        }
        if (assoc.ForLayerSet?.MaterialLayers && Array.isArray(assoc.ForLayerSet.MaterialLayers)) {
          for (const layer of assoc.ForLayerSet.MaterialLayers) {
            const layerMatName = getPropertyValue(layer.Material, ["Name", "name", "NAME"]);
            if (layerMatName) {
              materialNames.push(String(layerMatName));
            }
          }
        }
        if (assoc.MaterialLayers && Array.isArray(assoc.MaterialLayers)) {
          for (const layer of assoc.MaterialLayers) {
            const layerMatName = getPropertyValue(layer.Material, ["Name", "name", "NAME"]);
            if (layerMatName) {
              materialNames.push(String(layerMatName));
            }
          }
        }
      } else if (name) {
        materialNames.push(String(name));
      }
    }
    if (materialNames.length > 0) {
      const uniqueMaterials = Array.from(new Set(materialNames));
      groups.push({
        title: "Material",
        rows: uniqueMaterials.map((mat, idx) => ({
          key: uniqueMaterials.length === 1 ? "Name" : `Material ${idx + 1}`,
          value: mat,
        })),
      });
    }
  }

  // 5. Parent Element Group (from Decomposes)
  if (ifcData.Decomposes && Array.isArray(ifcData.Decomposes)) {
    const parentRows: PropRow[] = [];
    for (const parent of ifcData.Decomposes) {
      const name = getPropertyValue(parent, ["Name", "name", "NAME"]);
      const type = String(getPropertyValue(parent, ["_category", "type"]) || "");
      if (name) {
        const cleanType = type.replace(/^IFC/i, "").toLowerCase();
        const capitalizedType = cleanType ? (cleanType.charAt(0).toUpperCase() + cleanType.slice(1)) : "Parent";
        parentRows.push({ key: capitalizedType, value: String(name) });
      }
    }
    if (parentRows.length > 0) {
      groups.push({ title: "Parent Element", rows: parentRows });
    }
  }

  // 6. Attributes Group
  const attributeRows: PropRow[] = [];
  const excludedKeys = new Set([
    "name", "globalid", "localid", "category", "sourcefile", "type", "expressid",
    "_guid", "_category", "_localid"
  ]);
  
  for (const [key, value] of Object.entries(ifcData)) {
    if (key.startsWith("_") || Array.isArray(value) || typeof value !== "object") continue;
    
    const lowerKey = key.toLowerCase();
    if (excludedKeys.has(lowerKey)) continue;

    const attr = value as any;
    if (attr && "value" in attr && attr.value !== undefined && attr.value !== null) {
      attributeRows.push({
        key,
        value: String(attr.value),
      });
    }
  }

  if (attributeRows.length > 0) {
    groups.push({ title: "Attributes", rows: attributeRows });
  }

  // 7. Property Sets (Psets)
  if (ifcData.IsDefinedBy && Array.isArray(ifcData.IsDefinedBy)) {
    for (const pset of ifcData.IsDefinedBy) {
      const psetName = pset.Name?.value;
      if (!psetName || !pset.HasProperties || !Array.isArray(pset.HasProperties)) continue;

      const psetRows: PropRow[] = [];
      for (const prop of pset.HasProperties) {
        const propName = prop.Name?.value;
        const propValue = prop.NominalValue?.value;
        if (propName && propValue !== undefined && propValue !== null) {
          psetRows.push({
            key: propName,
            value: String(propValue),
          });
        }
      }

      if (psetRows.length > 0) {
        // Sort properties inside the set alphabetically
        psetRows.sort((a, b) => a.key.localeCompare(b.key));
        groups.push({ title: psetName, rows: psetRows });
      }
    }
  }

  return groups;
}

export function usePropertyPanel() {
  const { components, selectionMap, selectedElementIds } = useBimStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [propertyGroups, setPropertyGroups] = useState<PropGroup[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Flatten the selection map into an array of { modelId, expressId } pairs
  const flatSelectionList = useMemo(() => {
    if (!selectionMap) return [];
    const list: { modelId: string; expressId: number }[] = [];
    const modelIds = Object.keys(selectionMap);
    for (const modelId of modelIds) {
      const ids = selectionMap[modelId];
      if (ids) {
        for (const id of ids) {
          list.push({ modelId, expressId: id });
        }
      }
    }
    return list;
  }, [selectionMap]);

  const totalCount = flatSelectionList.length;

  // Reset index to 0 when the overall selection changes
  useEffect(() => {
    setCurrentIndex(0);
  }, [selectedElementIds]);

  useEffect(() => {
    if (!components || totalCount === 0 || currentIndex >= totalCount) {
      setPropertyGroups([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    let isCurrent = true;

    const selectedItem = flatSelectionList[currentIndex];
    const firstModelId = selectedItem.modelId;
    const firstExpressId = selectedItem.expressId;

    const fetchProperties = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const fragments = components.get(OBC.FragmentsManager);
        const model = fragments.list.get(firstModelId);
        if (!model) {
          throw new Error("Selected element model not found in fragments manager.");
        }

        const ifcDataArray = await (model as any).getItemsData([firstExpressId], {
          attributesDefault: true,
          relations: {
            IsDefinedBy: { attributes: true, relations: true },
            ContainedInStructure: { attributes: true, relations: true },
            HasAssociations: { attributes: true, relations: true },
            Decomposes: { attributes: true, relations: true },
            DefinesOccurrence: { attributes: false, relations: false },
            ContainsElements: { attributes: false, relations: false },
            AssociatedTo: { attributes: false, relations: false },
            IsDecomposedBy: { attributes: false, relations: false },
          },
        });

        if (!isCurrent) return;

        if (!ifcDataArray || ifcDataArray.length === 0 || !ifcDataArray[0]) {
          throw new Error("No properties found for the selected element.");
        }

        const groups = parseIfcData(ifcDataArray[0], firstExpressId, model);
        setPropertyGroups(groups);
      } catch (err: any) {
        if (isCurrent) {
          console.error("Error fetching element properties:", err);
          setError(err.message || "Failed to fetch element properties.");
          setPropertyGroups([]);
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    };

    void fetchProperties();

    return () => {
      isCurrent = false;
    };
  }, [components, flatSelectionList, currentIndex, totalCount]);

  const goNext = () => {
    if (currentIndex < totalCount - 1) setCurrentIndex((i) => i + 1);
  };
  const goPrev = () => {
    if (currentIndex > 0) setCurrentIndex((i) => i - 1);
  };
  const goFirst = () => {
    setCurrentIndex(0);
  };
  const goLast = () => {
    if (totalCount > 0) setCurrentIndex(totalCount - 1);
  };

  return {
    isLoading,
    error,
    propertyGroups,
    totalSelectedCount: totalCount,
    currentIndex,
    goNext,
    goPrev,
    goFirst,
    goLast,
  };
}
