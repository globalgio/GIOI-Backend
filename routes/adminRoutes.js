const upload = require("../middleware/multer");
const express = require("express");
const router = express.Router();
const {
  adminLogin,
  registerAdmin,
  getAllStudents,
  generateRefCode,
  validateRefCode,
  viewRefCodes,
  getAllSchools,
  getApprovedCoordinators,
  bulkUploadStudents,
  updateUserProfile,
  getAllCoordinator,
  approveCoordinator,
  getPendingCoordinators,
  deleteCoordinator,
  updateOrDeleteSchool,
} = require("../controllers/admiController");
const authenticateAdmin = require("../middleware/authAdmin");

// Admin Login Route
router.post("/login", adminLogin);

// Admin Register Route
router.post("/register", registerAdmin);

// Get all students route
router.get("/students", getAllStudents);

// View all reference codes route
router.get("/reference-codes", authenticateAdmin, viewRefCodes);

// Validate reference code route
router.post("/validate-reference-code", validateRefCode);

// Generate reference code route
router.post("/generate-reference-code", authenticateAdmin, generateRefCode);
router.get("/schools", authenticateAdmin, getAllSchools);
router.get("/coordinator", authenticateAdmin, getApprovedCoordinators);
router.post(
  "/bulk-upload",
  upload.single("file"),
  authenticateAdmin,
  bulkUploadStudents
);
// Update student details
router.post("/adminreq/students", authenticateAdmin, updateUserProfile);
router.post("/schools/update-or-delete", updateOrDeleteSchool);
// Get all coordinators route
router.get("/coordinators", authenticateAdmin, getAllCoordinator);
router.post("/coordinators/approve", authenticateAdmin, approveCoordinator);
router.delete("/coordinators/delete", authenticateAdmin, deleteCoordinator);
router.get("/coordinators/pending", getPendingCoordinators);
router.get("/coordinators/approved", getApprovedCoordinators);
module.exports = router;
