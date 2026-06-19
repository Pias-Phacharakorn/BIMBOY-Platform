import { supabase } from "@/integrations/supabase/client";

type StorageRef = { bucket: string; path: string };

/**
 * Extract bucket + object path from a storage *public* URL, or treat non-URL strings as a path.
 * Returns null for signed URLs (already usable) or external URLs.
 */
function extractStorageRef(pdfUrlOrPath: string): StorageRef | null {
  if (!pdfUrlOrPath) return null;

  // Signed URL: already valid for access
  if (pdfUrlOrPath.includes("/storage/v1/object/sign/")) return null;

  // Public URL: /storage/v1/object/public/<bucket>/<path>
  const publicUrlPattern = /\/storage\/v1\/object\/public\/([^/]+)\/(.+?)(?:\?.*)?$/;
  const match = pdfUrlOrPath.match(publicUrlPattern);
  if (match) {
    return { bucket: match[1], path: match[2] };
  }

  // Not a URL => treat as a path in our default bucket
  if (!pdfUrlOrPath.startsWith("http")) {
    return { bucket: "shop-drawing-pdfs", path: pdfUrlOrPath };
  }

  // External URL (or unrecognized URL format)
  return null;
}

/**
 * Generates a signed URL for accessing a PDF from the shop-drawing-pdfs bucket
 * Falls back to the original URL if signed URL generation fails
 * @param pdfUrl - The PDF URL or storage path
 * @param expiresIn - Expiration time in seconds (default: 1 hour)
 * @returns A signed URL or the original URL
 */
export async function getSignedPdfUrl(
  pdfUrl: string,
  expiresIn: number = 3600
): Promise<string> {
  if (!pdfUrl) return pdfUrl;

  // Already signed => use as-is
  if (pdfUrl.includes("/storage/v1/object/sign/")) return pdfUrl;

  const ref = extractStorageRef(pdfUrl);
  if (!ref) return pdfUrl; // external URL or unrecognized

  try {
    const { data, error } = await supabase.storage
      .from(ref.bucket)
      .createSignedUrl(ref.path, expiresIn);

    if (error) {
      console.error('Error creating signed URL:', error);
      return pdfUrl; // Fall back to original URL
    }

    return data.signedUrl;
  } catch (error) {
    console.error('Failed to generate signed URL:', error);
    return pdfUrl;
  }
}

/**
 * Downloads a PDF using a signed URL
 * @param pdfUrl - The PDF URL or storage path
 * @param filename - The desired filename for download
 */
export async function downloadPdfWithSignedUrl(
  pdfUrl: string,
  filename: string
): Promise<void> {
  try {
    const signedUrl = await getSignedPdfUrl(pdfUrl);
    
    // Fetch the PDF content
    const response = await fetch(signedUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.status}`);
    }
    
    const blob = await response.blob();
    
    // Create download link
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Download failed:', error);
    // Fallback: open in new tab
    const signedUrl = await getSignedPdfUrl(pdfUrl);
    window.open(signedUrl, '_blank');
  }
}
