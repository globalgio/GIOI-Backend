const { auth, database } = require("../config/firebase-config");
const {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} = require("firebase/auth");
const { ref, set, get, push } = require("firebase/database");
const jwt = require("jsonwebtoken");
require("dotenv").config();

// Register User
const registerUser = async (req, res) => {
  const {
    name,
    email,
    password,
    phoneNumber,
    teacherPhoneNumber,
    whatsappNumber,
    standard,
    schoolName,
    country,
    state,
    city,
  } = req.body;

  if (!email || !password || !phoneNumber) {
    return res.status(400).json({
      message: "Email, password, and phone number are required",
    });
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );
    const user = userCredential.user;

    const userRef = ref(database, `gio-students/${user.uid}`);
    await set(userRef, {
      uid: user.uid,
      email,
      name,
      phoneNumber,
      teacherPhoneNumber,
      whatsappNumber,
      standard,
      schoolName,
      country,
      state,
      city,
      createdAt: new Date().toISOString(),
    });

    const token = jwt.sign(
      { uid: user.uid, email: user.email },
      process.env.JWT_SECRET_KEY,
      { expiresIn: "1d" }
    );

    res.status(201).json({
      message: "User registered successfully",
      uid: user.uid,
      email: user.email,
      token,
    });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({
      message: "Failed to register user",
      error: error.message,
    });
  }
};

// Login User
const loginUser = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      message: "Email and password are required",
    });
  }

  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );
    const user = userCredential.user;

    const token = jwt.sign(
      { uid: user.uid, email: user.email },
      process.env.JWT_SECRET_KEY,
      { expiresIn: "1d" }
    );

    res.status(200).json({
      message: "Login successful",
      uid: user.uid,
      email: user.email,
      token,
    });
  } catch (error) {
    console.error("Error logging in user:", error);
    res.status(401).json({
      message: "Invalid email or password",
      error: error.message,
    });
  }
};

// Get User Profile
const getUserProfile = async (req, res) => {
  const user = req.user;

  if (!user) {
    return res.status(400).json({
      message: "User data not found.",
    });
  }

  try {
    const userRef = ref(database, `gio-students/${user.uid}`);
    const snapshot = await get(userRef);

    if (!snapshot.exists()) {
      return res.status(400).json({
        message: "User not found in the database.",
      });
    }

    const userProfile = snapshot.val();

    res.status(200).json({
      message: "User profile fetched successfully",
      user: userProfile,
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({
      message: "Failed to fetch user profile",
      error: error.message,
    });
  }
};

// Save User Quiz Marks
const saveQuizMarks = async (req, res) => {
  const user = req.user;
  const { score, total, percentage } = req.body;

  if (!user) {
    return res.status(400).json({
      message: "User data not found.",
    });
  }

  if (score === undefined || total === undefined || percentage === undefined) {
    return res.status(400).json({
      message: "Score, total, and percentage are required.",
    });
  }

  try {
    const marksRef = ref(database, `gio-students/${user.uid}/marks`);

    await push(marksRef, {
      score,
      total,
      percentage,
      timestamp: new Date().toISOString(),
    });

    res.status(200).json({
      message: "Quiz marks saved successfully.",
    });
  } catch (error) {
    console.error("Error saving quiz marks:", error);
    res.status(500).json({
      message: "Failed to save quiz marks.",
      error: error.message,
    });
  }
};

module.exports = { registerUser, loginUser, getUserProfile, saveQuizMarks };
