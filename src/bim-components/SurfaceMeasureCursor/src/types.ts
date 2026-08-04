import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";

/**
 * One confirmed surface measurement.
 *
 * Nothing here persists — measurements die with the viewport, as the Length and
 * Area tools' do.
 */
export interface SurfaceMeasurement {
  id: string;
  /** Ordered world-space vertices of the face's outer boundary. */
  polygon: THREE.Vector3[];
  /**
   * Interior rings (openings) subtracted from {@link area}. Normally empty; a
   * wall face containing a window contributes one ring per opening.
   */
  holes: THREE.Vector3[][];
  /** Net area in m² — outer boundary minus every hole. */
  area: number;
  /** Per-edge lengths of the outer boundary, in metres. */
  edgeLengths: number[];
  /** Every Three.js object drawn for this measurement (border lines + labels). */
  objects: THREE.Object3D[];
  /** The subset of `objects` that are CSS2D labels, kept for DOM cleanup. */
  labelObjects: CSS2DObject[];
  visible: boolean;
}
