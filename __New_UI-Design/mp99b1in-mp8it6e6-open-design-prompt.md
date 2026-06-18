# Open Design Prompt - BIM Web Application Redesign

Create a complete UX/UI redesign concept for a dark themed BIM web application called **LearnThatOpen**.

This is a professional BIM + GIS web application for a mixed construction team: BIM coordinators, site engineers, project managers, document controllers, and project admins. The app should feel like a minimal dark technical tool, but less boring than the current version. It should be clean, precise, spatial, data-rich, and built for serious engineering work. Avoid marketing-style landing pages, oversized hero sections, decorative gradients, and generic SaaS dashboards. The product should feel like a real BIM operations workspace.

The app has two main levels:

1. A **Project Selection** screen where users choose which construction project to open.
2. A full **BIM Workspace** after project selection, with a left sidebar and multiple technical work areas.

## Visual Direction

Use a dark theme as the foundation.

The style should be:

- minimal dark technical tool
- professional but not flat or boring
- dense enough for BIM work, but not cluttered
- clear hierarchy for model viewport, project data, clash data, and document status
- engineering-grade rather than marketing-grade
- inspired by tools like Autodesk Forma in the sense that users first select a project, then enter a dedicated workspace

Do not strictly keep the existing blue accent color. Feel free to choose a better accent palette. The design may still use blue/cyan if it works, but it should not look like a one-color template. Use restrained accents for active navigation, model status, clashes, document approval states, warnings, and success states.

Avoid:

- purple-heavy gradients
- decorative blobs or orbs
- landing page composition
- nested cards inside cards
- huge empty spacing
- playful consumer-app styling
- generic analytics dashboard look

Use compact panels, technical tables, clear toolbars, status chips, icon buttons, and strong viewport-first layouts.

## Screen 1: Project Selection

Design the first screen as a project browser where the user selects a BIM project before entering the workspace.

The page should include:

- dark application shell
- top header with app identity and useful actions
- search/filter area
- project cards in a responsive grid
- clear selected/hover states
- optional compact view/list toggle if useful
- new project, upload/import, and download/export actions

Each project card should keep the current information model:

- Project Name
- Project Number
- Description
- Status
- Start Date
- Finish Date
- Estimated Progress

Cards should feel more BIM/project-management specific than generic cards. Consider adding a subtle model-preview placeholder, project initials, status rail, progress bar, or metadata strip, but do not invent extra required data beyond the fields above.

The project selection screen should communicate that opening a card takes the user into the actual BIM workspace.

## Screen 2: BIM Workspace Shell

After selecting a project, show the main BIM web application.

The workspace should have:

- left sidebar with icon + text labels
- current project identity visible near the top
- sidebar items:
  - BIM Model
  - Clash Detection
  - Document Status
  - Setting
- sidebar should feel like the current app but more polished
- sidebar can support collapse/expand, but the default state should show icons with text
- main content should use a workspace layout, not a dashboard landing page
- top area should include project context, current section title, status indicators, and key actions
- design for desktop-first BIM use

The core interaction model is:

- Project Selection opens a project.
- The sidebar changes the active workspace area.
- Each workspace area has dense tools, panels, and technical data.

## BIM Model Section

Design the BIM Model section as the main technical model viewer workspace.

The existing system supports multiple BIM layout modes. The design should account for these as workspace modes or tabs:

- Models
- Queries
- Viewer
- Smart Views
- Data
- GIS
- Google Sheet
- Minimap

The main BIM Model area should include:

- large central 3D model viewport
- bottom or floating viewport toolbar with tools such as select, measure, clipping, view/camera, isolate, hide/show, transparent, focus
- top viewport toolbar for model/view controls
- active tool indicator
- optional minimap panel
- model list panel
- item properties/data panel
- query panel
- smart views panel
- data sources panel
- GIS/layers panel

Represent the current layouts visually:

Models layout:

- left column: Models List and Queries
- center: 3D viewport
- right column: Items Data and Data Sources

