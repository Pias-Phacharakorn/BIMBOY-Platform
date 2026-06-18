# High-Fidelity UI Restoration Guide

This guide details the precise steps to resolve the remaining layout, spacing, and sizing deviations when transitioning from traditional CSS/SCSS to Tailwind CSS v4 in the React implementation.

---

## 1. Toolbar Buttons Padding & Height

### The Regression
In the original CSS, the buttons (`.btn`) are configured with a `min-height` and explicit vertical/horizontal paddings. In the React + Tailwind migration, the vertical padding class was omitted, causing the button text to feel cramped and reducing the computed height by `1.5px`.

* **CSS Specification**:
  ```css
  .btn {
    min-height: 32px;
    padding: 6px 12px;
  }
  ```
* **Current React State** (in `src/react-components/ProjectsPage.tsx`):
  * Lacks vertical padding (`py`) utility classes.
  * Computed height is `32px` instead of `33.5px`.

### The Restoration Fix
Add `py-1.5` (representing `6px` vertical padding) to the buttons inside [ProjectsPage.tsx](file:///c:/Users/PhacharakornMuangkae/AppData/Roaming/_GitHub%20Port/BIM-BOY/src/react-components/ProjectsPage.tsx).

#### Code Comparison:
```diff
- <button className="inline-flex items-center justify-center gap-2 min-h-8 px-3 border border-border-strong rounded-radius bg-gradient-to-b from-surface-raised to-surface-alt text-fg cursor-pointer text-xs font-semibold no-underline hover:border-[oklch(50%_0.05_252)] hover:bg-[oklch(25%_0.026_255)] hover:-translate-y-[1px] active:translate-y-0 transition-all duration-120" type="button">
+ <button className="inline-flex items-center justify-center gap-2 min-h-8 px-3 py-1.5 border border-border-strong rounded-radius bg-gradient-to-b from-surface-raised to-surface-alt text-fg cursor-pointer text-xs font-semibold no-underline hover:border-[oklch(50%_0.05_252)] hover:bg-[oklch(25%_0.026_255)] hover:-translate-y-[1px] active:translate-y-0 transition-all duration-120" type="button">
    Import
  </button>
- <button className="inline-flex items-center justify-center gap-2 min-h-8 px-3 border rounded-radius cursor-pointer text-xs font-semibold no-underline hover:-translate-y-[1px] active:translate-y-0 transition-all duration-120 border-[oklch(69%_0.15_252)] bg-gradient-to-b from-[oklch(70%_0.16_252)] to-[oklch(57%_0.16_252)] text-[oklch(99%_0.004_255)] hover:from-[oklch(73%_0.16_252)] hover:to-[oklch(60%_0.16_252)]" type="button">
+ <button className="inline-flex items-center justify-center gap-2 min-h-8 px-3 py-1.5 border rounded-radius cursor-pointer text-xs font-semibold no-underline hover:-translate-y-[1px] active:translate-y-0 transition-all duration-120 border-[oklch(69%_0.15_252)] bg-gradient-to-b from-[oklch(70%_0.16_252)] to-[oklch(57%_0.16_252)] text-[oklch(99%_0.004_255)] hover:from-[oklch(73%_0.16_252)] hover:to-[oklch(60%_0.16_252)]" type="button">
    New Project
  </button>
```

---

## 2. Project Card Height & Spacing

### The Regression
The original CSS layout for the card content did not apply a unified flex `gap`. Instead, it placed custom spacing on the elements. The React implementation uses `gap-4` (`16px`), causing the card content to expand, making the overall card `8.5px` too tall.

* **CSS Specification**:
  * Outer card height: `319px`.
  * Title block margin-bottom: `16px`.
  * Status block margin-bottom: `0px` (gap between status and progress bar is handled by a `mt-2` on progress bar).
* **Current React State** (in `src/react-components/ProjectCard.tsx`):
  * Content wrapper uses `flex flex-col gap-4` (`16px` between every child).
  * Computed height is `327.5px`.

### The Restoration Fix
Remove `gap-4` from the card content wrapper inside [ProjectCard.tsx](file:///c:/Users/PhacharakornMuangkae/AppData/Roaming/_GitHub%20Port/BIM-BOY/src/react-components/ProjectCard.tsx) and apply individual margin utility classes to structure the vertical flow.

#### Code Comparison:
```diff
- <div className="p-5 flex flex-col gap-4">
-   <div>
+ <div className="p-5 flex flex-col">
+   <div className="mb-4">
      <h3 className="text-base font-semibold mb-1 text-fg leading-snug">{project.projectName}</h3>
      <div className="flex gap-3 text-muted text-xs leading-none">
        <span className="font-mono">{display.label}</span>
        <span>Est. Completion: {display.estimatedCompletion}</span>
      </div>
    </div>

-   <div>
+   <div className="mb-0">
      <span className={`inline-flex items-center min-h-5 px-2 py-0.5 border rounded-full text-[10px] font-bold tracking-wider uppercase ${
        display.statusTone === "ok"
          ? "border-[oklch(70%_0.14_150_/_42%)] bg-[oklch(70%_0.14_150_/_13%)] text-status-ok"
          : display.statusTone === "warn"
          ? "border-[oklch(77%_0.14_76_/_42%)] bg-[oklch(77%_0.14_76_/_13%)] text-status-warn"
          : "border-border-strong bg-[oklch(18%_0.02_255)] text-muted"
      }`}>
        {display.statusLabel}
      </span>
    </div>

-   <div className="flex flex-col gap-1.5 mt-1">
+   <div className="flex flex-col gap-1.5 mt-2">
      <div className="flex justify-between text-muted text-[11px]">
        <span>Progress</span>
        <span className="font-mono">{display.progress}%</span>
      </div>
      <div className="h-1.5 overflow-hidden bg-[oklch(7%_0.012_255)] border border-border rounded-sm">
        <div className="h-full rounded-sm bg-gradient-to-r from-accent to-accent-2" style={{ width: `${display.progress}%` }} />
      </div>
    </div>
  </div>
```

---

## 3. Search Box Responsiveness & Icon Gap

### The Regression
In the original design, the search box container has a responsive width that scales down on smaller viewports, a safety minimum width, and an explicit gap between the search SVG icon and the input field. The React implementation uses a fixed width class `w-[400px]` and lacks the icon gap.

* **CSS Specification**:
  ```css
  .search-container {
    width: min(400px, 34vw) !important;
    min-width: 220px;
    gap: 8px;
  }
  ```
* **Current React State** (in `src/react-components/SearchBox.tsx`):
  * Search box wrapper has `w-[400px] max-w-full` and lacks a gap class.

### The Restoration Fix
Update the wrapper classes in [SearchBox.tsx](file:///c:/Users/PhacharakornMuangkae/AppData/Roaming/_GitHub%20Port/BIM-BOY/src/react-components/SearchBox.tsx) to map these exact responsive rules.

#### Code Comparison:
```diff
- <label className="flex items-center bg-surface-alt border border-border rounded-radius px-3 w-[400px] max-w-full" aria-label={placeholder}>
+ <label className="flex items-center bg-surface-alt border border-border rounded-radius px-3 w-[min(400px,34vw)] min-w-[220px] gap-2" aria-label={placeholder}>
```
