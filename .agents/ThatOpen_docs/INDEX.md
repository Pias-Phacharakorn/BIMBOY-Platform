# ThatOpen Docs — INDEX

**Read this file first before browsing `.agents/ThatOpen_docs/`.** It is the single navigation entry point for the local ThatOpen documentation snapshot: concept guides, tutorials, and the full TypeDoc API reference. Use it to jump straight to the right file instead of scanning the folder.

> **⚠️ CRITICAL VERSION CONSTRAINT:** All ThatOpen libraries are pinned to **v3.4.x**. Always verify peer deps (Three.js ^0.182, web-ifc) before using or upgrading any API. This snapshot matches the pinned version — do not trust memory over it.

All paths below are relative to this folder (`.agents/ThatOpen_docs/`).

## How to use this index

1. **Building a feature?** Start with the matching **Tutorial** (working TS snippets + setup).
2. **Need exact signatures** (props, methods, events, enums, types)? Go to the **API Reference** — find the symbol name in the symbol index, then open `api/@thatopen/<package>/<kind>/<Symbol>.md`.
3. **Understanding the architecture** (component lifecycle, disposal, creation)? See **Concepts**.
4. Custom `OBC.Component` authoring is covered by the **`_thatopen-bim-component`** skill, not here.
5. Project-specific wiring (how *this* app uses OBC) lives in `.claude/docs/bim-viewer.md`, not here.

---

## 🗺️ Directory map

```
.agents/ThatOpen_docs/
├── INDEX.md          # this file — start here
├── intro.md          # overview of the libraries + capabilities
├── migration.md      # version upgrade guide
├── contributing.md   # contribution guidelines
├── components/       # concept guides (getting started, creating/clean components)
├── fragments/        # fragment geometry format, custom building, schema
├── Tutorials/        # step-by-step feature implementations (.mdx, with code)
└── api/              # TypeDoc-generated API reference (per package/kind)
```

---

## 🧩 Concepts

- Overview: [intro.md](./intro.md) · Version upgrades: [migration.md](./migration.md)
- Components getting started: [components/getting-started.md](./components/getting-started.md)
- Creating custom components: [components/creating-components.md](./components/creating-components.md)
- Clean components guide: [components/clean-components-guide.md](./components/clean-components-guide.md)
- Tutorial paths: [components/tutorial-paths.md](./components/tutorial-paths.md)
- Fragments: [fragments/getting-started.md](./fragments/getting-started.md) · [fragments/custom-building.md](./fragments/custom-building.md) · [fragments/schema.md](./fragments/schema.md)

---

## 👩🏻‍🏫 Tutorials

### Core engine (`Tutorials/Components/Core/`)
Worlds · IfcLoader · FragmentsManager · Clipper · Classifier · BCFTopics · EdgeProjector · OrthoPerspectiveCamera · Raycasters · Hider · Grids · BoundingBoxer · IDSSpecifications · ItemsFinder · ShadowedScene · Viewpoints · Views
→ path: `Tutorials/Components/Core/<Name>.mdx` (e.g. [Worlds.mdx](./Tutorials/Components/Core/Worlds.mdx), [Clipper.mdx](./Tutorials/Components/Core/Clipper.mdx), [Views.mdx](./Tutorials/Components/Core/Views.mdx))

#### Technical drawings (`Tutorials/Components/Core/TechnicalDrawings/`)
TechnicalDrawings · AnnotationStyles · AnnotationSystems · CustomAnnotationSystems · DrawingBlocks · DrawingLayers · ModelDrivenAnnotations · MultiDrawingViewports
→ path: `Tutorials/Components/Core/TechnicalDrawings/<Name>.mdx`

### Front / interactive tools (`Tutorials/Components/Front/`)
Highlighter · Hoverer · Outliner · ClipStyler · PostproductionRenderer · Marker · DrawingEditor · CivilNavigators · AngleMeasurement · AreaMeasurement · LengthMeasurement · VolumeMeasurement
→ path: `Tutorials/Components/Front/<Name>.mdx`

