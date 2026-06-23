import { useState, useRef } from "react";
import { useBimStore } from "@/react-components/store/bimStore";
import { Icon } from "@/react-components/components/ui";
import * as OBC from "@thatopen/components";

export function ToolbarGhost() {
  const { components } = useBimStore();
  const [isGhostActive, setIsGhostActive] = useState(false);
  const originalMaterialsData = useRef<Map<any, any>>(new Map());

  if (!components) return null;

  const handleToggleGhost = () => {
    const fragments = components.get(OBC.FragmentsManager);
    const materials = [...fragments.core.models.materials.list.values()];

    if (isGhostActive) {
      // Restore transparency
      for (const [material, data] of originalMaterialsData.current) {
        const { color, transparent, opacity, lodOpacity } = data;

        material.transparent = transparent;
        if ("color" in material) {
          material.opacity = opacity;
          material.color.setHex(color);
        } else {
          material.uniforms.lodColor.value.setHex(color);
          material.uniforms.lodOpacity.value = lodOpacity;
        }
        material.needsUpdate = true;
      }
      originalMaterialsData.current.clear();
      setIsGhostActive(false);
    } else {
      // Set model transparency (ghost mode)
      for (const material of materials) {
        if (material.userData.customId) continue;
        let color: number | undefined;
        let lodOpacity: number | undefined;
        if ("color" in material) {
          color = material.color.getHex();
        } else {
          color = material.lodColor.getHex();
          lodOpacity = material.uniforms.lodOpacity.value;
        }

        originalMaterialsData.current.set(material, {
          color,
          transparent: material.transparent,
          opacity: material.opacity,
          lodOpacity,
        });

        material.transparent = true;
        if ("color" in material) {
          material.opacity = 0.05;
          material.color.setColorName("white");
        } else {
          material.uniforms.lodColor.value.setColorName("white");
          material.uniforms.lodOpacity.value = 0.05;
        }
        material.needsUpdate = true;
      }
      setIsGhostActive(true);
    }
  };

  const buttonClass = `inline-flex items-center justify-center gap-2 min-h-8 p-1 border border-transparent rounded-radius bg-transparent cursor-pointer text-xs font-semibold hover:border-border hover:bg-surface-alt hover:text-fg transition-all duration-120 ${
    isGhostActive ? "text-accent-2 bg-surface-alt border-border" : "text-white"
  }`;

  return (
    <button
      className={buttonClass}
      title="Toggle Ghost (Transparency)"
      type="button"
      onClick={handleToggleGhost}
    >
      <Icon name="TRANSPARENT" size={20} />
    </button>
  );
}
