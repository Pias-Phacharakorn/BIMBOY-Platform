# GIS / Cesium — geospatial layers

> Status: seed — partly roadmap (AGENTS.md roadmap item 5: BIM + GIS via Cesium 3D Tiles). Expand as this area is built out.

## Overview

GIS overlays BIM models onto geospatial context. Current implementation provides 2D/3D GIS layers as OBC components (`GisLayers`) plus a React panel to toggle them. Cesium 3D Tiles integration is the forward-looking piece — capture coordinate/CRS decisions here as they're made.

## Key files

- `src/bim-components/GisLayers/src/GisLayer3d.ts` — 3D GIS layer component
- `src/bim-components/GisLayers/src/GisLayer2d.ts` — 2D GIS layer component
- `src/bim-components/GisLayers/src/GISParser.ts` — parses GIS source data
- `src/bim-components/GisLayers/index.ts` — component export/registration
- `src/react-components/features/gis/GisPanel.tsx` — layer toggle UI
- `src/react-components/features/gis/index.ts` — feature entry
- `src/bim-components/SpotCoordinate/` — coordinate spotting helpers (`Spot3DHelperManager.ts`, `SpotLabelManager.ts`)

## Patterns & conventions

- GIS layers are OBC components (extend `OBC.Component`, disposable) — same rules as `bim-viewer.md`.
- Coordinate/CRS handling: **document the chosen convention here** the first time it's decided (projection, origin offset, units) — this is the highest-value thing to capture for future work.

## Gotchas / watch-outs

- Cesium 3D Tiles integration is roadmap; verify any Cesium dep against the ThatOpen v3.4.x / Three.js ^0.182 constraint before adding.
- _(fill as encountered)_
