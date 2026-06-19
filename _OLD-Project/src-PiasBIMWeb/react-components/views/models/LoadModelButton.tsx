import { useState, useRef, useEffect } from "react";
import * as OBC from "@thatopen/components";
import { useBimStore } from "../../store/bimStore";
import { Icon } from "../../components/Icon";

export function LoadModelButton() {
  const components = useBimStore((state) => state.components);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLoadIfc = () => {
    if (!components) return;
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = false;
    input.accept = ".ifc";

    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;

      try {
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        const ifcLoader = components.get(OBC.IfcLoader);
        const model = await ifcLoader.load(
          bytes,
          true,
          file.name.replace(".ifc", "")
        );
        if (model) {
          model.name = file.name;
        }
      } catch (err) {
        console.error("Failed to load IFC file:", err);
      }
    });

    input.click();
    setIsOpen(false);
  };

  const handleLoadFrag = () => {
    if (!components) return;
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = false;
    input.accept = ".frag";

    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;

      try {
        const buffer = await file.arrayBuffer();
        const fragments = components.get(OBC.FragmentsManager);
        const model = fragments.core.load(new Uint8Array(buffer), {
          modelId: file.name.replace(".frag", ""),
        });
        if (model) {
          model.name = file.name;
        }
      } catch (err) {
        console.error("Failed to load FRAG file:", err);
      }
    });

    input.click();
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={!components}
        className="react-bui-button"
        title="Load local model"
        aria-label="Load local model"
        type="button"
      >
        <Icon name="ADD" size={16} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-36 rounded-lg bg-surface border border-border shadow-lg z-50 overflow-hidden py-1 animate-in fade-in slide-in-from-top-1 duration-150">
          <button
            onClick={handleLoadFrag}
            className="w-full text-left px-4 py-2 text-xs font-semibold text-fg hover:bg-surface-raised transition-colors hover:text-accent"
            type="button"
          >
            Load FRAG
          </button>
          <button
            onClick={handleLoadIfc}
            className="w-full text-left px-4 py-2 text-xs font-semibold text-fg hover:bg-surface-raised transition-colors hover:text-accent"
            type="button"
          >
            Load IFC
          </button>
        </div>
      )}
    </div>
  );
}
