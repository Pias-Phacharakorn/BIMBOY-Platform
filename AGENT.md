# GEMINI — AI Context Map

> Read this first. It tells you who you're working with, what this project is, and where to find everything.

---

## 🧑‍💻 About the Developer

You are pair-programming with a **Senior Software Developer** with deep expertise in BIM (IFC workflows, model data, clipping, highlighting), GIS (Cesium, 2D/3D map layers, coordinate systems), and Web Development (React, Three.js, Vite, TypeScript, Firebase).

Communicate concisely. Don't over-explain fundamentals.

---

## 🏗️ Project Identity

**BIMBOY** is a BIM + GIS portfolio web application built on the [That Open Company](.agent/ThatOpen_docs/intro.md) ecosystem. Users browse construction projects, load IFC/Fragment 3D models, query building data with smart views, and overlay GIS map layers (Cesium 3D Tiles).

### Tech Stack

| Layer        | Technology                                                      |
| ------------ | --------------------------------------------------------------- |
| UI Framework | React 19 + React Router 7                                       |
| Styling      | Tailwind CSS v4                                                 |
| BIM Engine   | `@thatopen/components` (OBC) + `@thatopen/ui` (BUI) — v3.4.x  |
| 3D Renderer  | Three.js ^0.182                                                 |
| GIS          | Cesium ^1.140 + 3d-tiles-renderer ^0.4                          |
| Build Tool   | Vite 7                                                          |
| Backend      | Firebase (Firestore, Cloud Functions + Emulator)                |
| Language     | TypeScript ^5.2                                                 |

---

## 🎨 Styling

All custom base styles must live inside `@layer base {}` in `style.css`.  
**Why:** Unlayered styles override Tailwind utilities. Wrapping in `@layer base` lets utilities win.

---

## 🗺️ Codebase Map

| Topic                               | Location                                                        |
| ----------------------------------- | --------------------------------------------------------------- |
| Agent Skills (Architecture, UI, BIM)| `.agent/skills/`                                                |
| React Router 7 Patterns             | `.agent/skills/react-router-framework-mode/SKILL.md`           |
| Firestore setup & rules             | `.agent/skills/firebase-firestore/SKILL.md`                    |
| Global icons & constants            | `src/globals.ts`                                                |
| BIM engine initialization           | `src/bim-components/setup/src/index.ts`                        |
| Main React entry                    | `src/index.tsx`                                                 |
| 3D viewer page (grid layout)        | `src/react-components/ProjectDetailsPage.tsx`                  |
| Clash Report (BIM component)        | `src/bim-components/ClashReport/index.ts`                      |
| Clash HTML Parser logic             | `src/bim-components/ClashReport/src/parser.ts`                 |

---

## 📋 Mandatory Workflow

For **every** prompt, create an **Implementation Plan** before writing any code:

1. **The Problem** — Clear summary of what is being asked.
2. **The Solution** — Detailed technical approach.
3. **Open Questions** — Exactly **5 questions** for the user to clarify requirements.
4. **Verification Plan** — Step-by-step plan to verify the implementation.

Wait for user approval before execution.

---

## 🔍 Best Practices

- Refer to the local [ThatOpen Docs](.agent/ThatOpen_docs) for any OBC feature before implementing.
- Always check `.agent/skills/` for UI separation, BUI event binding, and component rules.
- Implement `OBC.Disposable`, use `OBC.Disposer` for Three.js meshes, and unbind all DOM events. See `.agent/skills/learnopen-add-custom-bim-component`.

---

## 🔄 Version

- Current: **3.4.x** — keep all ThatOpen libraries on the same version to avoid compatibility issues.
- Check peer deps (`three.js`, `web-ifc`) when upgrading.
- If an API seems missing, check the local [migration.md](.agent/ThatOpen_docs/migration.md) guide.