const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure 'uploads' directory exists
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // Save uploaded files to 'uploads' directory
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

// File filter to accept only Excel files
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase(); // Case insensitive
  if (ext === ".xlsx" || ext === ".xls") {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type: ${ext}. Only Excel files are allowed.`), false);
  }
};

// Multer configuration
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB file size limit
  },
});

module.exports = upload;
