import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import QrScannerLib from "qr-scanner";
import { Camera, Check, X, RotateCcw, FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import PdfViewerModal from "@/components/PdfViewerModal";
import { toast } from "sonner";
import { getSignedPdfUrl, downloadPdfWithSignedUrl } from "@/lib/pdfUtils";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { useActiveProject } from "@/hooks/useActiveProject";

const QRScanner = () => {
  const navigate = useNavigate();
  const [scanning, setScanning] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    isValid: boolean;
    drawingNo: string;
    scannedRevision: number;
    latestRevision: number;
    name?: string;
    pdfUrl?: string;
  } | null>(null);
  const { selectedProject } = useActiveProject();
  const [error, setError] = useState<string>("");
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [pdfViewerUrl, setPdfViewerUrl] = useState<string | null>(null);
  const [pdfViewerTitle, setPdfViewerTitle] = useState<string>("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerRef = useRef<QrScannerLib | null>(null);
  const haptic = useHapticFeedback();
  useEffect(() => {
    // Check authentication
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
      }
    };
    checkAuth();

    // Cleanup scanner on unmount
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop();
        scannerRef.current.destroy();
        scannerRef.current = null;
      }
    };
  }, [navigate]);

  const startScanning = async () => {
    try {
      setScanning(true);
      setValidationResult(null);
      setError("");

      // Wait for video element to be ready
      await new Promise(resolve => setTimeout(resolve, 100));

      if (!videoRef.current) {
        throw new Error("Video element not found");
      }

      // Check camera permission
      await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });

      // Initialize scanner
      scannerRef.current = new QrScannerLib(
        videoRef.current,
        (result) => onScanSuccess(result.data),
        {
          highlightScanRegion: true,
          highlightCodeOutline: true,
          preferredCamera: "environment",
          maxScansPerSecond: 5,
        }
      );

      await scannerRef.current.start();
      toast.success("Camera ready. Point at a QR code to scan.");
    } catch (error) {
      console.error("Scanner error:", error);
      const message = error instanceof Error ? error.message : "Failed to start camera";
      setError(message);
      toast.error(message);
      setScanning(false);
    }
  };

  const stopScanning = () => {
    if (scannerRef.current) {
      scannerRef.current.stop();
      scannerRef.current.destroy();
      scannerRef.current = null;
    }
    setScanning(false);
  };

  const onScanSuccess = async (decodedText: string) => {
    console.log("QR scanned");
    stopScanning();

    // Sanitize input - remove any HTML tags or potentially dangerous characters
    const sanitizedText = decodedText
      .replace(/[<>"'&]/g, '') // Remove HTML-sensitive characters
      .trim()
      .substring(0, 100); // Enforce maximum length

    // Validate format strictly - only allow alphanumeric, dash, underscore, and _R followed by digits
    const match = sanitizedText.match(/^([A-Za-z0-9_-]+)_R(\d+)$/i);
    
    if (!match) {
      // For invalid format, show generic error without displaying the scanned content
      toast.error("Invalid QR code format. Expected format: SheetNo_RRevision");
      setValidationResult({
        isValid: false,
        drawingNo: "Unknown",
        scannedRevision: 0,
        latestRevision: 0,
      });
      return;
    }

    const drawingNo = match[1];
    const scannedRevision = parseInt(match[2]);

    // Validate parsed values
    if (drawingNo.length > 50) {
      toast.error("Invalid QR code: drawing number too long");
      return;
    }

    if (scannedRevision > 999 || scannedRevision < 0) {
      toast.error("Invalid QR code: revision number out of range");
      return;
    }

    // Fetch the latest drawing from database (is_latest = true)
    const { data: drawing, error: drawingError } = await supabase
      .from("shop_drawings")
      .select("current_revision, name, project_id, pdf_url")
      .eq("no", drawingNo)
      .eq("project_id", selectedProject)
      .eq("is_latest", true)
      .maybeSingle();

    if (drawingError) {
      console.error("Error fetching drawing:", drawingError);
    }

    const isValid = drawing ? drawing.current_revision === scannedRevision : false;
    const latestRevision = drawing?.current_revision ?? 0;

    // Save scan activity
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { error: insertError } = await supabase.from("scan_activities").insert({
        user_id: user.id,
        project_id: selectedProject || null,
        drawing_no: drawingNo,
        scanned_revision: scannedRevision,
        latest_revision: latestRevision,
        is_valid: isValid,
      });
      
      if (insertError) {
        console.error("Error saving scan activity:", insertError);
      }
    }

    // Trigger haptic feedback (cross-platform: Android via Vibration API, iOS via AudioContext)
    haptic.trigger(isValid);

    // Show toast notification with matching colors
    if (isValid) {
      toast.success(
        `${drawingNo}_R${scannedRevision} ${drawing?.name || ''}\nที่คุณถืออยู่อัพเดต Revision ล่าสุดแล้ว`,
        { 
          duration: 5000,
          style: { backgroundColor: '#22c55e', color: 'white' }
        }
      );
    } else {
      toast.error(
        `${drawingNo}_R${scannedRevision} ${drawing?.name || ''}\nไม่อัพเดต Revision ล่าสุดคือ R${latestRevision} โปรดอัพเดตให้เป็น Revision ใหม่`,
        { 
          duration: 5000,
          style: { backgroundColor: '#ef4444', color: 'white' }
        }
      );
    }

    setValidationResult({
      isValid,
      drawingNo,
      scannedRevision,
      latestRevision,
      name: drawing?.name,
      pdfUrl: drawing?.pdf_url ?? undefined,
    });
  };

  const handleCheckAnother = () => {
    setValidationResult(null);
    setError("");
  };

  const handleOpenPdf = async () => {
    if (!validationResult?.pdfUrl) {
      toast.error("ไม่พบไฟล์ PDF สำหรับแบบนี้");
      return;
    }

    try {
      const signedUrl = await getSignedPdfUrl(validationResult.pdfUrl);
      const title = validationResult.isValid 
        ? `${validationResult.drawingNo}_R${validationResult.scannedRevision}`
        : `${validationResult.drawingNo}_R${validationResult.latestRevision} (Revision ล่าสุด)`;
      
      setPdfViewerUrl(signedUrl);
      setPdfViewerTitle(title);
      setPdfViewerOpen(true);
    } catch (error) {
      console.error("Error opening PDF:", error);
      toast.error("ไม่สามารถเปิด PDF ได้");
    }
  };

  if (!selectedProject) {
    return (
      <div className="container mx-auto px-6 py-8 animate-fade-in">
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <h2 className="text-2xl font-bold text-foreground mb-4">Select a Project</h2>
          <p className="text-muted-foreground text-lg">
            Please select a project from the sidebar to start scanning QR codes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 md:px-6 py-6 max-w-2xl animate-fade-in">
      <>

        {!validationResult ? (
          <Card className="p-8">
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
                <Camera className="w-12 h-12 text-primary" />
              </div>
              
              <div>
                <h1 className="text-3xl font-bold text-foreground mb-2">Shop Drawing Scanner</h1>
                <p className="text-muted-foreground">
                  Tap the button below to scan a QR code and validate your shop drawing
                </p>
              </div>

              {!scanning ? (
                <Button 
                  onClick={startScanning}
                  size="lg"
                  className="w-full max-w-sm"
                >
                  <Camera className="mr-2" />
                  Start Scanning
                </Button>
              ) : (
                <div className="w-full space-y-4">
                  {error && (
                    <div className="bg-destructive/10 text-destructive p-4 rounded-lg text-sm">
                      {error}
                    </div>
                  )}
                  <video 
                    ref={videoRef}
                    className="w-full rounded-lg"
                    style={{ maxHeight: "400px" }}
                  />
                  <Button 
                    onClick={stopScanning}
                    variant="outline"
                    className="w-full"
                  >
                    Stop Scanning
                  </Button>
                </div>
              )}
            </div>
          </Card>
        ) : (
          <div className="flex flex-col items-center justify-center space-y-6">
            <div className="text-center space-y-4">
              {validationResult.isValid ? (
                <>
                  <div className="mx-auto w-28 h-28 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(34,197,94,0.4)]">
                    <Check className="w-14 h-14 text-white" strokeWidth={3} />
                  </div>
                  <h2 className="text-2xl font-bold text-green-600">Valid Shop Drawing!</h2>
                  <div className="text-center max-w-md space-y-3">
                    <div className="bg-green-500/10 px-4 py-3 rounded-lg">
                      <p className="font-mono text-base text-green-600 font-bold">
                        {validationResult.drawingNo}_R{validationResult.scannedRevision}
                      </p>
                    </div>
                    {validationResult.name && (
                      <div className="bg-muted px-3 py-2 rounded">
                        <p className="text-base text-muted-foreground font-medium">{validationResult.name}</p>
                      </div>
                    )}
                    <p className="text-foreground text-base leading-relaxed">
                      ที่คุณถืออยู่อัพเดต Revision ล่าสุดแล้ว
                    </p>
                  </div>
                  <Card className="p-4">
                    <div className="text-center">
                      <p className="font-mono text-base font-bold break-all">
                        {validationResult.drawingNo}_R{validationResult.scannedRevision}
                      </p>
                    </div>
                  </Card>
                  {/* PDF Actions */}
                  {validationResult.pdfUrl && (
                    <div className="flex gap-2 w-full max-w-sm">
                      <Button 
                        variant="outline"
                        onClick={handleOpenPdf}
                        className="flex-1 border-green-500 text-green-600 hover:bg-green-50"
                      >
                        <FileText className="w-5 h-5 mr-2" />
                        ดู PDF
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => {
                          const sanitizedName = (validationResult.name || 'Unnamed').replace(/[^a-zA-Z0-9\-_]/g, '-');
                          downloadPdfWithSignedUrl(
                            validationResult.pdfUrl!,
                            `${validationResult.drawingNo}_${sanitizedName}_R${validationResult.scannedRevision}.pdf`
                          );
                        }}
                        className="border-green-500 text-green-600 hover:bg-green-50"
                      >
                        <Download className="w-5 h-5" />
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="mx-auto w-28 h-28 bg-gradient-to-br from-red-400 to-red-600 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(239,68,68,0.4)]">
                    <X className="w-14 h-14 text-white" strokeWidth={3} />
                  </div>
                  <h2 className="text-2xl font-bold text-destructive">Invalid Shop Drawing</h2>
                  <div className="text-center max-w-md space-y-3">
                    <div className="bg-destructive/10 px-4 py-3 rounded-lg">
                      <p className="font-mono text-base text-destructive font-bold">
                        {validationResult.drawingNo}_R{validationResult.scannedRevision}
                      </p>
                    </div>
                    {validationResult.name && (
                      <div className="bg-muted px-3 py-2 rounded">
                        <p className="text-base text-muted-foreground font-medium">{validationResult.name}</p>
                      </div>
                    )}
                    <p className="text-foreground text-base leading-relaxed">
                      ไม่อัพเดต Revision ล่าสุดคือ R{validationResult.latestRevision}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      โปรดอัพเดตให้เป็น Revision ใหม่
                    </p>
                  </div>
                  <Card className="p-4">
                    <div className="text-center">
                      <p className="font-mono text-base font-bold break-all">
                        Latest: {validationResult.drawingNo}_R{validationResult.latestRevision}
                      </p>
                    </div>
                  </Card>
                  {/* PDF Actions - opens latest revision */}
                  {validationResult.pdfUrl && (
                    <div className="flex gap-2 w-full max-w-sm">
                      <Button 
                        variant="outline"
                        onClick={handleOpenPdf}
                        className="flex-1 border-destructive text-destructive hover:bg-destructive/10"
                      >
                        <FileText className="w-5 h-5 mr-2" />
                        ดู PDF ล่าสุด (R{validationResult.latestRevision})
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => {
                          const sanitizedName = (validationResult.name || 'Unnamed').replace(/[^a-zA-Z0-9\-_]/g, '-');
                          downloadPdfWithSignedUrl(
                            validationResult.pdfUrl!,
                            `${validationResult.drawingNo}_${sanitizedName}_R${validationResult.latestRevision}.pdf`
                          );
                        }}
                        className="border-destructive text-destructive hover:bg-destructive/10"
                      >
                        <Download className="w-5 h-5" />
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
            <Button 
              onClick={handleCheckAnother}
              size="lg"
              className={`w-full max-w-sm h-16 text-lg font-semibold ${
                validationResult.isValid 
                  ? "bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-[0_4px_20px_rgba(34,197,94,0.3)]" 
                  : "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-[0_4px_20px_rgba(239,68,68,0.3)]"
              }`}
            >
              <RotateCcw className="w-6 h-6 mr-2" />
              Check Another Shop Drawing
            </Button>
          </div>
        )}
      </>

      {/* PDF Viewer Modal */}
      <PdfViewerModal
        isOpen={pdfViewerOpen}
        onClose={() => setPdfViewerOpen(false)}
        pdfUrl={pdfViewerUrl}
        title={pdfViewerTitle}
      />
    </div>
  );
};

export default QRScanner;
