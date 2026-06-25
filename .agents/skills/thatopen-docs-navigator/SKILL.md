---
name: thatopen-docs-navigator
description: Navigator and directory structure guide for ThatOpen documentation (.agents/ThatOpen_docs). Use when researching ThatOpen component APIs, tutorials, or core concepts like IFC loading, clipping, or measurements.
---

# ThatOpen Documentation Navigator

Use this skill to navigate the local ThatOpen documentation located at `.agents/ThatOpen_docs`. This ensures you find the correct API references, tutorial MDX files, and architecture guides instead of relying on outdated memory.

> **CRITICAL VERSION CONSTRAINT:** All ThatOpen libraries must stay on **v3.4.x**. Always check peer dependencies before upgrading or using APIs.

---

## Invoke This Skill When
- You need to look up how to use a specific ThatOpen/OBC component (e.g., `Worlds`, `Clipper`, `Highlighter`, `IfcLoader`).
- You need to find the correct TypeScript API definitions, properties, or event interfaces.
- You are researching coordinate mapping, GIS integration, or interactive tools like measurements.
- You need code snippets or step-by-step tutorials from the ThatOpen ecosystem.

---

## 🗺️ Documentation Directory Map

The documentation is organized into three major sections under `.agents/ThatOpen_docs/`:

```
.agents/ThatOpen_docs/
├── intro.md               # Overview of the libraries, capabilities, and navigation
├── migration.md           # Guide for upgrading versions
├── contributing.md        # Guidelines for contributing to ThatOpen
├── components/            # Fundamentals of components and custom component creation
├── fragments/             # Fragment geometry format, custom building, and schema
├── api/                   # TypeDoc generated API definitions
└── Tutorials/             # Step-by-step feature implementations
```

---

## 🧩 1. Core Architecture & Components
If you need to understand how components are structured, disposed, or created:
- **Getting Started:** [getting-started.md](../../ThatOpen_docs/components/getting-started.md)
- **Creating Custom Components:** [creating-components.md](../../ThatOpen_docs/components/creating-components.md) (See also the specialized [_thatopen-bim-component](../_thatopen-bim-component/SKILL.md) skill)
- **Clean Components Guide:** [clean-components-guide.md](../../ThatOpen_docs/components/clean-components-guide.md)
- **Tutorial Paths:** [tutorial-paths.md](../../ThatOpen_docs/components/tutorial-paths.md)

---

## 👩🏻‍🏫 2. Tutorials Directory
Step-by-step tutorials containing fully functional typescript code snippets and configuration guides.

### A. Core Engine Components (`Tutorials/Components/Core/`)
These handle 3D rendering setup, IFC file parsing, cameras, and basic scene logic:
- **Worlds (Setting up the 3D viewport/canvas):** [Worlds.mdx](../../ThatOpen_docs/Tutorials/Components/Core/Worlds.mdx)
- **IFC Loader (Reading .ifc files):** [IfcLoader.mdx](../../ThatOpen_docs/Tutorials/Components/Core/IfcLoader.mdx)
- **Fragments Manager (Working with .frag files):** [FragmentsManager.mdx](../../ThatOpen_docs/Tutorials/Components/Core/FragmentsManager.mdx)
- **Clipper (Basic Section Cuts / Clipping planes):** [Clipper.mdx](../../ThatOpen_docs/Tutorials/Components/Core/Clipper.mdx)
- **Classifier (Categorizing model elements/hierarchies):** [Classifier.mdx](../../ThatOpen_docs/Tutorials/Components/Core/Classifier.mdx)
- **BCF Topics (BIM Collaboration Format integration):** [BCFTopics.mdx](../../ThatOpen_docs/Tutorials/Components/Core/BCFTopics.mdx)
- **Edge Projector (Adding 2D profiles for section boxes):** [EdgeProjector.mdx](../../ThatOpen_docs/Tutorials/Components/Core/EdgeProjector.mdx)
- **Ortho-Perspective Camera (Advanced camera projection):** [OrthoPerspectiveCamera.mdx](../../ThatOpen_docs/Tutorials/Components/Core/OrthoPerspectiveCamera.mdx)
- **Raycasters (Detecting clicks/mouse positions in 3D):** [Raycasters.mdx](../../ThatOpen_docs/Tutorials/Components/Core/Raycasters.mdx)
- **Hider (Filtering/hiding categories or items):** [Hider.mdx](../../ThatOpen_docs/Tutorials/Components/Core/Hider.mdx)
- **Other Core tools:** BoundingBoxer, Grids, IDSSpecifications, ItemsFinder, ShadowedScene, Viewpoints, Views.

