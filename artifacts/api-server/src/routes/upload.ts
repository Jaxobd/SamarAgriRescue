import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { currentUser, logActivity } from "../lib/agrirescue";

const router: IRouter = Router();

// Ensure upload directory exists
export const uploadsDir = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer storage
const allowedMimes = new Set(["image/jpeg", "image/png", "image/webp", "image/jpg"]);
const mimeToExt: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = mimeToExt[file.mimetype] || path.extname(file.originalname).toLowerCase() || ".jpg";
    cb(null, `${randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (_req, file, cb) => {
    if (allowedMimes.has(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file format. Only JPG, PNG, and WEBP images are supported."));
    }
  },
});

// Helper for auth
async function requireAuth(req: Request, res: Response) {
  const user = await currentUser(req.headers.cookie);
  if (!user) {
    res.status(401).json({ error: "Please sign in to upload files." });
    return null;
  }
  return user;
}

// POST /api/upload - Multipart or Base64 JSON
router.post("/", async (req: Request, res: Response): Promise<void> => {
  const user = await requireAuth(req, res);
  if (!user) return;

  // Check if this is a JSON base64 upload
  if (req.is("application/json") && req.body?.image) {
    try {
      const dataUri = String(req.body.image);
      const matches = dataUri.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
      if (!matches) {
        res.status(400).json({ error: "Invalid data URL format. Expected data:image/*;base64,..." });
        return;
      }
      const mime = matches[1].toLowerCase();
      if (!allowedMimes.has(mime)) {
        res.status(400).json({ error: "Invalid file format. Only JPG, PNG, and WEBP images are supported." });
        return;
      }
      const buffer = Buffer.from(matches[2], "base64");
      if (buffer.length > 5 * 1024 * 1024) {
        res.status(400).json({ error: "File exceeds maximum size limit of 5MB." });
        return;
      }
      const ext = mimeToExt[mime] || ".jpg";
      const filename = `${randomUUID()}${ext}`;
      const filePath = path.join(uploadsDir, filename);
      await fs.promises.writeFile(filePath, buffer);

      await logActivity({
        userId: user.id,
        type: "upload",
        action: "Product image uploaded",
        details: `Uploaded ${filename} (${(buffer.length / 1024).toFixed(1)} KB)`,
      });

      res.status(201).json({
        url: `/api/uploads/${filename}`,
        filename,
        size: buffer.length,
        mimeType: mime,
      });
      return;
    } catch (err: any) {
      res.status(500).json({ error: `Upload processing failed: ${err.message}` });
      return;
    }
  }

  // Handle multipart form upload
  upload.single("image")(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({ error: "File size exceeds the 5MB limit." });
        return;
      }
      res.status(400).json({ error: err.message || "Failed to upload image." });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: "No image file provided." });
      return;
    }

    await logActivity({
      userId: user.id,
      type: "upload",
      action: "Product image uploaded",
      details: `Uploaded ${req.file.filename} (${(req.file.size / 1024).toFixed(1)} KB)`,
    });

    res.status(201).json({
      url: `/api/uploads/${req.file.filename}`,
      filename: req.file.filename,
      size: req.file.size,
      mimeType: req.file.mimetype,
    });
  });
});

// DELETE /api/upload/:filename
router.delete("/:filename", async (req: Request, res: Response): Promise<void> => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const filenameParam = Array.isArray(req.params.filename) ? req.params.filename[0] : req.params.filename;
  const safeFilename = path.basename(filenameParam);
  const filePath = path.join(uploadsDir, safeFilename);

  if (fs.existsSync(filePath)) {
    try {
      await fs.promises.unlink(filePath);
      await logActivity({
        userId: user.id,
        type: "upload",
        action: "Product image deleted",
        details: `Deleted ${safeFilename}`,
      });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to delete file from storage." });
      return;
    }
  }

  res.json({ success: true, message: "File removed" });
});

export default router;
