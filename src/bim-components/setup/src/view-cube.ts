// @ts-nocheck
import * as THREE from "three";
import * as OBC from "@thatopen/components";
import { useBimStore } from "../../../react-components/store/bimStore";

export const setupViewCube = (world: any, viewport: any, components?: OBC.Components) => {
  const viewCube = document.createElement("bim-view-cube") as any;

  // Custom high-performance updateOrientation override to bypass LitElement's reactive style tag updates
  const originalUpdate = viewCube.updateOrientation.bind(viewCube);
  viewCube.updateOrientation = () => {
    if (!viewCube.camera) return;

    const root = viewCube.shadowRoot;
    const cube = root?.querySelector(".cube") as HTMLElement;

    if (!cube) {
      // Fallback to the original LitElement update if the DOM is not ready
      originalUpdate();
      return;
    }

    viewCube._matrix.extractRotation(viewCube.camera.matrixWorldInverse);

    const alignAngle = useBimStore.getState().alignAngle || 0;
    if (alignAngle !== 0) {
      const offsetMatrix = new THREE.Matrix4().makeRotationY(alignAngle);
      viewCube._matrix.multiply(offsetMatrix);
    }

    const { elements: t } = viewCube._matrix;

    const matrixStr = `matrix3d(
      ${viewCube._epsilon(t[0])},
      ${viewCube._epsilon(-t[1])},
      ${viewCube._epsilon(t[2])},
      ${viewCube._epsilon(t[3])},
      ${viewCube._epsilon(t[4])},
      ${viewCube._epsilon(-t[5])},
      ${viewCube._epsilon(t[6])},
      ${viewCube._epsilon(t[7])},
      ${viewCube._epsilon(t[8])},
      ${viewCube._epsilon(-t[9])},
      ${viewCube._epsilon(t[10])},
      ${viewCube._epsilon(t[11])},
      ${viewCube._epsilon(t[12])},
      ${viewCube._epsilon(-t[13])},
      ${viewCube._epsilon(t[14])},
      ${viewCube._epsilon(t[15])}
    )`;

    cube.style.transform = `translateZ(-300px) ${matrixStr}`;
  };

  viewCube.camera = world.camera.three;

  // Set explicit labels for all faces
  viewCube.topText = "Top";
  viewCube.bottomText = "Bottom";
  viewCube.frontText = "Front";
  viewCube.backText = "Back";
  viewCube.leftText = "Left";
  viewCube.rightText = "Right";

  viewport.append(viewCube);

  let disposed = false;
  let updateRequested = false;

  const updateOrientation = () => {
    if (updateRequested) return;
    updateRequested = true;

    requestAnimationFrame(() => {
      updateRequested = false;
      if (disposed) return;

      // Ensure the ViewCube tracks the currently active camera
      // (fixes issue when switching between Perspective and Orthographic)
      if (viewCube.camera !== world.camera.three) {
        viewCube.camera = world.camera.three;
      }

      if (viewCube && typeof viewCube.updateOrientation === "function") {
        viewCube.updateOrientation();
      }
    });
  };

  // Keep the view cube updated as the user orbits the camera
  world.camera.controls.addEventListener("update", updateOrientation);

  const controls = world.camera.controls;

  // Unified click listener for faces, edges, and corners
  viewCube.addEventListener("click", (e: any) => {
    const path = e.composedPath();
    let clickedFace: string | null = null;

    for (const element of path) {
      if (element.className && typeof element.className === "string") {
        const cls = element.className;
        
        // Corners
        if (cls.includes("corner-top-front-right")) clickedFace = "top-front-right";
        else if (cls.includes("corner-top-front-left")) clickedFace = "top-front-left";
        else if (cls.includes("corner-top-back-right")) clickedFace = "top-back-right";
        else if (cls.includes("corner-top-back-left")) clickedFace = "top-back-left";
        else if (cls.includes("corner-bottom-front-right")) clickedFace = "bottom-front-right";
        else if (cls.includes("corner-bottom-front-left")) clickedFace = "bottom-front-left";
        else if (cls.includes("corner-bottom-back-right")) clickedFace = "bottom-back-right";
        else if (cls.includes("corner-bottom-back-left")) clickedFace = "bottom-back-left";
        
        // Edges
        else if (cls.includes("edge-top-front")) clickedFace = "top-front";
        else if (cls.includes("edge-top-back")) clickedFace = "top-back";
        else if (cls.includes("edge-top-left")) clickedFace = "top-left";
        else if (cls.includes("edge-top-right")) clickedFace = "top-right";
        else if (cls.includes("edge-bottom-front")) clickedFace = "bottom-front";
        else if (cls.includes("edge-bottom-back")) clickedFace = "bottom-back";
        else if (cls.includes("edge-bottom-left")) clickedFace = "bottom-left";
        else if (cls.includes("edge-bottom-right")) clickedFace = "bottom-right";
        else if (cls.includes("edge-front-left")) clickedFace = "front-left";
        else if (cls.includes("edge-front-right")) clickedFace = "front-right";
        else if (cls.includes("edge-back-left")) clickedFace = "back-left";
        else if (cls.includes("edge-back-right")) clickedFace = "back-right";

        // Faces
        else if (cls.includes("face-front")) clickedFace = "front";
        else if (cls.includes("face-back")) clickedFace = "back";
        else if (cls.includes("face-left")) clickedFace = "left";
        else if (cls.includes("face-right")) clickedFace = "right";
        else if (cls.includes("face-top")) clickedFace = "top";
        else if (cls.includes("face-bottom")) clickedFace = "bottom";

        if (clickedFace) break;
      }
    }

    if (!clickedFace) return;

    // Calculate generic direction vector
    const direction = new THREE.Vector3();
    if (clickedFace.includes("top")) direction.y = 1;
    if (clickedFace.includes("bottom")) direction.y = -1;
    if (clickedFace.includes("front")) direction.z = 1;
    if (clickedFace.includes("back")) direction.z = -1;
    if (clickedFace.includes("right")) direction.x = 1;
    if (clickedFace.includes("left")) direction.x = -1;

    direction.normalize();

    // Rotate camera view direction by current alignment angle around gravity (Y-axis)
    const alignAngle = useBimStore.getState().alignAngle || 0;
    if (alignAngle !== 0) {
      direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), alignAngle);
    }

    // Prevent gimbal lock / camera flipping on top/bottom views
    if (direction.x === 0 && direction.z === 0) {
      direction.z = 0.001; // Tiny offset to keep up vector math stable in camera-controls
      direction.normalize();
    }

    // Normalize rotations first so we can read the correct, normalized camera azimuthAngle
    controls.normalizeRotations();

    // Adjust target direction near the theta boundary (negative Z-axis / Back direction)
    // to prevent the camera from spinning 360-degrees on the PI / -PI boundary.
    const currentAzimuth = controls.azimuthAngle;
    const targetTheta = Math.atan2(direction.x, direction.z);
    if (Math.abs(Math.abs(targetTheta) - Math.PI) < 0.05) {
      const sign = currentAzimuth < 0 ? -1 : 1;
      direction.x = sign * 0.0001;
      direction.normalize();
    }

    const target = new THREE.Vector3();
    let distance = 20;

    const boxer = components?.get(OBC.BoundingBoxer);
    const fragments = components?.get(OBC.FragmentsManager);

    if (boxer && fragments && fragments.list.size > 0) {
      // Calculate target at center of loaded models and distance based on model size
      boxer.list.clear();
      boxer.addFromModels();
      const box = boxer.get();
      boxer.list.clear();

      box.getCenter(target);

      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      distance = maxDim * 1.5;
    } else {
      // Fallback: orbit around current camera target and keep current zoom distance
      const position = new THREE.Vector3();
      controls.getTarget(target);
      controls.getPosition(position);
      distance = position.distanceTo(target);
      if (distance < 1) distance = 20;
    }

    controls.setLookAt(
      target.x + direction.x * distance,
      target.y + direction.y * distance,
      target.z + direction.z * distance,
      target.x,
      target.y,
      target.z,
      true // Enable smooth transition
    );
  });

  // Inject 3D corners and edges into the ViewCube's shadow DOM
  const augmentViewCube = async () => {
    let attempts = 0;
    while (attempts < 20) {
      if (disposed) return;
      if (viewCube.shadowRoot && viewCube.shadowRoot.querySelector(".cube")) break;
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    if (disposed) return;

    const root = viewCube.shadowRoot;
    if (!root) return;

    const cube = root.querySelector(".cube") as HTMLElement;
    if (!cube) return;

    // Avoid double augmenting
    if (cube.querySelector(".corner-top-front-right")) return;

    let size = 120; // Default ViewCube size
    const frontFace = cube.querySelector(".face-front") as HTMLElement;
    if (frontFace && frontFace.offsetWidth > 0) {
      size = frontFace.offsetWidth;
    }

    const half = size / 2;
    const cornerSize = 18;
    const edgeThickness = 10;
    const edgeLength = size - cornerSize;

    // Add CSS for interactive elements
    const style = document.createElement("style");
    style.textContent = `
      .cube-interactive {
        position: absolute;
        left: 50%;
        top: 50%;
        transform-style: preserve-3d;
        cursor: pointer;
      }
      .cube-interactive .box-face {
        position: absolute;
        border: 1px solid rgba(255,255,255,0.5);
        box-sizing: border-box;
        transition: background-color 0.2s;
      }
      .cube-corner .box-face { background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); }
      .cube-corner:hover .box-face { background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%); }
      .cube-edge .box-face { background: linear-gradient(135deg, #3b82f6 0%, #0ea5e9 100%); }
      .cube-edge:hover .box-face { background: linear-gradient(135deg, #60a5fa 0%, #22d3ee 100%); }
    `;
    root.appendChild(style);

    const createBox = (cls: string, w: number, h: number, d: number, x: number, y: number, z: number, type: "corner" | "edge") => {
      const wrapper = document.createElement("div");
      wrapper.className = `cube-interactive ${cls} ${type === "corner" ? "cube-corner" : "cube-edge"}`;
      wrapper.style.width = `${w}px`;
      wrapper.style.height = `${h}px`;
      wrapper.style.transform = `translate3d(${x}px, ${y}px, ${z}px) translate3d(-50%, -50%, 0)`;
      
      const faces = [
        { name: "front",  w: w, h: h, tx: 0, ty: 0, tz: d/2, rx: 0, ry: 0 },
        { name: "back",   w: w, h: h, tx: 0, ty: 0, tz: -d/2, rx: 0, ry: 180 },
        { name: "right",  w: d, h: h, tx: w/2, ty: 0, tz: 0, rx: 0, ry: 90 },
        { name: "left",   w: d, h: h, tx: -w/2, ty: 0, tz: 0, rx: 0, ry: -90 },
        { name: "top",    w: w, h: d, tx: 0, ty: -h/2, tz: 0, rx: 90, ry: 0 },
        { name: "bottom", w: w, h: d, tx: 0, ty: h/2, tz: 0, rx: -90, ry: 0 },
      ];

      faces.forEach(f => {
        const face = document.createElement("div");
        face.className = "box-face";
        face.style.width = `${f.w}px`;
        face.style.height = `${f.h}px`;
        face.style.marginLeft = `${-f.w/2}px`;
        face.style.marginTop = `${-f.h/2}px`;
        face.style.left = "50%";
        face.style.top = "50%";
        face.style.transform = `translate3d(${f.tx}px, ${f.ty}px, ${f.tz}px) rotateX(${f.rx}deg) rotateY(${f.ry}deg)`;
        wrapper.appendChild(face);
      });

      cube.appendChild(wrapper);
    };

    const cS = cornerSize;
    // Corners (Y = +half and -half)
    createBox("corner-top-front-right", cS, cS, cS, half, half, half, "corner");
    createBox("corner-top-front-left", cS, cS, cS, -half, half, half, "corner");
    createBox("corner-top-back-right", cS, cS, cS, half, half, -half, "corner");
    createBox("corner-top-back-left", cS, cS, cS, -half, half, -half, "corner");
    
    createBox("corner-bottom-front-right", cS, cS, cS, half, -half, half, "corner");
    createBox("corner-bottom-front-left", cS, cS, cS, -half, -half, half, "corner");
    createBox("corner-bottom-back-right", cS, cS, cS, half, -half, -half, "corner");
    createBox("corner-bottom-back-left", cS, cS, cS, -half, -half, -half, "corner");

    const eL = edgeLength;
    const eT = edgeThickness;
    // Edges
    createBox("edge-top-front", eL, eT, eT, 0, half, half, "edge");
    createBox("edge-top-back", eL, eT, eT, 0, half, -half, "edge");
    createBox("edge-top-right", eT, eT, eL, half, half, 0, "edge");
    createBox("edge-top-left", eT, eT, eL, -half, half, 0, "edge");

    createBox("edge-bottom-front", eL, eT, eT, 0, -half, half, "edge");
    createBox("edge-bottom-back", eL, eT, eT, 0, -half, -half, "edge");
    createBox("edge-bottom-right", eT, eT, eL, half, -half, 0, "edge");
    createBox("edge-bottom-left", eT, eT, eL, -half, -half, 0, "edge");

    createBox("edge-front-right", eT, eL, eT, half, 0, half, "edge");
    createBox("edge-front-left", eT, eL, eT, -half, 0, half, "edge");
    createBox("edge-back-right", eT, eL, eT, half, 0, -half, "edge");
    createBox("edge-back-left", eT, eL, eT, -half, 0, -half, "edge");
  };

  augmentViewCube();

  return () => {
    disposed = true;
    world.camera.controls.removeEventListener("update", updateOrientation);
    viewCube.remove();
  };
};

