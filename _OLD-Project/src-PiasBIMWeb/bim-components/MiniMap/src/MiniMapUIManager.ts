export class MiniMapUIManager {
  public readonly uiContainer: HTMLDivElement;
  public readonly mapCanvas: HTMLCanvasElement;
  public readonly mapContext: CanvasRenderingContext2D;
  public readonly playerArrow: HTMLDivElement;

  constructor(
    cacheResolution: number,
    onMapClick: (e: MouseEvent) => void
  ) {
    // Initialize UI Elements
    this.uiContainer = document.createElement("div");
    this.uiContainer.style.position = "relative";
    this.uiContainer.style.width = "100%";
    this.uiContainer.style.height = "100%";
    this.uiContainer.style.overflow = "hidden";
    this.uiContainer.style.backgroundColor = "#1e1e1e";
    this.uiContainer.style.borderRadius = "8px";

    this.mapCanvas = document.createElement("canvas");
    this.mapCanvas.width = cacheResolution;
    this.mapCanvas.height = cacheResolution;
    this.mapCanvas.style.width = "100%";
    this.mapCanvas.style.height = "100%";
    this.mapCanvas.style.position = "absolute";
    this.mapCanvas.style.top = "0";
    this.mapCanvas.style.left = "0";
    this.mapCanvas.style.objectFit = "contain";
    this.uiContainer.appendChild(this.mapCanvas);

    const ctx = this.mapCanvas.getContext("2d");
    if (!ctx) {
      throw new Error("Could not get 2D context for minimap canvas");
    }
    this.mapContext = ctx;

    this.playerArrow = document.createElement("div");
    this.playerArrow.style.position = "absolute";
    this.playerArrow.style.top = "50%";
    this.playerArrow.style.left = "50%";
    this.playerArrow.style.width = "0";
    this.playerArrow.style.height = "0";
    this.playerArrow.style.transform = "translate(-50%, -50%)";
    this.playerArrow.style.zIndex = "10";
    this.playerArrow.style.transition = "top 0.1s linear, left 0.1s linear"; // Smooth icon movement

    // Create the field of view (FOV) cone (semi-transparent blue sector)
    const fovCone = document.createElement("div");
    fovCone.style.position = "absolute";
    fovCone.style.width = "80px";
    fovCone.style.height = "80px";
    fovCone.style.left = "-40px";
    fovCone.style.top = "-80px"; // Origin/tip is at the parent center
    fovCone.style.background = "conic-gradient(from 330deg at 50% 100%, rgba(96, 165, 250, 0.4) 0deg, rgba(96, 165, 250, 0.4) 60deg, transparent 60deg)";
    fovCone.style.clipPath = "ellipse(50% 50% at 50% 100%)";
    fovCone.style.transformOrigin = "bottom center";

    // Create the glowing camera position dot
    const cameraDot = document.createElement("div");
    cameraDot.style.position = "absolute";
    cameraDot.style.width = "12px";
    cameraDot.style.height = "12px";
    cameraDot.style.left = "-6px";
    cameraDot.style.top = "-6px";
    cameraDot.style.borderRadius = "50%";
    cameraDot.style.backgroundColor = "#3b82f6";
    cameraDot.style.border = "2px solid #ffffff";
    cameraDot.style.boxShadow = "0 0 8px rgba(59, 130, 246, 0.8)";

    this.playerArrow.appendChild(fovCone);
    this.playerArrow.appendChild(cameraDot);
    this.uiContainer.appendChild(this.playerArrow);

    // Canvas click listener to navigate 3D camera
    this.mapCanvas.addEventListener("click", onMapClick);

    // Suppress double-click propagation to prevent conflicts
    this.mapCanvas.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      e.preventDefault();
    });
  }

  public dispose() {
    this.mapCanvas.remove();
    this.playerArrow.remove();
    this.uiContainer.remove();
  }
}