### Fragments (`Tutorials/Fragments/Fragments/`)
- Models: FragmentsModels · BuildingConfigurator · EditApi · EditElements · EditProperties · Materials · ModelInformation · Raycasting · Rebars · SteelDetailing · VisibilityOperations → path: `Tutorials/Fragments/Fragments/FragmentsModels/<Name>.mdx`
- IFC importer: IfcImporter · HelloWorldSchema → path: `Tutorials/Fragments/Fragments/IfcImporter/<Name>.mdx`

### User interface / BUI (`Tutorials/UserInterface/`)
- Core: Component · Chart · PaperSpace → `Tutorials/UserInterface/Core/<Name>.mdx`
- Table: Table · DataTransform · ExportingData · Grouping · LoadFunction · Searching → `Tutorials/UserInterface/Core/Table/<Name>.mdx`
- OBC-bound widgets: ModelsList · ItemsData · Attributes · Categories · SpatialTree · IDS · Topics · TopicsUI · SheetBoard · ViewCube → `Tutorials/UserInterface/OBC/<Name>.mdx`

> ⚠️ BUI (`<bim-*>`) tutorials show shadow-DOM web components. In this project they are allowed **only** inside `src/react-components/components/bim/ViewportWrapper.tsx` — do not copy BUI layouts into other React components (see `CLAUDE.md` Hard Constraints).

---

## 📋 API Reference (TypeDoc)

Path pattern: **`api/@thatopen/<package>/<kind>/<Symbol>.md`**
Packages: `components` (core OBC) · `components-front` (interactive UI/rendering) · `fragments` (low-level model/geometry) · `ui` (base BUI) · `ui-obc` (OBC-bound BUI).
Kinds: `classes`, `interfaces`, `enumerations`, `functions`, `type-aliases`, `variables`.

Find a symbol below, then open `api/@thatopen/<package>/<kind>/<Symbol>.md`.

### @thatopen/components

**classes** (`api/@thatopen/components/classes/`): AngleAnnotations, AnnotationSystem, AsyncEvent, BCFTopics, Base, BaseCamera, BaseRenderer, BaseScene, BaseWorldItem, BlockAnnotations, BoundingBoxer, CalloutAnnotations, Classifier, Clipper, Comment, Component, Components, ConfigManager, DataMap, DataSet, Disposer, DrawingAnnotations, DrawingLayers, DrawingViewport, DrawingViewportHelper, DrawingViewports, DxfExporter, DxfManager, EdgeProjector, Event, EventManager, FastModelPicker, FastModelPickers, FinderQuery, FirstPersonMode, FragmentsManager, Grids, Hider, IDSSpecification, IDSSpecifications, IfcFragmentSettings, IfcLoader, ItemsFinder, LeaderAnnotations, LinearAnnotations, MeasurementUtils, ModelIdMapUtils, Mouse, OrbitMode, OrthoPerspectiveCamera, PlanMode, ProjectionManager, Raycasters, ShadowedScene, SimpleCamera, SimpleGrid, SimplePlane, SimpleRaycaster, SimpleRenderer, SimpleScene, SimpleWorld, SlopeAnnotations, TechnicalDrawing, TechnicalDrawingHelper, TechnicalDrawings, VertexPicker, Viewpoint, Views, Worlds

**interfaces** (`api/@thatopen/components/interfaces/`): AddClassificationConfig, AnnotationEntry, AxisGizmoLike, BCFTopicsConfig, BCFViewpoint, BaseAnnotationStyle, BlockDefinition, BlockInsertion, BlockStyle, CalloutAnnotation, CalloutAnnotationStyle, CameraControllable, ClassificationGroupData, ClassificationGroupQuery, ClassifyItemRelationsConfig, Configurable, CreateElevationViewsConfig, CreateViewConfig, CreateViewFromIfcStoreysConfig, Createable, DimensionUnit, Disposable, DrawingIntersection, DrawingLayer, DrawingSystemDescriptor, DrawingViewportConfig, DxfDrawingEntry, DxfPaperOptions, DxfTextOptions, DxfViewportEntry, DxfWriteContext, EdgeProjectionResult, Eventable, Hideable, LeaderAnnotation, LeaderAnnotationStyle, LinearAnnotation, LinearAnnotationStyle, MeasureEdge, NavigationMode, Progress, QueryTestConfig, RemoveClassifierItemsConfig, Resizeable, SerializedFinderQuery, SerializedQueryParameters, ShadowedSceneConfig, SimpleGridConfig, SimpleSceneConfig, SlopeAnnotation, SlopeAnnotationStyle, Transitionable, Updateable, VertexPickerConfig, ViewpointBitmap, ViewpointCamera, ViewpointClippingPlane, ViewpointColoring, ViewpointComponent, ViewpointComponents, ViewpointLine, ViewpointSnapshot, ViewpointVector, ViewpointVisibility, WithUi, World

