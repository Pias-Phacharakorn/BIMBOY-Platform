import { Badge } from "@/components/ui/badge";
import { getWorkloadStatus } from "@/lib/recurrenceUtils";

interface WorkloadStatusBadgeProps {
  percent: number;
}

const WorkloadStatusBadge = ({ percent }: WorkloadStatusBadgeProps) => {
  const status = getWorkloadStatus(percent);
  return <Badge variant={status.variant}>{status.label}</Badge>;
};

export default WorkloadStatusBadge;
