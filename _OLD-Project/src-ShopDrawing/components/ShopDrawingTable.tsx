import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { formatThailandTime } from "@/lib/dateUtils";
import { getSignedPdfUrl, downloadPdfWithSignedUrl } from "@/lib/pdfUtils";
import { Search, FileDown, ChevronDown, ChevronRight, GitCompareArrows, Plus, Trash2, Upload } from "lucide-react";
import PdfViewerModal from "@/components/PdfViewerModal";
import CompareDocumentsModal from "@/components/CompareDocumentsModal";
import AddDrawingDialog from "@/components/AddDrawingDialog";
import UploadPdfDialog from "@/components/UploadPdfDialog";
import DeleteDrawingDialog from "@/components/DeleteDrawingDialog";
import { useUserRole } from "@/hooks/useUserRole";
import { canManageDrawings } from "@/types/roles";

interface ShopDrawing {
  id: string;
  no: string;
  name: string;
  current_revision: number;
  last_updated: string;
  project_id: string | null;
  author: string | null;
  is_latest: boolean;
  sheet_id: string | null;
  pdf_url: string | null;
}

interface GroupedDrawing {
  sheetId: string;
  versions: ShopDrawing[];
}

interface ShopDrawingTableProps {
  selectedProjectId?: string;
}

