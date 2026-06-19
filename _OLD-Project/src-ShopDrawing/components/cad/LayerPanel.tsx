import { Eye, EyeOff, Layers } from "lucide-react";
import { LayerInfo } from "./CadCanvas";

interface LayerPanelProps {
  layers: LayerInfo[];
  onToggleLayer: (layerName: string, isOff: boolean) => void;
}

const LayerPanel = ({ layers, onToggleLayer }: LayerPanelProps) => {
  if (layers.length === 0) {
    return (
      <div className="p-3 text-sm text-muted-foreground">No layers loaded</div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="p-3 border-b flex items-center gap-2">
        <Layers className="h-3.5 w-3.5 text-muted-foreground" />
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Layers
        </h3>
        <span className="ml-auto text-xs text-muted-foreground">{layers.length}</span>
      </div>
      <ul className="overflow-y-auto max-h-64">
        {layers.map((layer) => (
          <li
            key={layer.name}
            className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted/50 group"
          >
            {/* Layer color dot */}
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0 border border-border/50"
              style={{ backgroundColor: layer.color ?? '#ffffff' }}
            />
            {/* Layer name */}
            <span
              className={`flex-1 text-xs truncate ${
                layer.isOff ? 'text-muted-foreground line-through' : 'text-foreground'
              }`}
              title={layer.name}
            >
              {layer.name}
            </span>
            {/* Visibility toggle */}
            <button
              className="shrink-0 opacity-60 group-hover:opacity-100 transition-opacity"
              onClick={() => onToggleLayer(layer.name, !layer.isOff)}
              title={layer.isOff ? 'Show layer' : 'Hide layer'}
            >
              {layer.isOff ? (
                <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <Eye className="h-3.5 w-3.5 text-foreground" />
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default LayerPanel;
