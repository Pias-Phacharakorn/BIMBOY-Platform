import { useBimStore } from "@/react-components/store/bimStore";
import { Icon } from "@/react-components/components/ui";
import * as OBC from "@thatopen/components";

export function ToolbarShowAll() {
  const { components } = useBimStore();

  if (!components) return null;

  const handleShowAll = async () => {
    const hider = components.get(OBC.Hider);
    await hider.set(true);
  };

  const buttonClass =
    "inline-flex items-center justify-center gap-2 min-h-8 p-1 border border-transparent rounded-radius bg-transparent cursor-pointer text-xs font-semibold hover:border-border hover:bg-surface-alt hover:text-fg transition-all duration-120 text-white";

  return (
    <button
      className={buttonClass}
      title="Show All"
      type="button"
      onClick={handleShowAll}
    >
      <Icon name="SHOW" size={20} />
    </button>
  );
}
