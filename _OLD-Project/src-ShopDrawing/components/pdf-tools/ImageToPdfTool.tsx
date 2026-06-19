import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Upload, Download, Loader2, X, FileImage, GripVertical } from "lucide-react";
import { jsPDF } from "jspdf";

type Orientation = "portrait" | "landscape";
type Fit = "fit" | "fill" | "stretch";

interface ImageFile {
  id: string;
  file: File;
  preview: string;
}

const ImageToPdfTool = () => {
  const { toast } = useToast();
  const [images, setImages] = useState<ImageFile[]>([]);
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [fit, setFit] = useState<Fit>("fit");
  const [converting, setConverting] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    addImages(files);
    e.target.value = "";
  }, []);

  const addImages = (files: File[]) => {
    const validFiles = files.filter(
      (f) => f.type === "image/jpeg" || f.type === "image/png"
    );

    if (validFiles.length !== files.length) {
      toast({
        title: "Some files skipped",
        description: "Only JPG and PNG images are supported",
        variant: "destructive",
      });
    }

    const newImages: ImageFile[] = validFiles.map((file) => ({
      id: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
    }));

    setImages((prev) => [...prev, ...newImages]);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    addImages(files);
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const removeImage = (id: string) => {
    setImages((prev) => {
      const img = prev.find((i) => i.id === id);
      if (img) URL.revokeObjectURL(img.preview);
      return prev.filter((i) => i.id !== id);
    });
  };

  const clearAll = () => {
    images.forEach((img) => URL.revokeObjectURL(img.preview));
    setImages([]);
  };

  // Drag reorder handlers
  const handleDragStart = (id: string) => {
    setDraggedId(id);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
  };

  const handleDragOverItem = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;

    setImages((prev) => {
      const draggedIndex = prev.findIndex((i) => i.id === draggedId);
      const targetIndex = prev.findIndex((i) => i.id === targetId);
      if (draggedIndex === -1 || targetIndex === -1) return prev;

      const newImages = [...prev];
      const [dragged] = newImages.splice(draggedIndex, 1);
      newImages.splice(targetIndex, 0, dragged);
      return newImages;
    });
  };

  const handleConvert = async () => {
    if (images.length === 0) return;

    setConverting(true);

    try {
      // A4 dimensions in mm
      const a4Width = 210;
      const a4Height = 297;

      const pageWidth = orientation === "portrait" ? a4Width : a4Height;
      const pageHeight = orientation === "portrait" ? a4Height : a4Width;

      const pdf = new jsPDF({
        orientation,
        unit: "mm",
        format: "a4",
      });

      for (let i = 0; i < images.length; i++) {
        if (i > 0) pdf.addPage();

        const img = images[i];
        const imgData = await loadImageAsDataUrl(img.file);
        const dimensions = await getImageDimensions(img.file);

        const { x, y, width, height } = calculateImagePlacement(
          dimensions.width,
          dimensions.height,
          pageWidth,
          pageHeight,
          fit
        );

        pdf.addImage(imgData, "JPEG", x, y, width, height);
      }

      pdf.save("images.pdf");

      toast({
        title: "Success",
        description: `${images.length} image${images.length > 1 ? "s" : ""} converted to PDF`,
      });
    } catch (error) {
      console.error("Error converting images:", error);
      toast({
        title: "Error",
        description: "Failed to convert images. Please try again.",
        variant: "destructive",
      });
    } finally {
      setConverting(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-4">
          {images.length === 0 ? (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-primary/50 transition-colors"
            >
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-2">
                Drag and drop images here, or click to select
              </p>
              <input
                type="file"
                accept=".jpg,.jpeg,.png"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                id="image-file-input"
              />
              <Button variant="outline" asChild>
                <label htmlFor="image-file-input" className="cursor-pointer">
                  Select Images
                </label>
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Supports JPG and PNG formats
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Image list */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {images.map((img) => (
                  <div
                    key={img.id}
                    draggable
                    onDragStart={() => handleDragStart(img.id)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleDragOverItem(e, img.id)}
                    className={`relative group border rounded-lg overflow-hidden bg-muted/50 cursor-move ${
                      draggedId === img.id ? "opacity-50" : ""
                    }`}
                  >
                    <div className="aspect-square">
                      <img
                        src={img.preview}
                        alt={img.file.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-white hover:text-white hover:bg-white/20"
                        onClick={() => removeImage(img.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="absolute top-1 left-1 bg-black/50 rounded p-0.5">
                      <GripVertical className="h-3 w-3 text-white" />
                    </div>
                    <p className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 truncate">
                      {img.file.name}
                    </p>
                  </div>
                ))}

                {/* Add more button */}
                <label
                  htmlFor="add-more-images"
                  className="aspect-square border-2 border-dashed border-muted-foreground/25 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors"
                >
                  <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                  <span className="text-xs text-muted-foreground">Add more</span>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                    id="add-more-images"
                  />
                </label>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Drag images to reorder • {images.length} image{images.length > 1 ? "s" : ""} selected
              </p>

              {/* Options */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Page Orientation</Label>
                  <Select
                    value={orientation}
                    onValueChange={(val: Orientation) => setOrientation(val)}
                    disabled={converting}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="portrait">Portrait</SelectItem>
                      <SelectItem value="landscape">Landscape</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Image Fit</Label>
                  <Select
                    value={fit}
                    onValueChange={(val: Fit) => setFit(val)}
                    disabled={converting}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fit">Fit (maintain ratio)</SelectItem>
                      <SelectItem value="fill">Fill (crop to fit)</SelectItem>
                      <SelectItem value="stretch">Stretch</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            {images.length > 0 && (
              <Button variant="outline" onClick={clearAll} disabled={converting}>
                Clear All
              </Button>
            )}
            <Button
              onClick={handleConvert}
              disabled={images.length === 0 || converting}
              className="bg-primary hover:bg-primary/90"
            >
              {converting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Converting...
                </>
              ) : (
                <>
                  <FileImage className="h-4 w-4 mr-2" />
                  Convert to PDF
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Helper functions
function loadImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function calculateImagePlacement(
  imgWidth: number,
  imgHeight: number,
  pageWidth: number,
  pageHeight: number,
  fit: Fit
): { x: number; y: number; width: number; height: number } {
  const margin = 10; // mm
  const availableWidth = pageWidth - margin * 2;
  const availableHeight = pageHeight - margin * 2;

  const imgRatio = imgWidth / imgHeight;
  const pageRatio = availableWidth / availableHeight;

  let width: number;
  let height: number;

  if (fit === "stretch") {
    width = availableWidth;
    height = availableHeight;
  } else if (fit === "fill") {
    // Fill: image covers the area, may crop
    if (imgRatio > pageRatio) {
      height = availableHeight;
      width = height * imgRatio;
    } else {
      width = availableWidth;
      height = width / imgRatio;
    }
  } else {
    // Fit: image fits within, maintains ratio
    if (imgRatio > pageRatio) {
      width = availableWidth;
      height = width / imgRatio;
    } else {
      height = availableHeight;
      width = height * imgRatio;
    }
  }

  // Center the image
  const x = margin + (availableWidth - width) / 2;
  const y = margin + (availableHeight - height) / 2;

  return { x, y, width, height };
}

export default ImageToPdfTool;