Queries layout:

- center: 3D viewport
- right column: Queries

Viewer layout:

- full 3D viewport only

Smart Views layout:

- center: 3D viewport
- right column: Smart Views and Queries

Data layout:

- center: 3D viewport
- right column or lower panel: Items Data and Queries

GIS layout:

- center: 3D viewport
- right column: GIS layers

The design should make these modes easy to switch without feeling like unrelated pages. Use segmented controls, toolbar tabs, or compact workspace switcher. Keep the model viewport as the hero of the screen.

## Clash Detection Section

Design Clash Detection as a data analytics page for clash review.

This section should feel more like a focused technical analytics workspace than a simple table.

Include:

- top clash analytics summary area
- total clashes
- open/unresolved clashes
- resolved/approved clashes
- severity distribution
- discipline/system breakdown if useful
- status filters
- severity filters
- clash report table
- right filter panel or inspector panel
- selected clash detail preview
- image preview area
- actions to isolate/zoom/focus clash in the model
- comments or notes area if useful
- assigned user/status workflow if useful

The existing conceptual layout is:

- top/left: Clash Dashboard
- main: Clash Report table
- right: Clash Filter panel

But redesign it so the top area works like a clash analytics header/dashboard, similar to a PowerBI-style insight area but native to this BIM app. It should not look like an embedded PowerBI report. It should feel integrated into the BIM product.

The user mentioned wanting something like a data analytics page for clash detection, with a top page sidebar/header area for analytics. Make this section more visually informative than the current implementation.

## Document Status Section

Design this as a future feature inspired by the user's existing PowerBI-style document status work.

It should include a clear concept for document tracking:

- document/drawing table
- status summary cards or compact analytics
- approval status
- revision
- responsible person
- due date
- discipline/category filters
- sync/source indicator, such as Google Sheets or document data source
- document preview or selected document detail panel if useful

This section is planned for the future, so make it credible and production-ready as a design concept without overcomplicating it.

It should feel like an operational document control workspace, not a generic file manager.

## Settings Section

Design the Setting section for project-level configuration.

Must include user permissions for the project:

- Admin
- Member

Possible settings groups:

- Project Info
- Members and Permissions
- Model/Data Sources
- Google Drive or Google Sheets connections
- Units and viewer preferences
- Theme/interface preferences

Keep this area simple and technical. It should not dominate the product.

## UX Requirements

Design for real BIM application use:

- prioritize the 3D viewport and technical data
- make tables readable in dark mode
- preserve dense information without making the UI feel cramped
- use clear active states
- use compact, recognizable icons
- use status chips/badges for project status, clash severity, document approval, and permissions
- make controls discoverable but not noisy
- avoid instructional text on the UI
- avoid filler content and fake marketing copy
- keep cards to 8px radius or less
- no nested card-heavy layout
- make all text fit cleanly in panels, cards, buttons, and tables
- desktop-first, but responsive enough for smaller screens

## Navigation Model

The app should feel like this:

1. User lands on Project Selection.
2. User chooses a project card.
3. App opens the BIM Workspace for that project.
4. User navigates with the left sidebar:
   - BIM Model
   - Clash Detection
   - Document Status
   - Setting
5. BIM Model has internal layout/workspace modes such as Models, Viewer, Queries, Smart Views, Data, GIS, Google Sheet, and Minimap.
6. Clash Detection has analytics, filtering, and clash review.
7. Document Status has document control analytics and tables.
8. Settings manages project info and permissions.

## Expected Output

Produce a detailed visual redesign concept for the full BIM web application.

Show the main screens:

- Project Selection
- BIM Workspace - BIM Model
- BIM Workspace - Clash Detection
- BIM Workspace - Document Status
- BIM Workspace - Settings

The result should be a polished, modern, dark BIM web application concept that a developer could later implement in React, ThatOpen UI, and Three.js.

Do not create a marketing homepage. The first screen must be the usable Project Selection page.
