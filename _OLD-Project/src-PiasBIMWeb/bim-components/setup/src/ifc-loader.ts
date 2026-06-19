import * as OBC from "@thatopen/components"

export const setupIfcLoader = async (components: OBC.Components) => {
  const ifcLoader = components.get(OBC.IfcLoader);
  ifcLoader.settings.autoSetWasm = false
  ifcLoader.settings.wasm = { absolute: true, path: "https://unpkg.com/web-ifc@0.0.77/" }
  await ifcLoader.setup()
}