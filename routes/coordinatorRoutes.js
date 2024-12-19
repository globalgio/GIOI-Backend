// routes/coordinatorRoutes.js
const express = require("express");
const {
  coordinatorRegister,
  coordinatorLogin,
  updateProfile,
  getProfile,
  bulkUploadStudents,
  getStudentsByCoordinator,
  calculateIncentives,
  getPartnerRank,
  verifyCoordinatorDetails,
  getLeaderboard,
  getAchievements,
  updateStudentPaymentStatus,
  getCoordinatorTestCounts,
} = require("../controllers/coordinatorController");
const coordinatorAuth = require("../middleware/coordinatorAuth");
const upload = require("../middleware/multer");

const router = express.Router();

// Registration and Login
router.post("/register", coordinatorRegister);
router.post("/login", coordinatorLogin);

// Profile Management
router.put("/update-profile", coordinatorAuth, updateProfile);
router.get("/profile", coordinatorAuth, getProfile);

// Student Management
router.post(
  "/bulk-upload",
  coordinatorAuth,
  upload.single("file"),
  bulkUploadStudents
);
router.get("/students", coordinatorAuth, getStudentsByCoordinator);

// Verification Endpoint
router.post("/verify-details", coordinatorAuth, verifyCoordinatorDetails);

// New endpoints for incentives and ranking
router.post("/calculate-incentives", coordinatorAuth, calculateIncentives);
router.get("/rank", coordinatorAuth, getPartnerRank);

router.get("/leaderboard", coordinatorAuth, getLeaderboard);

router.get("/achievements", coordinatorAuth, getAchievements);

router.get("/test-counts", coordinatorAuth, getCoordinatorTestCounts);


module.exports = router;
