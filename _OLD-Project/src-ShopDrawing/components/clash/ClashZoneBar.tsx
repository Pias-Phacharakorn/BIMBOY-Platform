import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { Clash } from "./clashTypes";

const ZoneBar = ({ clashes }: { clashes: Clash[] }) => {
  const counts: Record<string, number> = {};
  clashes.forEach((c) => { const k = c.zone || "—"; counts[k] = (counts[k] || 0) + 1; });
  const data = Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 15);
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">Issues by Zone</CardTitle></CardHeader>
      <CardContent className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={50} interval={0} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="value" fill="#1B3D6F" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
export default ZoneBar;
