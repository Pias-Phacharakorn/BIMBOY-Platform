# LearnThatOpen - Source Directory Structure

This document provides a comprehensive map of the **LearnThatOpen** repository, detailing the architecture, backend cloud functions, frontend assets, components, and user interface templates.

## Main Repository Overview

```text
LearnThatOpen/
├───.agent/                             # AI Agent skill bundles and state
├───functions/                          # Firebase Cloud Functions (Backend Proxy)
│   ├───src/
│   │   └───index.ts                    # Express Server proxying Drive/Sheets APIs
│   ├───package.json                    # Backend NPM dependencies (Node 22)
│   └───service-account.json            # Google Service Account Credentials
├───public/                             # Static Assets (served at site root /)
│   ├───_ClashExport/                   # Saved Clash Viewpoints exported as JSON
│   ├───assets/                         # Binary 3D models (IFC, Fragment, Gear)
│   └───resources/                      # Third-party rendering decoders & libraries
├───resources/                          # Workspace environment credentials and files
│   ├───learnthatopen-494902-c91a0c3af938.json  # Google service account private key
│   └───technical_documentation.json
├───src/                                # Frontend React & ThatOpen Application
│   ├───assets/                         # Bundled assets (SVG branding, local JSON)
│   ├───bim-components/                 # @thatopen custom components & tools
│   ├───classes/                        # Core UI state managers & data models
│   ├───firebase/                       # Client-side Firebase configurations
│   ├───react-components/               # React functional components & page layouts
│   ├───ui-templates/                   # BUI (Vanilla TS UI) templates & components
│   ├───globals.ts                      # Global constants, icons, and themes
│   ├───index.tsx                       # Frontend entry point
│   └───style.css                       # Application-wide global styling
├───.firebaserc                         # Firebase workspace alias config
├───.gitignore                          # Git excluded folder rules
├───AGENT.md                            # AI developer logs & current objectives
├───_ConsoleLog.md                      # Log of developer commands run
├───firebase.json                       # Firebase services configuration (Hosting/Functions)
├───package.json                        # Frontend NPM dependencies & build scripts
├───tsconfig.json                       # Application TypeScript configurations
├───tsconfig.node.json                  # Vite configuration TypeScript rules
└───vite.config.ts                      # Vite bundler configurations
```

---

## Detailed Directory Explanations

### 1. Backend Service (`functions/`)
Implements Firebase Cloud Functions running Node 22. It securely proxies APIs, avoiding exposing API keys or OAuth flows to the client.
* **`src/index.ts`**: The main Cloud Function using Express to handle:
  * Google Drive file uploads, listing, and streaming.
  * Google Sheets rows parsing, insertion, and synchronization.
* **`service-account.json`**: Google Cloud Service Account credentials used to securely authenticate with Google Workspace APIs.

### 2. Static Resources (`public/`)
Assets that are directly copied into the build output root without bundling.
* **`_ClashExport/`**: Historical and exported clash viewpoints stored in JSON files organized by export dates (e.g. `20251118_ViewpointExports`, `20260427_ViewpointExports`, `20260511_ViewpointExports`).
* **`assets/`**:
  * `Gear/`: Gearbox 3D models.
  * `frag/`: Fragmented BIM models (.frag).
  * `ifc/`: Standard Industrial Foundation Classes files (.ifc).
* **`resources/`**:
  * `cesium/`: Library and styling files for Cesium 3D GIS visualization.
  * `draco/`: Draco compression decoders for fast 3D geometry decoding.

### 3. Application Source (`src/`)

```text
src/
├───assets/                             # Branding and static data files
│   ├───PSM-Logo.svg                    # Company secondary logo
│   ├───Ritta-bim-center.svg            # Core branding SVG
│   ├───Ritta-logo.svg                  # Corporate primary logo
│   ├───company-logo.svg                # Fallback corporate logo
│   └───_Project/
│       └───DefaultProjects.json        # Seed projects list loaded on initial start
├───bim-components/                     # OBC (Open BIM Components) custom tools
│   ├───ClashReport/                    # Clash Detection & Analysis Tool
│   │   ├───src/
│   │   │   ├───index.ts
│   │   │   ├───parser.ts               # HTML/XML to Clash data converter
│   │   │   └───types.ts                # Clash types and definitions
│   │   └───index.ts                    # ClashReport core OBC Component
│   ├───DataEnhancer/                   # Property data binding and enhancements
│   │   ├───src/
│   │   │   ├───index.ts
│   │   │   └───types.ts
│   │   └───index.ts
│   ├───GisLayers/                      # Cesium 3D GIS mapping integration layers
│   │   ├───src/
│   │   │   ├───gis-layer-2d.ts         # 2D Map tiles and markers setup
│   │   │   ├───gis-layer-3d.ts         # 3D terrain and city models
│   │   │   └───index.ts
│   │   └───index.ts
│   ├───GoogleSheets/                   # Google Sheets syncing and import bridge
│   │   ├───src/
│   │   │   ├───index.ts
│   │   │   └───types.ts
│   │   └───index.ts
│   ├───MiniMap/                        # Interactive minimap overlay for navigation
│   │   └───index.ts                    # MiniMap OBC Component
│   ├───SmartViews/                     # Smart Filter and Selective Visibility Views
│   │   ├───src/
│   │   │   ├───index.ts
│   │   │   └───types.ts
│   │   └───index.ts
│   ├───setup/                          # Core OBC components setup orchestrator
│   │   ├───src/
│   │   │   ├───clash-report.ts         # Registers Clash Detection
│   │   │   ├───clipper.ts              # Section plane clipper setups
│   │   │   ├───create-world.ts         # 3D Canvas world initialization (OBC.SimpleWorld)
│   │   │   ├───data-enhancer.ts        # Data binding initialization
│   │   │   ├───fragments-manager.ts    # BIM fragment models manager
│   │   │   ├───highligher.ts           # Element picking and highlights manager
│   │   │   ├───ifc-loader.ts           # IFC translation parser
│   │   │   ├───index.ts                # Main setups exports
│   │   │   ├───items-finder.ts         # Query picker
│   │   │   ├───measurer.ts             # Laser and spatial distance measurer
│   │   │   ├───minimap.ts              # Minimap integration orchestrator
│   │   │   ├───smart-views.ts          # SmartView rule registry
│   │   │   └───view-cube.ts            # Orientation navigation cube logic
│   │   └───index.ts                    # Setup entry interface
│   └───index.ts                        # Master export for all custom tools
```

