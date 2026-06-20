// @ts-nocheck
export interface CameraVector {
  x: number;
  y: number;
  z: number;
}

export interface CameraData {
  projection: string;
  position: CameraVector;
  target: CameraVector;
  up: CameraVector;
  fov?: number;
  viewHeight?: number;
  viewWidth?: number;
}

export interface ClashData {
  id: number;
  name: string;
  type: string;
  status: string;
  date: string;
  markup: string;
  solution: string;
  image: string;
  planImage?: string;
  sectionImage?: string;
  guid?: string;
  camera?: CameraData;
  selection?: string[];
}


