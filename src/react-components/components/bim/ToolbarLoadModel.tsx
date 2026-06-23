import { useState, useRef, useEffect } from "react";
import { useBimStore } from "@/react-components/store/bimStore";
import { Icon } from "@/react-components/components/ui";
import * as OBC from "@thatopen/components";

export function ToolbarLoadModel() {
  const { components } = useBimStore();
  const [isLoadOpen, setIsLoadOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsLoadOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!components) return null;

  const handleLoadFrag = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = ".frag";

    input.addEventListener("change", async () => {
      const files = input.files ? Array.from(input.files) : [];
      if (files.length === 0) return;

      const fragments = components.get(OBC.FragmentsManager);
      for (const file of files) {
        try {
          const buffer = await file.arrayBuffer();
          const model = await fragments.core.load(new Uint8Array(buffer), {
            modelId: file.name.replace(".frag", ""),
          });
          if (model) {
            (model as any).name = file.name;
          }
        } catch (err) {
          console.error(`Failed to load FRAG file "${file.name}":`, err);
        }
      }
    });

    input.click();
    setIsLoadOpen(false);
  };

  const handleLoadIfc = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = ".ifc";

    input.addEventListener("change", async () => {
      const files = input.files ? Array.from(input.files) : [];
      if (files.length === 0) return;

      const ifcLoader = components.get(OBC.IfcLoader);
      for (const file of files) {
        try {
          const buffer = await file.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          const model = await ifcLoader.load(
            bytes,
            true,
            file.name.replace(".ifc", "")
          );
          if (model) {
            (model as any).name = file.name;
          }
        } catch (err) {
          console.error(`Failed to load IFC file "${file.name}":`, err);
        }
      }
    });

    input.click();
    setIsLoadOpen(false);
  };

  const buttonClass =
    "inline-flex items-center justify-center gap-2 min-h-8 py-1 px-2.5 border border-transparent rounded-radius bg-transparent cursor-pointer text-xs font-semibold hover:border-border hover:bg-surface-alt hover:text-fg transition-all duration-120 text-white";

  return (
    <div className="relative flex items-center" ref={dropdownRef}>
      <button
        onClick={() => setIsLoadOpen(!isLoadOpen)}
        className={buttonClass}
        title="Load local model"
        type="button"
      >
        <Icon name="ADD" size={20} />
        <span>Load Model</span>
      </button>

      {isLoadOpen && (
        <div className="absolute bottom-full mb-2 left-0 w-36 rounded-lg bg-surface border border-border shadow-lg z-50 overflow-hidden py-1 backdrop-blur-md animate-in fade-in slide-in-from-bottom-1 duration-150">
          <button
            onClick={handleLoadFrag}
            className="w-full text-left px-4 py-2 text-xs font-semibold text-fg hover:bg-surface-alt transition-colors hover:text-accent-2 cursor-pointer"
            type="button"
          >
            Load FRAG
          </button>
          <button
            onClick={handleLoadIfc}
            className="w-full text-left px-4 py-2 text-xs font-semibold text-fg hover:bg-surface-alt transition-colors hover:text-accent-2 cursor-pointer"
            type="button"
          >
            Load IFC
          </button>
        </div>
      )}
    </div>
  );
}
