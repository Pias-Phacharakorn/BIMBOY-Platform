/**
 * ⚠️ TEMPORARY DIAGNOSTIC — delete before this branch is presented.
 *
 * Staged for the open bug in `CONTEXT.md` § "OPEN BUG: a cut's band and/or fill reaches past the
 * model it cuts": a cut plane's grey fill renders as floor-plan linework floating clear of any
 * geometry. Three candidate mechanisms survived black-box testing and are only separable from
 * runtime state:
 *
 *  1. **Orphaned fill meshes.** `ClipEdges.getStyleMeshes` awaits `getCoordinationMatrix()` between
 *     its cache check and its cache write, so two concurrent `updateMeshes` calls for one
 *     model+style both build a mesh and both `three.add(...)`. The loser of the cache race is never
 *     updated again but stays in the scene. → proven by `fillChildren` exceeding the model count.
 *  2. **FRAGS culling dropping geometry while the fill survives** — the fill is a plain
 *     `THREE.Mesh` outside FRAGS' LOD/culling control. → shown by a model whose `boxCenter` sits
 *     where nothing renders.
 *  3. **A model the hand-built test scenes did not have** — the project auto-loads every `.frag`.
 *     → shown by the model list itself.
 *
 * ⚠️ **Why this ships to production.** Five reproduction attempts put the bug on the deployed
 * Worker build twice and never on a local dev build — the signature of candidate 1, since a race
 * interleaves differently on a fast minified bundle. A `import.meta.env.DEV` gate would therefore
 * never fire where the bug lives, so the probe is gated on a **`?debugFills=1` query param**
 * instead. It is inert without the flag: no listeners, no globals, no DOM.
 *
 * The report also renders as an on-screen overlay, because the only confirmed reproductions are on
 * a phone where a JS console is not reachable — tap the badge, screenshot the panel.
 */
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import * as THREE from "three";

const FLAG = "debugFills";

const v = (vec: THREE.Vector3) =>
  `${vec.x.toFixed(1)}, ${vec.y.toFixed(1)}, ${vec.z.toFixed(1)}`;

/** Where an object actually renders — the only thing comparable to a model's own box. */
const renderedCenter = (object: THREE.Object3D) => {
  const box = new THREE.Box3().setFromObject(object);
  return box.isEmpty() ? "(empty)" : v(box.getCenter(new THREE.Vector3()));
};

async function buildReport(components: OBC.Components) {
  const fragments = components.get(OBC.FragmentsManager);
  const styler = components.get(OBF.ClipStyler);
  const clipper = components.get(OBC.Clipper);
  const out: string[] = [];

  out.push(`base model: ${fragments.baseCoordinationModel || "(none)"}`);

  // --- models -------------------------------------------------------------
  let modelCount = 0;
  out.push("", "== MODELS ==");
  for (const [modelId, model] of fragments.list) {
    modelCount++;
    let coords = "(failed)";
    try {
      coords = (await model.getCoordinates())
        .slice(0, 3)
        .map((n: number) => n.toFixed(1))
        .join(", ");
    } catch {
      // A model still loading has no coordinates yet — reported as-is rather than hidden.
    }
    const box = model.box;
    out.push(
      `${modelId}`,
      `   visible=${model.object.visible} inScene=${!!model.object.parent}` +
        ` pos=[${v(model.object.position)}]`,
      `   boxCenter=[${box && !box.isEmpty() ? v(box.getCenter(new THREE.Vector3())) : "(empty)"}]` +
        ` coords=[${coords}]`,
    );
  }
  out.push(`(${modelCount} models)`);

  // --- clipping planes ----------------------------------------------------
  // Includes planes created outside ClipperCursor — the Drawing Editor's
  // `_updateSectionClip` makes one directly on OBC.Clipper with visible=false.
  out.push("", "== PLANES ==");
  let planeCount = 0;
  for (const [planeId, plane] of clipper.list) {
    planeCount++;
    out.push(
      `${planeId.slice(0, 8)} enabled=${plane.enabled} visible=${plane.visible}` +
        ` n=[${v(plane.normal)}] c=${plane.three.constant.toFixed(1)}`,
    );
  }
  out.push(`(${planeCount} planes)`);

  // --- fills --------------------------------------------------------------
  // The load-bearing number is `children`. One mesh per (model, style) is
  // expected; more than `modelCount` is candidate 1, proven rather than argued.
  out.push("", "== FILLS ==");
  for (const [edgesId, edges] of styler.list) {
    const children = edges.three.children;
    const verdict = children.length > modelCount ? "  <<< MORE THAN MODELS" : "";
    out.push(
      `${edgesId.slice(0, 8)} visible=${edges.visible} inScene=${!!edges.three.parent}` +
        ` children=${children.length}/${modelCount}${verdict}`,
    );
    children.forEach((child, i) => {
      const position = (child as THREE.Mesh).geometry?.getAttribute?.("position");
      out.push(
        `   [${i}] ${child.type} verts=${position ? position.count : 0}` +
          ` at=[${renderedCenter(child)}]`,
      );
    });
  }

  return out.join("\n");
}

/** Floating badge + panel, so the report is readable on a phone with no console. */
function mountOverlay(run: () => Promise<string>) {
  const badge = document.createElement("button");
  badge.textContent = "probe";
  badge.style.cssText =
    "position:fixed;left:8px;bottom:8px;z-index:2147483647;padding:8px 14px;" +
    "background:#4ade80;color:#000;border:0;border-radius:6px;font:600 13px monospace";

  const panel = document.createElement("pre");
  panel.style.cssText =
    "position:fixed;inset:8px;z-index:2147483646;display:none;overflow:auto;margin:0;" +
    "padding:12px;background:#000e;color:#4ade80;font:11px/1.45 monospace;" +
    "white-space:pre-wrap;border:1px solid #4ade80;border-radius:6px";
  panel.addEventListener("click", () => {
    panel.style.display = "none";
  });

  badge.addEventListener("click", async () => {
    panel.textContent = "running…";
    panel.style.display = "block";
    try {
      const text = await run();
      panel.textContent = `${text}\n\n(tap panel to close)`;
      console.log(`[BIMBOY fill probe]\n${text}`);
    } catch (error) {
      panel.textContent = `probe failed: ${error}`;
      console.error("[BIMBOY fill probe] failed:", error);
    }
  });

  document.body.append(badge, panel);
  return () => {
    badge.remove();
    panel.remove();
  };
}

/**
 * Installs the probe when `?debugFills=1` is in the URL (or in a dev build). Returns a teardown;
 * the teardown is a no-op when the flag is absent, so the caller needs no condition of its own.
 */
export function installFillProbe(components: OBC.Components) {
  const enabled =
    import.meta.env.DEV || new URLSearchParams(window.location.search).has(FLAG);
  if (!enabled) return () => {};

  const run = () => buildReport(components);
  (window as any).__bimboyFillProbe = () =>
    run().then((text) => {
      console.log(`[BIMBOY fill probe]\n${text}`);
      return text;
    });

  return mountOverlay(run);
}
