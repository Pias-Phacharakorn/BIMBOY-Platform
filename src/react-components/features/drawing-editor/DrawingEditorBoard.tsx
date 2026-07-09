import { useEffect, useReducer, useRef, useState } from "react";
import * as OBC from "@thatopen/components";
import * as BUI from "@thatopen/ui";
import { MousePointer2, Ruler, Triangle, MessageSquare, Eraser } from "lucide-react";
import { DrawingEditorSetup, type DrawingToolKey } from "@/bim-components";
import { useBimStore } from "@/react-components/store/bimStore";

function downloadDxf(dxf: string, filename: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([dxf], { type: "application/dxf" }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

const TOOL_BUTTONS: { key: DrawingToolKey; label: string; Icon: typeof Ruler }[] = [
  { key: null, label: "Select", Icon: MousePointer2 },
  { key: "linear", label: "Linear Dimension", Icon: Ruler },
  { key: "angle", label: "Angle Dimension", Icon: Triangle },
  { key: "callout", label: "Callout", Icon: MessageSquare },
];

/**
 * Paper-space pane for the "Drawing Editor" tab: a SheetBoard hosting one
 * PaperSpace sheet with the drawing's floor-plan viewport. Handles
 * paper-space edit-mode switching, click-to-place forwarding, Escape/Delete,
 * and DXF export downloads — mirrors the ThatOpen DrawingEditor tutorial.
 */
export function DrawingEditorBoard() {
  const { components, world } = useBimStore();
  const [, forceRender] = useReducer((n: number) => n + 1, 0);
  const [paperEditMode, setPaperEditMode] = useState(false);

  const boardRef = useRef<any>(null);
  const paperRef = useRef<any>(null);
  const sheetSetUpRef = useRef(false);
  const registeredViewportRef = useRef<{ drawingId: string; viewportId: string } | null>(null);
  const activeVpElRef = useRef<HTMLElement | null>(null);
  const paperEditModeRef = useRef(paperEditMode);
  paperEditModeRef.current = paperEditMode;

  const des = components ? components.get(DrawingEditorSetup) : null;

  useEffect(() => {
    if (!des) return;
    const handleChanged = () => {
      forceRender();
      // Projection/annotation edits mutate the drawing's Three.js content directly —
      // the SheetBoard needs an explicit repaint, a React re-render alone won't do it.
      boardRef.current?.requestRender();
    };
    des.onChanged.add(handleChanged);
    return () => des.onChanged.remove(handleChanged);
  }, [des]);

  // One-time sheet setup: components binding + title block, independent of which level is active.
  useEffect(() => {
    const board = boardRef.current;
    const paper = paperRef.current;
    if (!components || !board || !paper || sheetSetUpRef.current) return;

    board.components = components;
    paper.sheetNumber = "A-01";
    paper.titleBlockTemplate = (mm: (v: number) => string, drawingArea: unknown) =>
      BUI.html`<div style="width:100%;height:100%;border:${mm(0.7)} solid #222;overflow:hidden;">${drawingArea}</div>`;
    sheetSetUpRef.current = true;
  }, [components]);

  const exitPaperMode = () => {
    if (!des?.editor) return;
    des.editor.cancel();
    if (activeVpElRef.current) {
      des.editor.clearSource(activeVpElRef.current);
      activeVpElRef.current = null;
    }
    if (world) des.editor.setSource(world);
    boardRef.current?.exitEditMode();
    boardRef.current?.requestRender();
    setPaperEditMode(false);
  };

  // Swap the sheet's registered viewport whenever the active level's drawing changes —
  // one SheetBoard sheet stays mounted, only its content changes (per CONTEXT.md).
  useEffect(() => {
    const board = boardRef.current;
    const paper = paperRef.current;
    const drawingId = des?.drawing?.uuid ?? null;
    const viewportId = des?.viewportId ?? null;
    if (!board || !paper || !drawingId || !viewportId) return;

    const prev = registeredViewportRef.current;
    if (prev?.drawingId === drawingId && prev?.viewportId === viewportId) return;

    if (paperEditModeRef.current) exitPaperMode();
    if (prev) board.removeViewport(paper, prev.drawingId, prev.viewportId);
    board.addViewport(paper, drawingId, viewportId, { x: 30, y: 20 });
    registeredViewportRef.current = { drawingId, viewportId };
    board.requestRender();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [des?.drawing, des?.viewportId]);

  // Board interaction: enter/exit paper-space edit mode, forward clicks, DXF export downloads.
  useEffect(() => {
    const board = boardRef.current;
    if (!board || !des) return;

    const handleViewportActivate = (e: Event) => {
      const { drawingId, viewportId } = (e as CustomEvent<{ drawingId: string; viewportId: string }>).detail;
      if (!components || !des.editor) return;
      const td = components.get(OBC.TechnicalDrawings);
      const d = td.list.get(drawingId);
      const vp = d?.viewports.get(viewportId);
      if (!d || !vp) return;

      if (paperEditModeRef.current) exitPaperMode();

      des.editor.activeDrawing = d;
      const vpEl = board.getViewportElement(drawingId, viewportId);
      activeVpElRef.current = vpEl;
      if (vpEl) des.editor.setSource(vpEl, vp);
      board.enterEditMode(drawingId, viewportId);
      setPaperEditMode(true);
    };

    const handleBoardClick = () => {
      if (paperEditModeRef.current && des.editor?.activeDrawing) {
        des.editor.step();
        board.requestRender();
      }
    };

    const handleViewportDxfExport = (e: Event) => {
      const { drawingId, viewportId, dxf } = (e as CustomEvent<{ drawingId: string; viewportId: string; dxf: string }>).detail;
      const name = components?.get(OBC.TechnicalDrawings).list.get(drawingId)?.viewports.get(viewportId)?.name ?? viewportId;
      downloadDxf(dxf, `${name}.dxf`);
    };

    const handlePaperDxfExport = (e: Event) => {
      const { paper, dxf } = (e as CustomEvent<{ paper: any; dxf: string }>).detail;
      downloadDxf(dxf, `${paper.getAttribute("label") || "drawing"}.dxf`);
    };

    board.addEventListener("viewportactivate", handleViewportActivate);
    board.addEventListener("click", handleBoardClick);
    board.addEventListener("viewportdxfexport", handleViewportDxfExport);
    board.addEventListener("paperdxfexport", handlePaperDxfExport);
    return () => {
      board.removeEventListener("viewportactivate", handleViewportActivate);
      board.removeEventListener("click", handleBoardClick);
      board.removeEventListener("viewportdxfexport", handleViewportDxfExport);
      board.removeEventListener("paperdxfexport", handlePaperDxfExport);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [des, components, world]);

  // 3D canvas clicks advance the tool only when not in paper-space mode.
  useEffect(() => {
    if (!world?.renderer?.three || !des) return;
    const canvas = world.renderer.three.domElement;
    const handleCanvasClick = () => {
      if (!paperEditModeRef.current) {
        des.editor?.step();
        boardRef.current?.requestRender();
      }
    };
    canvas.addEventListener("click", handleCanvasClick);
    return () => canvas.removeEventListener("click", handleCanvasClick);
  }, [world, des]);

  // Escape cancels placement / exits paper space / deactivates the tool; Delete removes selection.
  useEffect(() => {
    if (!des) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const hasOpenMenu = !!document.body.querySelector("[data-context-dialog]");
        if (hasOpenMenu) return;

        const currentTool =
          des.activeToolKey === "linear"
            ? des.dimTool
            : des.activeToolKey === "angle"
              ? des.angleTool
              : des.activeToolKey === "callout"
                ? des.calloutTool
                : null;
        const isIdle = currentTool?.isIdle ?? true;

        if (!isIdle) {
          des.editor?.cancel();
          boardRef.current?.requestRender();
        } else if (paperEditModeRef.current) {
          exitPaperMode();
        } else if (des.activeToolKey !== null) {
          des.setActiveTool(null);
        }
      }
      if (e.key === "Delete") {
        des.editor?.delete();
        boardRef.current?.requestRender();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [des]);

  // Callout text entry via a plain prompt(), per CONTEXT.md decision.
  useEffect(() => {
    const calloutTool = des?.calloutTool;
    if (!calloutTool) return;
    const handleEnterText = ({ isEdit, currentText }: { isEdit: boolean; currentText: string }) => {
      setTimeout(() => {
        const label = isEdit ? "Edit callout text:" : "Callout text:";
        const text = window.prompt(label, currentText) ?? (isEdit ? currentText : "Label");
        calloutTool.submitText(text);
      }, 0);
    };
    calloutTool.onEnterText.add(handleEnterText);
    return () => calloutTool.onEnterText.remove(handleEnterText);
  }, [des?.calloutTool]);

  const activeTool = des?.activeToolKey ?? null;
  const clearActiveTool = () => {
    if (!des?.drawing) return;
    if (activeTool === "linear") des.dimTool?.system.clear([des.drawing]);
    if (activeTool === "angle") des.angleTool?.system.clear([des.drawing]);
    if (activeTool === "callout") des.calloutTool?.system.clear([des.drawing]);
  };

  return (
    <div className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden border border-border bg-surface">
      <div className="flex h-8 shrink-0 items-center justify-center border-b border-border bg-surface-alt">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted">Sheet View</span>
      </div>

      <div className="relative flex-1 overflow-hidden bg-[#0d0e12]">
        <bim-sheet-board ref={boardRef} style={{ width: "100%", height: "100%" }}>
          <bim-paper-space ref={paperRef} label="A-01" />
        </bim-sheet-board>

        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-accent/50 bg-surface/95 p-1.5 shadow-2xl backdrop-blur-md">
          {TOOL_BUTTONS.map(({ key, label, Icon }) => (
            <button
              key={key ?? "select"}
              type="button"
              title={label}
              disabled={!des?.drawing}
              onClick={() => des?.setActiveTool(key)}
              className={`rounded-md p-2 transition-all duration-150 ${
                activeTool === key
                  ? "bg-accent/20 text-accent shadow-inner"
                  : "text-muted hover:bg-surface-alt hover:text-fg"
              } disabled:opacity-40`}
            >
              <Icon className="h-4 w-4" strokeWidth={2} />
            </button>
          ))}
          <div className="mx-1 h-6 w-px bg-border" />
          <button
            type="button"
            title="Clear this tool's annotations"
            disabled={!activeTool}
            onClick={clearActiveTool}
            className="rounded-md p-2 text-muted transition-all hover:bg-surface-alt hover:text-fg disabled:opacity-40"
          >
            <Eraser className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}
