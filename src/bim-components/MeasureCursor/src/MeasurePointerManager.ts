import * as OBC from "@thatopen/components";

/**
 * Screen-space slop, in px, below which a pointerdown→pointerup pair counts as a click rather
 * than a camera drag. Clicking is what commits a measurement point, so orbiting the model must
 * not commit one.
 */
const CLICK_SLOP = 4;

/**
 * Delete and Backspace also mean "delete a character". The keydown listener is on `window` —
 * not the canvas — so a measurement can be deleted without the canvas being focused, which is
 * exactly what makes this guard necessary: the panels' search and filter inputs stay reachable
 * while a measure tool is on.
 *
 * Note this reads the *retargeted* event target, so an input inside a BUI shadow root reports
 * its host element instead. The inputs this protects (models list, property table) are plain
 * React, so they report as `INPUT`.
 */
const isTextEntry = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA"
  );
};

export interface MeasurePointerManagerOptions {
  /** A pointerup that stayed within {@link CLICK_SLOP} of its pointerdown. */
  onClick(): void;
  /** A keydown that did not land in a text input. */
  onKeyDown(event: KeyboardEvent): void;
}

/**
 * Turns raw pointer and keyboard events into the two things a measure tool acts on: a click
 * that is not a camera drag, and a keypress that is not someone typing.
 */
export class MeasurePointerManager {
  private readonly _options: MeasurePointerManagerOptions;

  private _canvas: HTMLCanvasElement | null = null;
  private _startX = 0;
  private _startY = 0;

  constructor(options: MeasurePointerManagerOptions) {
    this._options = options;
  }

  attach(world: OBC.World) {
    this._canvas = world.renderer?.three?.domElement ?? null;
    this._canvas?.addEventListener("pointerdown", this._onPointerDown);
    this._canvas?.addEventListener("pointerup", this._onPointerUp);
    window.addEventListener("keydown", this._onKeyDown);
  }

  detach() {
    this._canvas?.removeEventListener("pointerdown", this._onPointerDown);
    this._canvas?.removeEventListener("pointerup", this._onPointerUp);
    this._canvas = null;
    window.removeEventListener("keydown", this._onKeyDown);
  }

  private _onPointerDown = (event: PointerEvent) => {
    this._startX = event.clientX;
    this._startY = event.clientY;
  };

  private _onPointerUp = (event: PointerEvent) => {
    const movedX = Math.abs(event.clientX - this._startX);
    const movedY = Math.abs(event.clientY - this._startY);
    if (movedX < CLICK_SLOP && movedY < CLICK_SLOP) {
      this._options.onClick();
    }
  };

  private _onKeyDown = (event: KeyboardEvent) => {
    if (isTextEntry(event.target)) return;
    this._options.onKeyDown(event);
  };
}
