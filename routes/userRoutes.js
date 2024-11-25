const express = require("express");
const {
  registerUser,
  loginUser,
  getUserProfile,
  saveQuizMarks
} = require("../controllers/userController");
const { verifyToken } = require("../middleware/verifyToken");

const router = express.Router();

// Register route
router.post("/register", registerUser);

// Login route
router.post("/login", loginUser);

// Route to fetch the user's profile data
router.get("/gio-profile", verifyToken, getUserProfile);
router.post('/save-quiz-marks', verifyToken, saveQuizMarks);
// router.post("/reset-password", resetPassword);
module.exports = router;
