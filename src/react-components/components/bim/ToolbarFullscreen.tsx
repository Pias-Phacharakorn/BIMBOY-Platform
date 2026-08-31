import { Icon } from "@/react-components/components/ui";
import { useViewportFullscreen } from "@/react-components/features/viewport-fullscreen/useViewportFullscreen";

/**
 * Full-screen toggle — hides the `Sidebar` and `WorkspaceHeader` and enters browser fullscreen as
 * one action. See `useViewportFullscreen` for why the browser, not this button, owns the state.
 *
 * The glyph swaps rather than only tinting, which is the `ToolbarGhost` convention. Fullscreen
 * removes every other piece of app chrome, so this rail is the only thing left to orient by and the
 * exit affordance should not rest on a colour difference alone — the active styling is kept too.
 */
export function ToolbarFullscreen() {
  const { isFullscreen, toggle } = useViewportFullscreen();

  const buttonClass = `inline-flex items-center justify-center gap-2 min-h-8 p-1 border border-transparent rounded-radius bg-transparent cursor-pointer text-xs font-semibold hover:border-border hover:bg-surface-alt hover:text-fg transition-all duration-120 ${
    isFullscreen ? "text-accent-2 bg-surface-alt border-border" : "text-white"
  }`;

  return (
    <button
      className={buttonClass}
      title={isFullscreen ? "Exit Fullscreen (Esc)" : "Toggle Fullscreen"}
      type="button"
      onClick={toggle}
    >
      <Icon name={isFullscreen ? "COLLAPSE" : "EXPAND"} size={20} />
    </button>
  );
}