**enumerations** (`api/@thatopen/components/enumerations/`): RendererMode

**functions** (`api/@thatopen/components/functions/`): ArrowTick, DiagonalTick, DotTick, FilledArrowTick, FilledCircleTick, FilledSquareTick, NoTick, OpenArrowTick, angleDimensionMachine, buildAnglePositions, buildAnglePreviewPositions, buildCalloutPositions, buildCalloutPreviewPositions, buildDimensionPositions, buildDimensions, buildLeaderPositions, buildLeaderPreviewPositions, buildPreviewPositions, buildSlopePositions, calloutAnnotationMachine, computeAlignmentMatrix, computeAngle, computeBisectorAngle, computeOffset, formatSlope, getAngleTickEndpoints, getDimensionTickEndpoints, getSlopeTip, leaderAnnotationMachine, linearDimensionMachine

**type-aliases** (`api/@thatopen/components/type-aliases/`): AngleAnnotationData, BlockInsertionData, CalloutAnnotationData, CameraProjection, ClassifierIntersectionInput, EnclosureBuilder, IDSCheckResult, LeaderAnnotationData, LineTickBuilder, LinearAnnotationData, MeshTickBuilder, ModelIdMap, NavModeID, QueryResultAggregation, SlopeAnnotationData, SlopeFormat, ViewpointOrthogonalCamera, ViewpointPerspectiveCamera

**variables** (`api/@thatopen/components/variables/`): CircleEnclosure, CloudEnclosure, RectEnclosure, Units

### @thatopen/components-front

**classes** (`api/@thatopen/components-front/classes/`): Angle, AngleMeasurement, AreaMeasurement, CivilCrossSectionNavigator, CivilNavigators, CivilRaycaster, ClipEdges, ClipStyler, DimensionLine, DrawingEditor, DrawingTool, FontManager, GlossPass, GraphicVertexPicker, Highlighter, Hoverer, LengthMeasurement, Mark, Marker, Measurement, Mesher, Outliner, PostproductionRenderer, RendererWith2D, VolumeMeasurement

**interfaces** (`api/@thatopen/components-front/interfaces/`): ClipEdgesCreationConfig, ClipEdgesItemStyle, ClipStyle, DimensionData, DrawingPointerEvent, HighlightEvents, HighlighterConfig, IGroupedMarkers, IMarker, LinearPlacementContext, PlacementMode

**enumerations** (`api/@thatopen/components-front/enumerations/`): EdgeDetectionPassMode

**functions** (`api/@thatopen/components-front/functions/`): dist2D

**type-aliases** (`api/@thatopen/components-front/type-aliases/`): DrawingCursor

**variables** (`api/@thatopen/components-front/variables/`): IndividualMode, LineMode, SequentialMode

### @thatopen/fragments

**classes** (`api/@thatopen/fragments/classes/`): Editor, FragmentsModel, FragmentsModels, GeometryEngine, IfcImporter, LoadAbortedError, SingleThreadedFragmentsModel

