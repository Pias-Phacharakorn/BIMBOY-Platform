// @ts-nocheck
import * as THREE from "three";
import * as OBC from "@thatopen/components";

export class CursurSurface extends OBC.Component implements OBC.Disposable {
  static readonly uuid = "ef2f4721-2a62-4212-9c3f-7e8e6ab20bf9" as const;
  enabled = true;
  readonly onDisposed = new OBC.Event<string>();

  private _world: OBC.World | null = null;
  
  public readonly group: THREE.Group;
  public readonly disk: THREE.Mesh;
  public readonly border: THREE.LineLoop;
  public readonly crosshair: THREE.LineSegments;
  public readonly circleMat: THREE.MeshBasicMaterial;
  public readonly lineMat: THREE.LineBasicMaterial;

  constructor(components: OBC.Components) {
    super(components);
    components.add(CursurSurface.uuid, this);

    this.group = new THREE.Group();

    // 1. Translucent circle disk (0.8 radius)
    const circleGeo = new THREE.CircleGeometry(0.8, 32);
    this.circleMat = new THREE.MeshBasicMaterial({
      color: 0x00000,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    });
    this.disk = new THREE.Mesh(circleGeo, this.circleMat);
    this.group.add(this.disk);

    // 2. Outer circle border line
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= 64; i++) {
      const theta = (i / 64) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(theta) * 0.8, Math.sin(theta) * 0.8, 0));
    }
    const borderGeom = new THREE.BufferGeometry().setFromPoints(points);
    this.lineMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.8,
      linewidth: 2,
      depthWrite: false,
    });
    this.border = new THREE.LineLoop(borderGeom, this.lineMat);
    this.group.add(this.border);

    // 3. Inside crosshair lines (from -0.8 to 0.8)
    const crosshairGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-0.8, 0, 0),
      new THREE.Vector3(0.8, 0, 0),
      new THREE.Vector3(0, -0.8, 0),
      new THREE.Vector3(0, 0.8, 0),
    ]);
    this.crosshair = new THREE.LineSegments(crosshairGeom, this.lineMat);
    this.group.add(this.crosshair);

    this.group.raycast = () => {};
    this.group.visible = false;
  }

  /**
   * Associate the cursor with a specific world's scene.
   */
  public setWorld(world: OBC.World | null) {
    if (this._world) {
      this._world.scene.three.remove(this.group);
    }
    this._world = world;
    if (this._world) {
      this._world.scene.three.add(this.group);
    }
  }

  /**
   * Update position, rotation, and dynamic color of the cursor based on the hit point and surface normal.
   */
  public update(point: THREE.Vector3, normal: THREE.Vector3) {
    // 1. Position at intersection point with slight offset along normal to prevent Z-fighting
    this.group.position.copy(point).addScaledVector(normal, 0.01);

    // 2. Rotate to align with surface normal (look at the offset point)
    const lookAtVector = this.group.position.clone().add(normal);
    this.group.lookAt(lookAtVector);

    this.group.visible = true;
  }

  /**
   * Hide the cursor.
   */
  public hide() {
    this.group.visible = false;
  }

  /**
   * Clean up resources.
   */
  dispose() {
    this.setWorld(null);
    this.disk.geometry.dispose();
    this.circleMat.dispose();
    this.border.geometry.dispose();
    this.lineMat.dispose();
    this.crosshair.geometry.dispose();

    this.onDisposed.trigger(CursurSurface.uuid);
    this.onDisposed.reset();
  }
}

