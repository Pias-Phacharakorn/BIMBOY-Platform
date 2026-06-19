import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ComposedChart, Bar, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend, CartesianGrid } from "recharts";
import { Button } from "@/components/ui/button";
import { Clash } from "./clashTypes";

type Bucket = "week" | "month";

const bucketKey = (d: Date, b: Bucket) => {
  if (b === "month") return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  // ISO week-ish
  const tmp = new Date(d);
  tmp.setHours(0, 0, 0, 0);
  tmp.setDate(tmp.getDate() - tmp.getDay());
  return `${tmp.getFullYear()}-W${String(Math.ceil(((tmp.getTime() - new Date(tmp.getFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7)).padStart(2, "0")}`;
};

const OvertimeChart = ({ clashes }: { clashes: Clash[] }) => {
  const [bucket, setBucket] = useState<Bucket>("month");

  const map = new Map<string, { name: string; created: number; closed: number; cumOpen: number }>();
  const get = (k: string) => {
    if (!map.has(k)) map.set(k, { name: k, created: 0, closed: 0, cumOpen: 0 });
    return map.get(k)!;
  };
  clashes.forEach((c) => {
    get(bucketKey(new Date(c.created_at), bucket)).created++;
    if (c.status === "Closed") get(bucketKey(new Date(c.updated_at), bucket)).closed++;
  });
  const data = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  let running = 0;
  data.forEach((d) => { running += d.created - d.closed; d.cumOpen = running; });

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Created vs Closed over time</CardTitle>
        <div className="flex gap-1">
          <Button size="sm" variant={bucket === "week" ? "default" : "outline"} onClick={() => setBucket("week")} className="h-7 text-xs">Week</Button>
          <Button size="sm" variant={bucket === "month" ? "default" : "outline"} onClick={() => setBucket("month")} className="h-7 text-xs">Month</Button>
        </div>
      </CardHeader>
      <CardContent className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={50} interval={0} />
            <YAxis yAxisId="left" allowDecimals={false} tick={{ fontSize: 11 }} />
            <YAxis yAxisId="right" orientation="right" allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Bar yAxisId="left" dataKey="created" name="Created" fill="#1D4ED8" />
            <Bar yAxisId="left" dataKey="closed" name="Closed" fill="#047857" />
            <Line yAxisId="right" type="monotone" dataKey="cumOpen" name="Open (cumulative)" stroke="#DC2626" strokeWidth={2} dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default OvertimeChart;
