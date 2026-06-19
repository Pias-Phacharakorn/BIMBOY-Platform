import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MergePdfTool from "@/components/pdf-tools/MergePdfTool";
import SplitPdfTool from "@/components/pdf-tools/SplitPdfTool";
import PdfToJpgTool from "@/components/pdf-tools/PdfToJpgTool";
import ImageToPdfTool from "@/components/pdf-tools/ImageToPdfTool";
import ComparePdfTool from "@/components/pdf-tools/ComparePdfTool";
import CompressPdfTool from "@/components/pdf-tools/CompressPdfTool";
import OrganizePdfTool from "@/components/pdf-tools/OrganizePdfTool";
import OcrPdfTool from "@/components/pdf-tools/OcrPdfTool";
import PdfToWordTool from "@/components/pdf-tools/PdfToWordTool";
import PdfToExcelTool from "@/components/pdf-tools/PdfToExcelTool";
import { Combine, Scissors, FileText, Image, GitCompareArrows, Archive, LayoutGrid, ScanText, FileType, Sheet } from "lucide-react";

const PdfTools = () => {
  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">PDF Tools</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Merge, split, compress, organize, convert, compare and OCR PDF documents
        </p>
      </div>

      <Tabs defaultValue="merge" className="w-full">
        <TabsList className="grid w-full grid-cols-4 md:grid-cols-5 lg:grid-cols-10 mb-6 h-auto">
          <TabsTrigger value="merge" className="flex items-center gap-2"><Combine className="h-4 w-4" /><span className="hidden sm:inline">Merge</span></TabsTrigger>
          <TabsTrigger value="split" className="flex items-center gap-2"><Scissors className="h-4 w-4" /><span className="hidden sm:inline">Split</span></TabsTrigger>
          <TabsTrigger value="compress" className="flex items-center gap-2"><Archive className="h-4 w-4" /><span className="hidden sm:inline">Compress</span></TabsTrigger>
          <TabsTrigger value="organize" className="flex items-center gap-2"><LayoutGrid className="h-4 w-4" /><span className="hidden sm:inline">Organize</span></TabsTrigger>
          <TabsTrigger value="pdf-to-jpg" className="flex items-center gap-2"><FileText className="h-4 w-4" /><span className="hidden sm:inline">To JPG</span></TabsTrigger>
          <TabsTrigger value="img-to-pdf" className="flex items-center gap-2"><Image className="h-4 w-4" /><span className="hidden sm:inline">To PDF</span></TabsTrigger>
          <TabsTrigger value="pdf-to-word" className="flex items-center gap-2"><FileType className="h-4 w-4" /><span className="hidden sm:inline">To Word</span></TabsTrigger>
          <TabsTrigger value="pdf-to-excel" className="flex items-center gap-2"><Sheet className="h-4 w-4" /><span className="hidden sm:inline">To Excel</span></TabsTrigger>
          <TabsTrigger value="ocr" className="flex items-center gap-2"><ScanText className="h-4 w-4" /><span className="hidden sm:inline">OCR</span></TabsTrigger>
          <TabsTrigger value="compare" className="flex items-center gap-2"><GitCompareArrows className="h-4 w-4" /><span className="hidden sm:inline">Compare</span></TabsTrigger>
        </TabsList>

        <TabsContent value="merge"><MergePdfTool /></TabsContent>
        <TabsContent value="split"><SplitPdfTool /></TabsContent>
        <TabsContent value="compress"><CompressPdfTool /></TabsContent>
        <TabsContent value="organize"><OrganizePdfTool /></TabsContent>
        <TabsContent value="pdf-to-jpg"><PdfToJpgTool /></TabsContent>
        <TabsContent value="img-to-pdf"><ImageToPdfTool /></TabsContent>
        <TabsContent value="pdf-to-word"><PdfToWordTool /></TabsContent>
        <TabsContent value="pdf-to-excel"><PdfToExcelTool /></TabsContent>
        <TabsContent value="ocr"><OcrPdfTool /></TabsContent>
        <TabsContent value="compare"><ComparePdfTool /></TabsContent>
      </Tabs>
    </div>
  );
};

export default PdfTools;
