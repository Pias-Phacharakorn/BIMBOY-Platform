# GEMINI — AI Context Map

> **Read this file first.** It tells you who you're working with, what this project is, and where to find everything.

---

## 🧑‍💻 About the Developer

You are pair-programming with a **Senior Software Developer** who has deep expertise in:

- **BIM** (Building Information Modeling) — IFC workflows, model data, clipping, highlighting
- **GIS** (Geographic Information Systems) — Cesium, 2D/3D map layers, coordinate systems
- **Web Application Development** — React, Three.js, Vite, TypeScript, Firebase

Communicate concisely. The developer understands architecture-level concepts — you don't need to over-explain fundamentals.

---

## 🏗️ Project Identity

**LearnThatOpen** is a BIM + GIS portfolio web application built on the [That Open Company](https://docs.thatopen.com/) open-source ecosystem.

It lets users browse construction projects, load IFC/Fragment 3D models into an interactive viewport, query building data with smart views, and overlay GIS map layers (Cesium 3D Tiles).

### Tech Stack

| Layer        | Technology                                                   |
| ------------ | ------------------------------------------------------------ |
| UI Framework | React 19 + React Router 7                                    |
| BIM Engine   | `@thatopen/components` (OBC) + `@thatopen/ui` (BUI) — v3.4.x |
| 3D Renderer  | Three.js ^0.182                                              |
| GIS          | Cesium ^1.140 + 3d-tiles-renderer ^0.4                       |
| Build Tool   | Vite 7                                                       |
| Backend      | Firebase (Firestore, Cloud Functions + Emulator)             |
| Language     | TypeScript ^5.2                                              |

---

## ⚙️ Quick Setup

```bash
npm install
npm run dev        # Starts Vite dev server
```

No build step needed for development. Vite serves everything with HMR.

---

## 🗺️ Where to Find Information

Use this table as a routing map — don't re-read the whole codebase, go straight to the right file.

| Topic                                    | Location                                      |
| ---------------------------------------- | --------------------------------------------- |
| **Agent Skills (Architecture, UI, BIM)** | `.agent/skills/`                              |
| **React Router 7 Patterns**              | `.agent/skills/react-router-framework-mode/SKILL.md` |
| **Firestore setup & rules**              | `.agent/skills/firebase-firestore/SKILL.md`   |
| **Global icons & constants**             | `src/globals.ts`                              |
| **BIM engine initialization**            | `src/bim-components/setup/src/index.ts`       |
| **Main React entry**                     | `src/index.tsx`                               |
| **3D viewer page (grid layout)**         | `src/react-components/ProjectDetailsPage.tsx` |
| **Clash Report (BIM component)**         | `src/bim-components/ClashReport/index.ts`     |
| **Clash HTML Parser logic**              | `src/bim-components/ClashReport/src/parser.ts`|

---

## 📋 Mandatory Workflow

For **EVERY** prompt, Gemini MUST create an **Implementation Plan** before writing any code or making changes. The plan must follow this structure:

1. **The Problem**: Clear summary of what the user is asking.
2. **The Solution**: Detailed technical approach on how to solve the problem.
3. **Open Questions**: You must provide exactly **5 questions** for the user to clarify requirements or design.
4. **Verification Plan**: Step-by-step plan to verify the implementation.

> [!IMPORTANT]
> You must wait for user approval of the implementation plan before execution.

---

## 🔍 Best Practices

- **Always refer to the official docs**: If you need to implement a complex feature like IFC loading, clipping planes, or raycasting, always search the [official docs](https://docs.thatopen.com/) for the corresponding `@thatopen/components` module.
- **Agent Skills**: For specific technical rules on UI separation, BUI event binding, and component implementation, always refer to the `.agent/skills/` folder.

---

## 🔄 Version Information

- **Current Version**: 3.4.x
- Always ensure all ThatOpen libraries (`@thatopen/components`, `@thatopen/ui`, `@thatopen/fragments`, etc.) are on the same version (e.g. 3.4.0) to avoid compatibility issues.
- When upgrading, check peer dependencies like `three.js` or `web-ifc` to ensure they match the required versions for the library.
- _Migration Note:_ If an API feature seems missing, verify the official [migration guide](https://docs.thatopen.com/migration) to see if it was removed, renamed, or merged into another tool.

---

## 🧹 Memory Management Reminder

BIM apps are data-heavy; you **must** implement `OBC.Disposable`, use `OBC.Disposer` for Three.js meshes, and unbind all DOM events to prevent memory leaks (see the `.agent/skills/learnopen-add-custom-bim-component` skill for full details).
