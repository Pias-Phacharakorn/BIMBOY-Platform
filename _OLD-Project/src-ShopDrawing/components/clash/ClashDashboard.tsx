import { forwardRef } from "react";
import { Clash } from "./clashTypes";
import KpiCards from "./ClashKpiCards";
import StatusDonut from "./ClashStatusDonut";
import PriorityPie from "./ClashPriorityPie";
import ZoneBar from "./ClashZoneBar";
import AssigneeBar from "./ClashAssigneeBar";
import DisciplineBar from "./ClashDisciplineBar";
import OvertimeChart from "./ClashOvertimeChart";

interface Props { clashes: Clash[]; }

const ClashDashboard = forwardRef<HTMLDivElement, Props>(({ clashes }, ref) => (
  <div ref={ref} className="space-y-4 bg-background p-2">
    <KpiCards clashes={clashes} />
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <StatusDonut clashes={clashes} />
      <PriorityPie clashes={clashes} />
      <ZoneBar clashes={clashes} />
      <AssigneeBar clashes={clashes} />
    </div>
    <DisciplineBar clashes={clashes} />
    <OvertimeChart clashes={clashes} />
  </div>
));
ClashDashboard.displayName = "ClashDashboard";
export default ClashDashboard;