**interfaces** (`api/@thatopen/fragments/interfaces/`): AggregateMap, Attributes, BaseCreateRequest, BaseEditRequest, BaseUpdateRequest, CRSData, CreateGlobalTransformRequest, CreateItemRequest, CreateLocalTransformRequest, CreateMaterialRequest, CreateRelationRequest, CreateRepresentationRequest, CreateSampleRequest, DeleteGlobalTransformRequest, DeleteItemRequest, DeleteLocalTransformRequest, DeleteMaterialRequest, DeleteRelationRequest, DeleteRepresentationRequest, DeleteSampleRequest, GroupData, IfcSplitterDeps, IfcSplitterFs, IfcSplitterPath, ItemAttribute, ItemData, ItemsDataConfig, MappedInformationResult, MappedResultInput, MappedSelectionInput, ModelIdMap, RaycastData, RaycastResult, RectangleRaycastData, RectangleRaycastResult, RelsModifyChange, SpatialTreeItem, StyleMaps, UpdateGlobalTransformRequest, UpdateItemRequest, UpdateLocalTransformRequest, UpdateMaterialRequest, UpdateMaxLocalIdRequest, UpdateMetadataRequest, UpdateRelationRequest, UpdateRepresentationRequest, UpdateSampleRequest, UpdateSpatialStructureRequest, VirtualModelConfig, VirtualPropertiesConfig, VoidFillMap

**enumerations** (`api/@thatopen/fragments/enumerations/`): CurrentLod, EditRequestType, ItemConfigClass, LodMode, SnappingClass

**functions** (`api/@thatopen/fragments/functions/`): extract, getObject, split, toClassicWorker

**type-aliases** (`api/@thatopen/fragments/type-aliases/`): AttributeData, AttrsChange, BIMMaterial, BIMMesh, CreateRequest, DataBuffer, DeleteRequest, EditRequest, ElementData, Identifier, InformationResultType, ItemInformationType, ItemSelectionType, LoadProgressEvent, MaterialDefinition, MeshData, NewElementData, RawCircleExtrusion, RawGlobalTransformData, RawItemData, RawMaterial, RawMetadataData, RawRelationData, RawRepresentation, RawSample, RawShell, RawTransformData, RelsChange, ResultInputType, SelectionInputType, UpdateRequest

**variables** (`api/@thatopen/fragments/variables/`): EditRequestTypeNames, geometryTypes, ifcCategoryMap, limitOf2Bytes

### @thatopen/ui

**classes** (`api/@thatopen/ui/classes/`): Button, Chart, ChartLegend, Checkbox, ColorInput, Component, Dropdown, Grid, Icon, Input, Label, Manager, NumberInput, Option, Panel, PanelSection, Selector, Slider, Tab, Table, Tabs, TextInput, Toolbar, ToolbarGroup, ToolbarSection, Tooltip, Viewport

**interfaces** (`api/@thatopen/ui/interfaces/`): CellCreatedEventDetail, ColumnData, ComponentUtils, DataClickDetail, EntryQuery, HasName, HasValue, ManagerConfig, QueryGroup, RowCreatedEventDetail, RowDeselectedEventDetail, RowSelectedEventDetail, TableGroupData, TableGroupTemplate

**functions** (`api/@thatopen/ui/functions/`): calculateDividerStyles, calculateHorizontalResize, calculateVerticalResize, deduplicateDividerAreas, detectDividers, extractUniqueAreas, getElementValue, parseGridTemplate, validateHorizontalResize, validateVerticalResize

**type-aliases** (`api/@thatopen/ui/type-aliases/`): ChartDataSet, ChartInputData, ChartInputValues, ChartLoadFunction, ConditionFunctions, GeneralInputData, GridLayoutsDefinition, LabelData, LabelEventData, LineFillType, LinePointStyleType, Query, QueryCondition, QueryOperators, ScatterInputData, StatefullComponent, StatelessComponent, TableDataTransform, TableGroupingTransform, TableRowData, TableRowTemplate, Types

### @thatopen/ui-obc

**classes** (`api/@thatopen/ui-obc/classes/`): Manager, SheetBoard, ViewCube, World, World2D

**interfaces** (`api/@thatopen/ui-obc/interfaces/`): ItemsDataState, LoadFragState, LoadIfcState, TopicFormUI

---

_This index is a static snapshot for ThatOpen **v3.4.x**. If the vendored docs under `api/` are refreshed, regenerate the symbol lists (they mirror the filenames under each `api/@thatopen/<package>/<kind>/` folder)._
