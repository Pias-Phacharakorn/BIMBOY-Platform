import * as THREE from "three";

let activeClipperPlanes: THREE.Plane[] = [];
let clearFn: (() => void) | null = null;
let deleteSelectedFn: (() => void) | null = null;

export function setThatOpenClipperPlanes(planes: THREE.Plane[]) {
  activeClipperPlanes = planes;
}

export function getThatOpenClipperPlanes() {
  return activeClipperPlanes;
}

export function setClearClipperPlanesFn(fn: (() => void) | null) {
  clearFn = fn;
}

export function clearAllClipperPlanes() {
  clearFn?.();
}

export function setDeleteSelectedClipperPlaneFn(fn: (() => void) | null) {
  deleteSelectedFn = fn;
}

export function deleteSelectedClipperPlane() {
  deleteSelectedFn?.();
}
