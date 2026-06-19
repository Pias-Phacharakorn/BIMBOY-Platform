import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { Clash } from "./clashTypes";

const AssigneeBar = ({ clashes }: { clashes: Clash[] }) => {
  const counts: Record<string, number> = {};
  clashes.forEach((c) => { const k = c.originator || "Unassigned"; counts[k] = (counts[k] || 0) + 1; });
  const data = Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 12);
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">Issues by Assignee</CardTitle></CardHeader>
      <CardContent className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 60 }}>
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
            <Tooltip />
            <Bar dataKey="value" fill="#F59E0B" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
export default AssigneeBar;
