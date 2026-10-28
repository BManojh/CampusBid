const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { v2: cloudinary } = require("cloudinary");
const { requireAuth, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();
const uploadDirectory = path.join(__dirname, "..", "uploads");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 6 },
  fileFilter: (req, file, callback) => {
    callback(null, ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype));
  },
});

const cloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (cloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

function uploadBuffer(buffer) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream({ folder: "campusbid/listings", resource_type: "image" }, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    }).end(buffer);
  });
}

function hasValidImageSignature(file) {
  const buffer = file.buffer;
  if (file.mimetype === "image/png") {
    return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }
  if (file.mimetype === "image/jpeg") {
    return buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255]));
  }
  if (file.mimetype === "image/webp") {
    return buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP";
  }
  return false;
}

router.post("/", requireAuth, requireRole("SELLER", "ADMIN"), upload.array("images", 6), async (req, res, next) => {
  try {
    if (!req.files?.length) return res.status(400).json({ message: "Choose at least one JPEG, PNG, or WebP image." });
    if (req.files.some((file) => !hasValidImageSignature(file))) {
      return res.status(400).json({ code: "INVALID_IMAGE", message: "One or more files are not valid JPEG, PNG, or WebP images." });
    }

    if (!cloudinaryConfigured) {
      await fs.promises.mkdir(uploadDirectory, { recursive: true });
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const images = [];
      for (const file of req.files) {
        const extension = file.mimetype === "image/png" ? "png" : file.mimetype === "image/webp" ? "webp" : "jpg";
        const filename = `${crypto.randomUUID()}.${extension}`;
        await fs.promises.writeFile(path.join(uploadDirectory, filename), file.buffer);
        images.push({ url: `${baseUrl}/uploads/${filename}`, publicId: `local:${filename}` });
      }
      return res.status(201).json({ success: true, storage: "local-development", data: images });
    }

    const results = await Promise.all(req.files.map((file) => uploadBuffer(file.buffer)));
    res.status(201).json({ success: true, data: results.map((result) => ({ url: result.secure_url, publicId: result.public_id })) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
