import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function uploadToCloudinary(
  buffer: Buffer,
  folder: string,
  originalName: string
): Promise<{ url: string; name: string }> {
  return new Promise((resolve, reject) => {
    const ext = originalName.split(".").pop()?.toLowerCase() || "bin";
    const resourceType = ["jpg","jpeg","png","gif","webp","svg","bmp","tiff"].includes(ext)
      ? "image"
      : ["mp4","mov","avi","mkv","webm"].includes(ext)
      ? "video"
      : "raw";

    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType as any,
        use_filename: false,
        unique_filename: true,
      },
      (error, result) => {
        if (error || !result) return reject(error || new Error("Upload failed"));
        resolve({ url: result.secure_url, name: originalName });
      }
    );
    stream.end(buffer);
  });
}

/**
 * Extract Cloudinary public_id and resource_type from a Cloudinary URL.
 * URL format: https://res.cloudinary.com/<cloud>/<resource_type>/upload/[v<ver>/]<public_id>[.ext]
 */
function parseCloudinaryUrl(url: string): { publicId: string; resourceType: string } | null {
  try {
    const match = url.match(/\/(?:image|video|raw)\/upload\/(?:v\d+\/)?(.+)/);
    const typeMatch = url.match(/res\.cloudinary\.com\/[^/]+\/(image|video|raw)\//);
    if (!match || !typeMatch) return null;
    const resourceType = typeMatch[1];
    let publicId = match[1];
    if (resourceType !== "raw") {
      publicId = publicId.replace(/\.[^/.]+$/, "");
    }
    return { publicId, resourceType };
  } catch {
    return null;
  }
}

/**
 * Delete a single Cloudinary file by URL. Returns true if deleted, false if skipped/failed.
 */
export async function deleteFromCloudinaryUrl(url: string): Promise<boolean> {
  if (!url || !url.includes("cloudinary.com")) return false;
  const parsed = parseCloudinaryUrl(url);
  if (!parsed) return false;
  try {
    const result = await cloudinary.uploader.destroy(parsed.publicId, {
      resource_type: parsed.resourceType as any,
      invalidate: true,
    });
    return result.result === "ok" || result.result === "not found";
  } catch {
    return false;
  }
}

/**
 * Delete multiple Cloudinary files by URL array. Returns count of deleted files.
 */
export async function deleteCloudinaryUrls(urls: string[]): Promise<number> {
  const results = await Promise.all(urls.map(url => deleteFromCloudinaryUrl(url)));
  return results.filter(Boolean).length;
}
