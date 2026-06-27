import { useState, useRef, useEffect } from "react";
import { useBimStore } from "@/react-components/store/bimStore";
import { useUIStore } from "@/react-components/store/uiStore";
import { Icon } from "@/react-components/components/ui";
import * as OBC from "@thatopen/components";
import { CloudModelModal } from "./CloudModelModal";
import { cn } from "@/lib/utils";

export function ToolbarLoadModel() {
  const { components } = useBimStore();
  const { isCloudModalOpen, setCloudModalOpen } = useUIStore();
  const [isOpen, setIsOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!components) return null;

  const closeDropdown = () => {
    setIsOpen(false);
  };

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
    closeDropdown();
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
    closeDropdown();
  };

  const menuItemClass =
    "w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-fg hover:bg-surface-raised hover:text-accent transition-colors duration-100 cursor-pointer select-none";

  const subItemClass =
    "w-full flex items-center gap-2.5 pl-7 pr-3 py-1.5 text-xs font-medium text-muted hover:bg-surface-raised hover:text-fg transition-colors duration-100 cursor-pointer select-none";

  return (
    <div className="flex items-center">
      <div className="relative flex items-center" ref={dropdownRef}>
        {/* Trigger Button */}
        <button
          onClick={() => {
            setIsOpen(!isOpen);
          }}
          className={cn(
            "inline-flex items-center justify-center gap-2 min-h-8 py-1 px-2.5 border rounded-radius cursor-pointer text-xs font-semibold transition-all duration-120 text-white",
            isOpen
              ? "border-border bg-surface-alt text-fg"
              : "border-transparent bg-transparent hover:border-border hover:bg-surface-alt hover:text-fg"
          )}
          title="Load model"
          type="button"
        >
          <Icon name="ADD" size={14} />
          <span>Load Model</span>
        </button>

        {/* Dropdown */}
        {isOpen && (
          <div className="absolute bottom-full mb-2 left-0 w-44 rounded-lg bg-surface border border-border shadow-xl z-50 overflow-hidden py-1 backdrop-blur-md animate-in fade-in slide-in-from-bottom-1 duration-150">
            {/* Cloud Models */}
            <button
              onClick={() => {
                setCloudModalOpen(true);
                closeDropdown();
              }}
              className={menuItemClass}
              type="button"
            >
              <Icon name="CLOUD" size={14} className="text-accent shrink-0" />
              <span>Cloud Models</span>
            </button>

            <div className="mx-3 my-0.5 border-t border-border/60" />

            {/* Local Model — always expanded */}
            <div className={cn(menuItemClass, "pointer-events-none opacity-60")}>
              <Icon name="FOLDER" size={14} className="text-muted shrink-0" />
              <span>Local Model</span>
            </div>
            <button onClick={handleLoadIfc} className={subItemClass} type="button">
              <Icon name="FILE" size={13} className="text-muted-2 shrink-0" />
              <span>Load IFC</span>
            </button>
            <button onClick={handleLoadFrag} className={subItemClass} type="button">
              <Icon name="FILE" size={13} className="text-muted-2 shrink-0" />
              <span>Load FRAG</span>
            </button>
          </div>
        )}
      </div>

      {isCloudModalOpen && (
        <CloudModelModal onClose={() => setCloudModalOpen(false)} />
      )}
    </div>
  );
}
