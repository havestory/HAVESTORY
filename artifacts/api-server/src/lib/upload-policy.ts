import multer from "multer";

const SAFE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const SAFE_DOCUMENT_TYPES = new Set(["application/pdf"]);

type UploadPolicyOptions = {
  maxFileSize: number;
  maxFiles?: number;
  maxFields?: number;
  allowPdf?: boolean;
};

export function safeUpload({ maxFileSize, maxFiles = 1, maxFields = 30, allowPdf = false }: UploadPolicyOptions) {
  const allowed = allowPdf ? new Set([...SAFE_IMAGE_TYPES, ...SAFE_DOCUMENT_TYPES]) : SAFE_IMAGE_TYPES;
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxFileSize, files: maxFiles, fields: maxFields, parts: maxFiles + maxFields + 4 },
    fileFilter: (_req, file, cb) => {
      cb(null, allowed.has(String(file.mimetype || "").toLowerCase()));
    },
  });
}
