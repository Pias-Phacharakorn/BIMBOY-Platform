import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { formatThailandTime } from "@/lib/dateUtils";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";
import { canViewScanActivities } from "@/types/roles";
import { useActiveProject } from "@/hooks/useActiveProject";

interface ScanActivity {
  id: string;
  drawing_no: string;
  scanned_revision: number;
  latest_revision: number;
  is_valid: boolean;
  scanned_at: string;
  user_id: string;
  project_id: string;
  profiles?: {
    first_name: string;
    last_name: string;
  };
  projects?: {
    name: string;
  };
}

type DateRangePreset = "today" | "week" | "month" | "custom" | "all";

const Activity = () => {
  const navigate = useNavigate();
  const { role, loading: roleLoading, userId } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<ScanActivity[]>([]);
  const { selectedProject } = useActiveProject();
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>("all");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [stats, setStats] = useState({
    totalScans: 0,
    validScans: 0,
    invalidScans: 0,
    todayScans: 0,
  });

  const canView = canViewScanActivities(role);

  useEffect(() => {
    if (!roleLoading) {
      checkAuthAndFetchData();
    }
  }, [navigate, selectedProject, dateRangePreset, startDate, endDate, roleLoading, role]);

  const checkAuthAndFetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }

    // Redirect if user doesn't have permission to view scan activities
    if (!canView) {
      navigate("/dashboard");
      return;
    }

    await fetchActivities();
  };

  const fetchActivities = async () => {
    if (!userId) return;

    setLoading(true);

    if (!selectedProject) {
      setActivities([]);
      setLoading(false);
      return;
    }

    let query = supabase
      .from("scan_activities")
      .select(`
        *,
        profiles (first_name, last_name),
        projects (name)
      `)
      .eq("project_id", selectedProject)
      .order("scanned_at", { ascending: false })
      .limit(100);


    // Apply date range filter
    if (dateRangePreset !== "all") {
      let filterStartDate: Date;
      let filterEndDate: Date = endOfDay(new Date());

      switch (dateRangePreset) {
        case "today":
          filterStartDate = startOfDay(new Date());
          break;
        case "week":
          filterStartDate = startOfDay(subDays(new Date(), 7));
          break;
        case "month":
          filterStartDate = startOfDay(subDays(new Date(), 30));
          break;
        case "custom":
          if (startDate) {
            filterStartDate = startOfDay(startDate);
            filterEndDate = endDate ? endOfDay(endDate) : endOfDay(new Date());
          } else {
            filterStartDate = startOfDay(subDays(new Date(), 30));
          }
          break;
        default:
          filterStartDate = startOfDay(subDays(new Date(), 30));
      }

      query = query
        .gte("scanned_at", filterStartDate.toISOString())
        .lte("scanned_at", filterEndDate.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching activities:", error);
    } else if (data) {
      setActivities(data as any);
      calculateStats(data as any);
    }
    setLoading(false);
  };

  const calculateStats = (data: ScanActivity[]) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const stats = {
      totalScans: data.length,
      validScans: data.filter(a => a.is_valid).length,
      invalidScans: data.filter(a => !a.is_valid).length,
      todayScans: data.filter(a => new Date(a.scanned_at) >= today).length,
    };

    setStats(stats);
  };

  const handlePresetChange = (preset: DateRangePreset) => {
    setDateRangePreset(preset);
    if (preset !== "custom") {
      setStartDate(undefined);
      setEndDate(undefined);
    }
  };

  if (loading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!canView) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="animate-fade-in container mx-auto px-4 md:px-6 py-6 md:py-8">
      <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-8">Scan Activity</h1>

        {/* Date Range Filter */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="flex gap-2">
            <Button
              variant={dateRangePreset === "all" ? "default" : "outline"}
              onClick={() => handlePresetChange("all")}
              size="sm"
            >
              All Time
            </Button>
            <Button
              variant={dateRangePreset === "today" ? "default" : "outline"}
              onClick={() => handlePresetChange("today")}
              size="sm"
            >
              Today
            </Button>
            <Button
              variant={dateRangePreset === "week" ? "default" : "outline"}
              onClick={() => handlePresetChange("week")}
              size="sm"
            >
              Last 7 Days
            </Button>
            <Button
              variant={dateRangePreset === "month" ? "default" : "outline"}
              onClick={() => handlePresetChange("month")}
              size="sm"
            >
              Last 30 Days
            </Button>
          </div>

          <div className="flex gap-2 items-center">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={dateRangePreset === "custom" ? "default" : "outline"}
                  size="sm"
                  className={cn("justify-start text-left font-normal")}
                  onClick={() => setDateRangePreset("custom")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? (
                    endDate ? (
                      <>
                        {formatThailandTime(startDate, "MMM dd")} - {formatThailandTime(endDate, "MMM dd, yyyy")}
                      </>
                    ) : (
                      formatThailandTime(startDate, "MMM dd, yyyy")
                    )
                  ) : (
                    <span>Custom Range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div className="p-3">
                  <div className="text-sm font-medium mb-2">Start Date</div>
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                    className="pointer-events-auto"
                  />
                  <div className="text-sm font-medium mb-2 mt-3">End Date</div>
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    disabled={(date) => startDate ? date < startDate : false}
                    className="pointer-events-auto"
                  />
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Dashboard Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Scans</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalScans}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Valid Scans</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{stats.validScans}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Invalid Scans</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{stats.invalidScans}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Today's Scans</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{stats.todayScans}</div>
            </CardContent>
          </Card>
        </div>

        {/* Activity Table */}
        <Card>
          <CardHeader>
            <CardTitle>Activity Log</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Drawing No</TableHead>
                  <TableHead>Scanned Rev</TableHead>
                  <TableHead>Latest Rev</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activities.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No scan activities found
                    </TableCell>
                  </TableRow>
                ) : (
                  activities.map((activity) => (
                    <TableRow key={activity.id}>
                      <TableCell className="font-medium">
                        {formatThailandTime(activity.scanned_at, "MMM dd, yyyy HH:mm")}
                      </TableCell>
                      <TableCell>
                        {activity.profiles
                          ? `${activity.profiles.first_name} ${activity.profiles.last_name}`
                          : "Unknown"}
                      </TableCell>
                      <TableCell>
                        {activity.projects?.name || "N/A"}
                      </TableCell>
                      <TableCell>{activity.drawing_no}</TableCell>
                      <TableCell>{activity.scanned_revision}</TableCell>
                      <TableCell>{activity.latest_revision}</TableCell>
                      <TableCell>
                        {activity.is_valid ? (
                          <Badge className="bg-green-500 hover:bg-green-600">Valid</Badge>
                        ) : (
                          <Badge variant="destructive">Invalid</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
    </div>
  );
};

export default Activity;
