import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Clash, PRIORITY_COLORS, PRIORITY_OPTIONS } from "./clashTypes";

const PriorityPie = ({ clashes }: { clashes: Clash[] }) => {
  const data = PRIORITY_OPTIONS.map((p) => ({
    name: p, value: clashes.filter((c) => c.priority === p).length, color: PRIORITY_COLORS[p],
  })).filter((d) => d.value > 0);
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">Priority</CardTitle></CardHeader>
      <CardContent className="h-64">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No data</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                {data.map((d) => <Cell key={d.name} fill={d.color} />)}
              </Pie>
              <Tooltip /><Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};
export default PriorityPie;
