const express = require("express");
const router = express.Router();
const {
  adminLogin,
  registerAdmin,
  getAllStudents,
  viewRefCodes,
  validateRefCode,
  generateRefCode,
} = require("../controllers/admiController");
const authenticateAdmin = require("../middleware/authAdmin");

// Admin Login Route
router.post("/login", adminLogin);

// Admin Register Route
router.post("/register", registerAdmin);

// Get all students route
router.get("/students", authenticateAdmin, getAllStudents);

// View all reference codes route
router.get("/reference-codes", authenticateAdmin, viewRefCodes);

// Validate reference code route
router.post("/validate-reference-code", validateRefCode);

// Generate reference code route
router.post("/generate-reference-code", authenticateAdmin, generateRefCode);

module.exports = router;