### B. Interactive & Front Tools (`Tutorials/Components/Front/`)
These contain components that manage active user interactions (like mouse drawings and measurements):
- **Angle Measurement:** [AngleMeasurement.mdx](../../ThatOpen_docs/Tutorials/Components/Front/AngleMeasurement.mdx)
- **Area Measurement:** [AreaMeasurement.mdx](../../ThatOpen_docs/Tutorials/Components/Front/AreaMeasurement.mdx)
- **Length Measurement:** [LengthMeasurement.mdx](../../ThatOpen_docs/Tutorials/Components/Front/LengthMeasurement.mdx)
- **Volume Measurement:** [VolumeMeasurement.mdx](../../ThatOpen_docs/Tutorials/Components/Front/VolumeMeasurement.mdx)
- **Highlighter (Highlighting hovered/selected elements):** [Highlighter.mdx](../../ThatOpen_docs/Tutorials/Components/Front/Highlighter.mdx)
- **Hoverer (Simple mouseover preview highlighting):** [Hoverer.mdx](../../ThatOpen_docs/Tutorials/Components/Front/Hoverer.mdx)
- **Clip Styler (Styling cut profiles in 3D viewports):** [ClipStyler.mdx](../../ThatOpen_docs/Tutorials/Components/Front/ClipStyler.mdx)
- **Outliner (Adding borders/outlines to components):** [Outliner.mdx](../../ThatOpen_docs/Tutorials/Components/Front/Outliner.mdx)
- **Drawing Editor:** [DrawingEditor.mdx](../../ThatOpen_docs/Tutorials/Components/Front/DrawingEditor.mdx)
- **Postproduction Renderer (Ambience, outlines, shadows):** [PostproductionRenderer.mdx](../../ThatOpen_docs/Tutorials/Components/Front/PostproductionRenderer.mdx)

### C. UI & Templates (`Tutorials/UserInterface/`)
- **Index/Introduction to BUI (BIM UI):** [index.md](../../ThatOpen_docs/Tutorials/UserInterface/index.md)
- **OBC-Specific UI Elements (ModelsList, ItemsData, etc.):** [OBC/](../../ThatOpen_docs/Tutorials/UserInterface/OBC/)

---

## 📋 3. TypeDoc API Reference Guide
If you need precise property types, method parameters, or export names, check the generated API references. They are split by packages under `api/@thatopen/`:

| Package / Folder Name | Target Functionality |
| --- | --- |
| [components](../../ThatOpen_docs/api/@thatopen/components) | Core OBC components (`Worlds`, `Clipper`, `FragmentsManager`, etc.) |
| [components-front](../../ThatOpen_docs/api/@thatopen/components-front) | Interactive UI/rendering tools (`Highlighter`, `LengthMeasurement`, etc.) |
| [fragments](../../ThatOpen_docs/api/@thatopen/fragments) | Low-level fragment model representation and raw geometry serialization |
| [ui](../../ThatOpen_docs/api/@thatopen/ui) | Base BUI components (inputs, panels, buttons) |
| [ui-obc](../../ThatOpen_docs/api/@thatopen/ui-obc) | Pre-built BUI components bound to OBC tools (such as model checklists or property panels) |

---

## 🔍 How to Search & Reference Docs Efficiently

1. **Start with Tutorials for Logic & Setup:** If writing feature code (e.g. configuring a section cut), read the corresponding tutorial first (e.g. `Clipper.mdx` or `ClipStyler.mdx`).
2. **Double check API exports via TypeDoc index files:** If you are unsure of imports or parameter signatures, run a `grep_search` under the specific `api/@thatopen/` folder.
3. **Strict Shadow DOM Boundary Check:** Remember the project constraint—`<bim-*>` web components are *only* allowed inside `src/components/bim/ViewportWrapper.tsx`. Do not copy BUI layouts directly from tutorials into React components outside of this boundary. Use custom React components instead.