#### Core Classes (`src/classes/`)
Handles application-wide UI and data state outside of React.
* **`Project.ts`**: The representation structure of an active BIM project (name, IFC properties, Firestore ID, description).
* **`ProjectsManager.ts`**: Active repository and listener layer coordinating loaded projects and synchronizing changes to Cloud Firestore.

#### UI Pages and Components (`src/react-components/`)
React frontend using modern styled layout wrappers.
* **`ProjectsPage.tsx`**: Main landing dashboard displaying list of available projects.
* **`ProjectCard.tsx`**: Cards showing project summaries, metadata, and controls.
* **`ProjectDetailsPage.tsx`**: Focus page setting up the 3D Viewer canvas and tool sidebars.
* **`ThreeViewer.tsx`**: Direct wrapper around the WebGL context / Three.js canvas initializing OBC.
* **`Sidebar.tsx`**: High-level react panel managing loaded pages.
* **`SearchBox.tsx`**: Global filtered search component.

---

### 4. BUI Templates (`src/ui-templates/`)
We use **BUI (BIM User Interface)**, the official vanilla TS UI library for `@thatopen/ui`, to build dynamic components.

```text
ui-templates/
├───buttons/                            # Toolbar actionable buttons
│   ├───cloud-model-btn.ts              # Loads fragments directly from Cloud Drive
│   ├───load-button.ts                  # Local IFC/Frag model loading dialog
│   ├───viewport-settings.ts            # Configures camera projections and grids
│   └───index.ts
├───containers/                         # Flex/Grid UI panel shells
│   ├───grid-sidebar.ts                 # Outer collapsible sidebar wrapper
│   ├───viewport-toolbar.ts             # Main vertical actions panel
│   ├───viewport-top-toolbar.ts         # Top-horizontal options panel
│   ├───viewport.ts                     # Full screen container for 3D viewer canvas
│   └───index.ts
├───grids/                              # Structural layouts
│   ├───components/
│   │   ├───src/
│   │   │   ├───types.ts
│   │   │   └───index.ts
│   │   └───index.ts
│   ├───viewport.ts                     # Responsive grid layout for the 3D canvas
│   └───index.ts
├───sections/                           # Advanced widget panels in sidebar tabs
│   ├───clash-dashboard.ts              # Clash detection execution panel
│   ├───clash-filter.ts                 # Clash query filtering panel
│   ├───clash-table.ts                  # Multi-row clash items results viewer
│   ├───datasources.ts                  # Database connection panel
│   ├───gis.ts                          # Cesium GIS coordinates/settings inputs panel
│   ├───googlesheet.ts                  # Active Google Spreadsheet synchronization panel
│   ├───items-data.ts                   # Properties and metadata inspection sheet
│   ├───minimap.ts                      # Overlay Minimap toggle & size parameters panel
│   ├───models.ts                       # Loaded models checklist panel
│   ├───queries.ts                      # Custom element database query panel
│   ├───smart-views.ts                  # Selective element coloring controls panel
│   └───index.ts
├───tables/                             # Custom tabular templates built with BUI
│   ├───clash-table/
│   │   ├───src/
│   │   │   ├───dashboard.css           # Styling for clash dashboard widgets
│   │   │   ├───dashboard.ts            # Summary counters, charts, & progress indicators
│   │   │   ├───overlay.css             # Overlay models comparisons styles
│   │   │   ├───overlay.ts              # Focus highlight dialogs for clashed pairs
│   │   │   ├───set-defaults.ts         # Set initial datasets
│   │   │   ├───template.ts             # Base clash data row template
│   │   │   └───types.ts
│   │   └───index.ts
│   ├───datasources/
│   │   ├───src/
│   │   │   ├───set-defaults.ts
│   │   │   ├───template.ts
│   │   │   └───types.ts
│   │   └───index.ts
│   ├───googlesheet/
│   │   ├───src/
│   │   │   ├───set-defaults.ts
│   │   │   ├───template.ts
│   │   │   └───types.ts
│   │   └───index.ts
│   ├───queries/
│   │   ├───src/
│   │   │   ├───set-defaults.ts
│   │   │   ├───template.ts
│   │   │   └───types.ts
│   │   └───index.ts
│   └───smart-views/
│       ├───src/
│       │   ├───set-defaults.ts
│       │   ├───template.ts
│       │   └───types.ts
│       └───index.ts
└───index.ts                            # Package entry point exposing templates
```
