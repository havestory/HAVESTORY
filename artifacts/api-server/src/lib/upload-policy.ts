import multer from "multer";

const SAFE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const SAFE_DOCUMENT_TYPES = new Set(["application/pdf"]);

type UploadPolicyOptions = {
  maxFileSize: number;
  maxFiles?: number;
  maxFields?: number;
  allowPdf?: boolean;
};

type UploadedFileLike = {
  buffer?: Buffer;
  mimetype?: string;
};

export function safeUpload({ maxFileSize, maxFiles = 1, maxFields = 30, allowPdf = false }: UploadPolicyOptions) {
  const allowed = allowPdf ? new Set([...SAFE_IMAGE_TYPES, ...SAFE_DOCUMENT_TYPES]) : SAFE_IMAGE_TYPES;
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxFileSize, files: maxFiles, fields: maxFields, parts: maxFiles + maxFields + 4 },
    fileFilter: (_req, file, cb) => {
      if (!allowed.has(String(file.mimetype || "").toLowerCase())) {
        const error = new Error(allowPdf ? "Unsupported file type. Upload an image or PDF." : "Unsupported file type. Upload a JPG, PNG, WebP, or GIF image.");
        Object.assign(error, { code: "INVALID_FILE_TYPE", status: 400 });
        return cb(error);
      }
      cb(null, true);
    },
  });
}

function startsWithBytes(buffer: Buffer, bytes: number[]): boolean {
  if (buffer.length < bytes.length) return false;
  return bytes.every((byte, index) => buffer[index] === byte);
}

function matchesDeclaredType(file: UploadedFileLike): boolean {
  const mime = String(file.mimetype || "").toLowerCase();
  const buffer = file.buffer;
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) return false;

  if (mime === "image/jpeg") return startsWithBytes(buffer, [0xff, 0xd8, 0xff]);
  if (mime === "image/png") return startsWithBytes(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (mime === "image/gif") return buffer.subarray(0, 6).toString("ascii") === "GIF87a" || buffer.subarray(0, 6).toString("ascii") === "GIF89a";
  if (mime === "image/webp") {
    return buffer.subarray(0, 4).toString("ascii") === "RIFF"
      && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  }
  if (mime === "application/pdf") return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  return false;
}

export function validateUploadedFile(file: UploadedFileLike | undefined): boolean {
  return matchesDeclaredType(file || {});
}

export function validateUploadedFiles(files: UploadedFileLike[] | undefined): boolean {
  return !files || files.every((file) => validateUploadedFile(file));
}
