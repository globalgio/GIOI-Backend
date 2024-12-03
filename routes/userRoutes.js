const express = require("express");
const {
  registerUser,
  loginUser,
  getUserProfile,
  saveQuizMarks,
  getUserRankings,
  updatePaymentStatus,
  getTestCounts,
} = require("../controllers/userController");
const { verifyToken } = require("../middleware/verifyToken");

const router = express.Router();

// Register route
router.post("/register", registerUser);

// Login route
router.post("/login", loginUser);

// Route to fetch the user's profile data
router.get("/gio-profile", verifyToken, getUserProfile);

// Route to get user rankings
router.get("/get-rank", verifyToken, getUserRankings);
// Route to save quiz marks and update rankings
router.post("/save-quiz-marks", verifyToken, saveQuizMarks);

// Route to update payment or test completion status
router.patch("/update-payment-status", verifyToken, updatePaymentStatus);

router.get("/get-test-counts", verifyToken, getTestCounts);
module.exports = router;
