const { auth, database } = require("../config/firebase-config");
const {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} = require("firebase/auth");
const { ref, set, get } = require("firebase/database");
const jwt = require("jsonwebtoken");

// Register User
const registerUser = async (req, res) => {
  const {
    name,
    email,
    password,
    PhoneNumber,
    teacherPhoneNumber,
    whatsappNumber,
    standard,
    schoolName,
    country,
    state,
    city,
  } = req.body;

  // Validate required fields
  if (!email || !password || !PhoneNumber) {
    return res.status(400).json({
      message: "Email, password, and phone number are required",
    });
  }

  try {
    // Create user with Firebase Authentication
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );
    const user = userCredential.user;

    // Save user details in Firebase Realtime Database
    const userRef = ref(database, `gio-students/${user.uid}`);
    await set(userRef, {
      uid: user.uid,
      email,
      name,
      PhoneNumber,
      teacherPhoneNumber,
      whatsappNumber,
      standard,
      schoolName,
      country,
      state,
      city,
      createdAt: new Date().toISOString(),
    });

    // Generate JWT token
    const token = jwt.sign(
      { uid: user.uid, email: user.email },
      process.env.JWT_SECRET_KEY,
      { expiresIn: "1d" } // Token expires in 1 day
    );

    // Respond with user data and token
    res.status(201).json({
      message: "User registered successfully",
      uid: user.uid,
      email: user.email,
      token, // Send token in response
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

  // Validate required fields
  if (!email || !password) {
    return res.status(400).json({
      message: "Email and password are required",
    });
  }

  try {
    // Authenticate user with Firebase Authentication
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );
    const user = userCredential.user;

    // Generate JWT token
    const token = jwt.sign(
      { uid: user.uid, email: user.email },
      process.env.JWT_SECRET_KEY,
      { expiresIn: "1d" } // Token expires in 1 day
    );

    // Respond with success message and token
    res.status(200).json({
      message: "Login successful",
      uid: user.uid,
      email: user.email,
      token, // Send token in response
    });
  } catch (error) {
    console.error("Error logging in user:", error);
    res.status(401).json({
      message: "Invalid email or password",
      error: error.message,
    });
  }
};

const getUserProfile = async (req, res) => {
  const user = req.user; // This comes from the `verifyToken` middleware

  // Check if the user is authenticated
  if (!user) {
    return res.status(400).json({
      message: "User data not found.",
    });
  }

  try {
    // Fetch the user profile from Firebase Realtime Database using the user's UID
    const userRef = ref(database, `gio-students/${user.uid}`);
    const snapshot = await get(userRef);

    // Check if the user data exists
    if (!snapshot.exists()) {
      return res.status(400).json({
        message: "User not found in the database.",
      });
    }

    // Retrieve all the user data stored in the `gio-students/${user.uid}` node
    const userProfile = snapshot.val();

    // Send the entire user profile as the response
    res.status(200).json({
      message: "User profile fetched successfully",
      user: userProfile, // Returning all the details (like name, email, PhoneNumber, etc.)
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({
      message: "Failed to fetch user profile",
      error: error.message,
    });
  }
};

// Export controllers
module.exports = { registerUser, loginUser, getUserProfile };
