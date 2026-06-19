import { Card, CardContent } from "@/components/ui/card";
import { Clash, isOverdue } from "./clashTypes";
import { AlertTriangle, CheckCircle2, Circle, Layers, Clock } from "lucide-react";

const KpiCards = ({ clashes }: { clashes: Clash[] }) => {
  const items = [
    { label: "Total", value: clashes.length, icon: Layers, color: "text-primary" },
    { label: "Open", value: clashes.filter((c) => c.status === "Open").length, icon: Circle, color: "text-blue-600" },
    { label: "In Progress", value: clashes.filter((c) => c.status === "In Progress").length, icon: Clock, color: "text-amber-600" },
    { label: "Closed", value: clashes.filter((c) => c.status === "Closed").length, icon: CheckCircle2, color: "text-emerald-600" },
    { label: "Overdue", value: clashes.filter(isOverdue).length, icon: AlertTriangle, color: "text-destructive" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {items.map((it) => (
        <Card key={it.label}>
          <CardContent className="p-4 flex items-center gap-3">
            <it.icon className={`h-7 w-7 shrink-0 ${it.color}`} />
            <div>
              <p className="text-xs text-muted-foreground">{it.label}</p>
              <p className="text-2xl font-bold">{it.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default KpiCards;
