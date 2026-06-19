import * as THREE from "three";
import * as OBC from "@thatopen/components";

export class Spot3DHelperManager {
  private _world: OBC.World | null = null;
  public readonly group: THREE.Group;
  public readonly disk: THREE.Mesh;
  public readonly border: THREE.LineLoop;
  public readonly crosshair: THREE.LineSegments;
  public readonly lineMat: THREE.LineBasicMaterial;
  public readonly circleMat: THREE.MeshBasicMaterial;

  constructor() {
    this.group = new THREE.Group();

    // Create circle mesh (filled disk)
    const circleGeom = new THREE.CircleGeometry(0.25, 32);
    this.circleMat = new THREE.MeshBasicMaterial({
      color: 0x24a6f1,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.disk = new THREE.Mesh(circleGeom, this.circleMat);
    this.group.add(this.disk);

    // Create outer circle border using a LineLoop
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= 64; i++) {
      const theta = (i / 64) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(theta) * 0.25, Math.sin(theta) * 0.25, 0));
    }
    const borderGeom = new THREE.BufferGeometry().setFromPoints(points);
    this.lineMat = new THREE.LineBasicMaterial({
      color: 0x0f4c81,
      linewidth: 2,
      depthWrite: false,
    });
    this.border = new THREE.LineLoop(borderGeom, this.lineMat);
    this.group.add(this.border);

    // Create crosshair lines
    const crosshairGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-0.25, 0, 0),
      new THREE.Vector3(0.25, 0, 0),
      new THREE.Vector3(0, -0.25, 0),
      new THREE.Vector3(0, 0.25, 0),
    ]);
    this.crosshair = new THREE.LineSegments(crosshairGeom, this.lineMat);
    this.group.add(this.crosshair);

    this.group.visible = false;
  }

  public setWorld(world: OBC.World | null) {
    if (this._world) {
      this._world.scene.three.remove(this.group);
    }
    this._world = world;
    if (this._world) {
      this._world.scene.three.add(this.group);
    }
  }

  public update(point: THREE.Vector3, normal: THREE.Vector3) {
    this.group.position.copy(point).addScaledVector(normal, 0.005);
    const defaultNormal = new THREE.Vector3(0, 0, 1);
    const q = new THREE.Quaternion().setFromUnitVectors(defaultNormal, normal);
    this.group.setRotationFromQuaternion(q);

    const absY = Math.abs(normal.y);
    let diskColor = 0x24a6f1;
    let lineColor = 0x0f4c81;

    if (absY > 0.85) {
      diskColor = 0x5cd65c;
      lineColor = 0x1e5e2f;
    } else if (absY < 0.15) {
      diskColor = 0xff4d4d;
      lineColor = 0x8b0000;
    }

    this.circleMat.color.setHex(diskColor);
    this.lineMat.color.setHex(lineColor);
    this.group.visible = true;
  }

  public hide() {
    this.group.visible = false;
  }

  public dispose() {
    this.setWorld(null);
    this.disk.geometry.dispose();
    this.circleMat.dispose();
    this.border.geometry.dispose();
    this.lineMat.dispose();
    this.crosshair.geometry.dispose();
  }
}
