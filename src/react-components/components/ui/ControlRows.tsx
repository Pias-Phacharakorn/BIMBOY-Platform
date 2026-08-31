/**
 * Props-only control rows — label left, control right — shared by the render-settings panels.
 *
 * Promoted here from `features/post-render/` once a second consumer arrived (`features/realistic-view`):
 * a feature may not import another feature, so the rows had to become shared vocabulary. The app still
 * has no slider/colour/toggle primitives beyond these; `ToolbarSettings`, `ClashFilter` and
 * `ProjectSettingsForm` keep their own inline inputs rather than being refactored onto these as a
 * side effect. The visual idiom is copied from `ToolbarSettings` so they read as the same app.
 */

const ROW = "flex items-center justify-between gap-3 text-xs text-fg";
const LABEL = "font-medium text-muted";
const VALUE = "font-mono text-[11px] font-semibold text-fg tabular-nums";

/** Trims float noise without pinning every slider to the same precision. */
const format = (value: number, step: number) =>
  step >= 1 ? String(Math.round(value)) : value.toFixed(step >= 0.1 ? 1 : 2);

interface ToggleRowProps {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  /** Shown under the row — used to explain *why* a row is disabled. */
  note?: string;
}

export function ToggleRow({ label, checked, onChange, disabled = false, note }: ToggleRowProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className={`${ROW} ${disabled ? "opacity-50" : ""}`}>
        <span className={LABEL}>{label}</span>
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="w-4.5 h-4.5 rounded border-border text-accent bg-transparent accent-accent cursor-pointer disabled:cursor-not-allowed"
        />
      </div>
      {note ? <span className="text-[10px] leading-snug text-muted/80">{note}</span> : null}
    </div>
  );
}

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}

export function SliderRow({ label, value, min, max, step, onChange }: SliderRowProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className={ROW}>
        <span className={LABEL}>{label}</span>
        <span className={VALUE}>{format(value, step)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-accent cursor-pointer"
      />
    </div>
  );
}

interface ColorRowProps {
  label: string;
  /** `#rrggbb` — the only form `<input type="color">` accepts. */
  value: string;
  onChange: (value: string) => void;
}

export function ColorRow({ label, value, onChange }: ColorRowProps) {
  return (
    <div className={ROW}>
      <span className={LABEL}>{label}</span>
      <label className="flex items-center gap-2 bg-surface-alt border border-border px-2 py-1 rounded cursor-pointer hover:border-accent transition-colors">
        <span
          className="w-3.5 h-3.5 rounded-sm border border-border/40"
          style={{ backgroundColor: value }}
        />
        <span className="text-[11px] font-mono font-semibold text-fg uppercase">{value}</span>
        <input
          type="color"
          value={value}
          aria-label={label}
          onChange={(e) => onChange(e.target.value)}
          className="sr-only"
        />
      </label>
    </div>
  );
}

interface PresetRowProps {
  label: string;
  options: {
    id: string;
    label: string;
    /** Any CSS `background` shorthand — the swatch paints it verbatim, gradients included. */
    background: string;
  }[];
  /** `null` when the current value matches none of them, which is a normal state here. */
  activeId: string | null;
  onSelect: (id: string) => void;
}

/**
 * A row of one-click presets. Deliberately ignorant of what a preset *is*: it takes an already
 * resolved CSS background per option and an id to hand back, so it stays a props-only primitive
 * like its neighbours rather than importing whatever domain the presets came from.
 *
 * `activeId` is a highlight, not a mode — a caller is expected to derive it from the live value, so
 * a preset can be selected and then edited away from without this row needing to be told.
 */
export function PresetRow({ label, options, activeId, onSelect }: PresetRowProps) {
  return (
    <div className={ROW}>
      <span className={LABEL}>{label}</span>
      <div className="flex items-center gap-1.5">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onSelect(option.id)}
            aria-pressed={option.id === activeId}
            className={`flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded border text-[11px] font-semibold transition-colors duration-120 cursor-pointer ${
              option.id === activeId
                ? "border-accent bg-accent/15 text-fg"
                : "border-border bg-surface-alt text-muted hover:border-accent hover:text-fg"
            }`}
          >
            <span
              className="w-3.5 h-3.5 rounded-sm border border-border/40"
              style={{ background: option.background }}
            />
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface SelectRowProps<T extends number> {
  label: string;
  value: T;
  options: { label: string; value: T }[];
  onChange: (value: T) => void;
}

/**
 * Numeric-valued select. Both enums this panel drives (`PostproductionAspect`,
 * `EdgeDetectionPassMode`) are numeric, and the DOM only carries strings — so the cast back
 * happens here, once, instead of at every call site.
 */
export function SelectRow<T extends number>({ label, value, options, onChange }: SelectRowProps<T>) {
  return (
    <div className={ROW}>
      <span className={LABEL}>{label}</span>
      <div className="relative flex items-center">
        <select
          value={value}
          aria-label={label}
          onChange={(e) => onChange(Number(e.target.value) as T)}
          className="appearance-none bg-surface-alt border border-border rounded pl-2.5 pr-7 py-1.5 text-xs text-fg cursor-pointer focus:outline-none focus:border-accent font-semibold"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute right-2.5 text-muted flex items-center">
          <svg className="w-3 h-3 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </div>
  );
}