const ShopDrawingTable = ({ selectedProjectId }: ShopDrawingTableProps) => {
  const [drawings, setDrawings] = useState<ShopDrawing[]>([]);
  const [sheetNameFilter, setSheetNameFilter] = useState("");
  const [sheetNumberFilter, setSheetNumberFilter] = useState("");
  const [authorFilter, setAuthorFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [projectName, setProjectName] = useState<string>("HEADQUARTERS");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [selectedPdf, setSelectedPdf] = useState<{ url: string; title: string } | null>(null);
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [compareVersions, setCompareVersions] = useState<ShopDrawing[]>([]);
  const [compareDrawingNo, setCompareDrawingNo] = useState("");
  
  // Drawing management dialogs
  const [addDrawingOpen, setAddDrawingOpen] = useState(false);
  const [uploadPdfOpen, setUploadPdfOpen] = useState(false);
  const [deleteDrawingOpen, setDeleteDrawingOpen] = useState(false);
  const [selectedDrawingForAction, setSelectedDrawingForAction] = useState<ShopDrawing | null>(null);
  
  const { role } = useUserRole();
  const canManage = canManageDrawings(role);
  
  const { toast } = useToast();

  const handleViewPdf = async (drawing: ShopDrawing) => {
    if (!drawing.pdf_url) {
      toast({
        title: "No PDF Available",
        description: "This drawing doesn't have a PDF attached.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      // Get signed URL for viewing
      const signedUrl = await getSignedPdfUrl(drawing.pdf_url);
      setSelectedPdf({
        url: signedUrl,
        title: `${drawing.no} - ${drawing.name} (Rev ${drawing.current_revision})`,
      });
      setPdfModalOpen(true);
    } catch (error) {
      console.error("Error getting signed URL:", error);
      toast({
        title: "Error",
        description: "Failed to load PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadPdf = async (drawing: ShopDrawing) => {
    if (!drawing.pdf_url) {
      toast({
        title: "No PDF Available",
        description: "This drawing doesn't have a PDF attached.",
        variant: "destructive",
      });
      return;
    }
    
    // Download using signed URL with format: SheetNo_SheetName_RRevision.pdf
    const sanitizedName = (drawing.name || 'Unnamed').replace(/[^a-zA-Z0-9\-_]/g, '-');
    await downloadPdfWithSignedUrl(
      drawing.pdf_url,
      `${drawing.no}_${sanitizedName}_R${drawing.current_revision}.pdf`
    );
  };

  const handleCompare = (group: GroupedDrawing) => {
    const versionsWithPdf = group.versions.filter((v) => v.pdf_url);
    if (versionsWithPdf.length < 2) {
      toast({
        title: "Cannot Compare",
        description: "At least 2 versions with PDFs are required for comparison.",
        variant: "destructive",
      });
      return;
    }
    setCompareVersions(group.versions);
    setCompareDrawingNo(group.versions[0].no);
    setCompareModalOpen(true);
  };

  useEffect(() => {
    fetchDrawings();
  }, [selectedProjectId]);

  useEffect(() => {
    if (selectedProjectId) {
      fetchProjectName();
    } else {
      setProjectName("HEADQUARTERS");
    }
  }, [selectedProjectId]);

  const fetchProjectName = async () => {
    if (!selectedProjectId) return;
    
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("name")
        .eq("id", selectedProjectId)
        .single();

      if (error) throw error;
      if (data) {
        setProjectName(data.name);
      }
    } catch (error: any) {
      console.error("Error fetching project name:", error);
    }
  };

  const fetchDrawings = async () => {
    try {
      setLoading(true);
      if (!selectedProjectId) {
        setDrawings([]);
        setLoading(false);
        return;
      }
      const query = supabase
        .from("shop_drawings")
        .select("*")
        .eq("project_id", selectedProjectId)
        .order("no", { ascending: true })
        .order("current_revision", { ascending: false });

      const { data, error } = await query;

      if (error) throw error;
      setDrawings(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load shop drawings.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Group drawings by sheet_id (Revit-based) and sort versions (newest first)
  const groupedDrawings = useMemo(() => {
    let filtered = drawings;

    if (sheetNameFilter) {
      filtered = filtered.filter((d) =>
        d.name.toLowerCase().includes(sheetNameFilter.toLowerCase())
      );
    }

    if (sheetNumberFilter) {
      filtered = filtered.filter((d) =>
        d.no.toLowerCase().includes(sheetNumberFilter.toLowerCase())
      );
    }

    if (authorFilter) {
      filtered = filtered.filter((d) =>
        (d.author ?? "").toLowerCase().includes(authorFilter.toLowerCase())
      );
    }

    // Group by sheet_id (Revit unique identifier) - fallback to 'no' if sheet_id is null
    const groups: Map<string, ShopDrawing[]> = new Map();
    filtered.forEach((drawing) => {
      const groupKey = drawing.sheet_id || drawing.no;
      const existing = groups.get(groupKey) || [];
      existing.push(drawing);
      groups.set(groupKey, existing);
    });

    // Sort each group by revision (newest first) and convert to array
    const result: GroupedDrawing[] = [];
    groups.forEach((versions, sheetId) => {
      versions.sort((a, b) => b.current_revision - a.current_revision);
      result.push({ sheetId, versions });
    });

    // Sort groups by the sheet number (no) of the latest version for display consistency
    result.sort((a, b) => a.versions[0].no.localeCompare(b.versions[0].no));

    return result;
  }, [drawings, sheetNameFilter, sheetNumberFilter, authorFilter]);

  const toggleGroup = (sheetId: string) => {
    setExpandedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sheetId)) {
        newSet.delete(sheetId);
      } else {
        newSet.add(sheetId);
      }
      return newSet;
    });
  };

  const handleSearch = () => {
    // Filters are applied reactively via useMemo, but this button provides UX feedback
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-gradient-to-r from-[hsl(var(--navy))] to-[hsl(var(--navy-light))] text-white px-6 py-4 rounded-t-lg">
        <div className="font-medium">{projectName}</div>
        <div className="flex items-center gap-4">
          {canManage && selectedProjectId && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setAddDrawingOpen(true)}
              className="bg-white/10 hover:bg-white/20 text-white border-0"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Drawing
            </Button>
          )}
          <div className="font-medium">FILTER RESULTS</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted/50">
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground w-8">
                    
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    NO.
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    NAME
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    DATE/TIME
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    AUTHOR
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    REVISION
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    CHANGE LOG (AI)
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    ACTION
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y">
                {groupedDrawings.map((group) => {
                  const latestVersion = group.versions[0];
                  const hasMultipleVersions = group.versions.length > 1;
                  const isExpanded = expandedGroups.has(group.sheetId);

                  return (
                    <>
                      {/* Latest version row (parent) */}
                      <tr 
                        key={latestVersion.id} 
                        className="hover:bg-muted/20 transition-colors cursor-pointer"
                        onClick={() => hasMultipleVersions && toggleGroup(group.sheetId)}
                      >
                        <td className="px-4 py-4 text-sm">
                          {hasMultipleVersions && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleGroup(group.sheetId);
                              }}
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                        </td>
                        <td className="px-4 py-4 text-sm font-medium">
                          {latestVersion.no}
                        </td>
                        <td className="px-4 py-4 text-sm text-accent">{latestVersion.name}</td>
                        <td className="px-4 py-4 text-sm">
                          {formatThailandTime(latestVersion.last_updated)}
                        </td>
                        <td className="px-4 py-4 text-sm">{latestVersion.author || '-'}</td>
                        <td className="px-4 py-4 text-sm font-medium text-accent">
                          {latestVersion.current_revision}
                        </td>
                        <td className="px-4 py-4 text-sm text-muted-foreground">-</td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className={`h-8 w-8 p-0 ${latestVersion.pdf_url ? 'text-[hsl(var(--navy))] hover:text-[hsl(var(--navy))]/80 hover:bg-[hsl(var(--navy))]/10' : 'text-muted-foreground/40 cursor-not-allowed'}`}
                              title={latestVersion.pdf_url ? "View PDF" : "No PDF available"}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewPdf(latestVersion);
                              }}
                              disabled={!latestVersion.pdf_url}
                            >
                              <Search className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className={`h-8 w-8 p-0 ${latestVersion.pdf_url ? 'text-[hsl(var(--navy))] hover:text-[hsl(var(--navy))]/80 hover:bg-[hsl(var(--navy))]/10' : 'text-muted-foreground/40 cursor-not-allowed'}`}
                              title={latestVersion.pdf_url ? "Download PDF" : "No PDF available"}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadPdf(latestVersion);
                              }}
                              disabled={!latestVersion.pdf_url}
                            >
                              <FileDown className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className={`h-8 w-8 p-0 ${group.versions.filter(v => v.pdf_url).length >= 2 ? 'text-[hsl(var(--navy))] hover:text-[hsl(var(--navy))]/80 hover:bg-[hsl(var(--navy))]/10' : 'text-muted-foreground/40 cursor-not-allowed'}`}
                              title={group.versions.filter(v => v.pdf_url).length >= 2 ? "Compare versions" : "Need at least 2 versions with PDFs"}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCompare(group);
                              }}
                              disabled={group.versions.filter(v => v.pdf_url).length < 2}
                            >
                              <GitCompareArrows className="h-4 w-4" />
                            </Button>
                            {canManage && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 text-[hsl(var(--navy))] hover:text-[hsl(var(--navy))]/80 hover:bg-[hsl(var(--navy))]/10"
                                  title="Upload PDF / Add Revision"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedDrawingForAction({
                                      ...latestVersion,
                                      sheet_id: latestVersion.sheet_id,
                                      author: latestVersion.author,
                                    });
                                    setUploadPdfOpen(true);
                                  }}
                                >
                                  <Upload className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                                  title="Delete drawing"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedDrawingForAction(latestVersion);
                                    setDeleteDrawingOpen(true);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                      
                      {/* Child version rows (older versions) */}
                      {isExpanded && group.versions.slice(1).map((version) => (
                        <tr 
                          key={version.id} 
                          className="hover:bg-muted/10 transition-colors bg-muted/5"
                        >
                          <td className="px-4 py-3 text-sm pl-8"></td>
                          <td className="px-4 py-3 text-sm text-muted-foreground pl-8">
                            {version.no}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{version.name}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {formatThailandTime(version.last_updated)}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{version.author || '-'}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {version.current_revision}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">-</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                className={`h-7 w-7 p-0 ${version.pdf_url ? 'text-muted-foreground hover:text-[hsl(var(--navy))] hover:bg-[hsl(var(--navy))]/10' : 'text-muted-foreground/30 cursor-not-allowed'}`}
                                title={version.pdf_url ? "View PDF" : "No PDF available"}
                                onClick={() => handleViewPdf(version)}
                                disabled={!version.pdf_url}
                              >
                                <Search className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className={`h-7 w-7 p-0 ${version.pdf_url ? 'text-muted-foreground hover:text-[hsl(var(--navy))] hover:bg-[hsl(var(--navy))]/10' : 'text-muted-foreground/30 cursor-not-allowed'}`}
                                title={version.pdf_url ? "Download PDF" : "No PDF available"}
                                onClick={() => handleDownloadPdf(version)}
                                disabled={!version.pdf_url}
                              >
                                <FileDown className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <Card className="lg:col-span-1 p-6 h-fit">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sheetNumber">Sheet number</Label>
              <Input
                id="sheetNumber"
                placeholder="Filter by number..."
                value={sheetNumberFilter}
                onChange={(e) => setSheetNumberFilter(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sheetName">Sheet name</Label>
              <Input
                id="sheetName"
                placeholder="Filter by name..."
                value={sheetNameFilter}
                onChange={(e) => setSheetNameFilter(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="author">Author</Label>
              <Input
                id="author"
                placeholder="Filter by author..."
                value={authorFilter}
                onChange={(e) => setAuthorFilter(e.target.value)}
              />
            </div>

            <Button
              className="w-full bg-cyan hover:bg-cyan/90 text-cyan-foreground"
              onClick={handleSearch}
            >
              SEARCH
            </Button>
          </div>
        </Card>
      </div>

      <PdfViewerModal
        isOpen={pdfModalOpen}
        onClose={() => {
          setPdfModalOpen(false);
          setSelectedPdf(null);
        }}
        pdfUrl={selectedPdf?.url || null}
        title={selectedPdf?.title || ""}
        onDownload={() => {
          if (selectedPdf?.url) {
            const link = document.createElement("a");
            link.href = selectedPdf.url;
            link.download = `${selectedPdf.title}.pdf`;
            link.target = "_blank";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }
        }}
      />

      <CompareDocumentsModal
        isOpen={compareModalOpen}
        onClose={() => {
          setCompareModalOpen(false);
          setCompareVersions([]);
          setCompareDrawingNo("");
        }}
        versions={compareVersions}
        drawingNo={compareDrawingNo}
      />

      {selectedProjectId && (
        <AddDrawingDialog
          isOpen={addDrawingOpen}
          onClose={() => setAddDrawingOpen(false)}
          projectId={selectedProjectId}
          onDrawingAdded={fetchDrawings}
        />
      )}

      <UploadPdfDialog
        isOpen={uploadPdfOpen}
        onClose={() => {
          setUploadPdfOpen(false);
          setSelectedDrawingForAction(null);
        }}
        drawing={selectedDrawingForAction}
        onPdfUploaded={fetchDrawings}
      />

      <DeleteDrawingDialog
        isOpen={deleteDrawingOpen}
        onClose={() => {
          setDeleteDrawingOpen(false);
          setSelectedDrawingForAction(null);
        }}
        drawing={selectedDrawingForAction}
        onDrawingDeleted={fetchDrawings}
      />
    </div>
  );
};

export default ShopDrawingTable;
