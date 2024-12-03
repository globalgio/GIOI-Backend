const { database } = require("../config/firebase-config");

const { ref, set, get } = require("firebase/database");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
require("dotenv").config();

const bcrypt = require("bcrypt"); // Assuming bcrypt is used for password hashing

// Register User
const registerUser = async (req, res) => {
  const {
    name, // Added name
    username,
    password,
    confirmPassword,
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
  if (!name || !username || !password || !PhoneNumber) {
    return res.status(400).json({
      message: "Name, username, password, and phone number are required",
    });
  }

  // Validate password and confirmPassword match
  if (password !== confirmPassword) {
    return res.status(400).json({
      message: "Password and confirm password do not match",
    });
  }

  try {
    // Hash the password before saving
    const hashedPassword = await bcrypt.hash(password, 10); // Hash with salt rounds

    // Generate a unique ID for the user
    const uid = uuidv4();

    // Save user details to the Realtime Database, storing the hashed password
    const userRef = ref(database, `gio-students/${uid}`);
    try {
      await set(userRef, {
        uid, // Save the UID
        name, // Save the name
        username, // Storing the username
        password: hashedPassword, // Storing the hashed password
        PhoneNumber,
        teacherPhoneNumber,
        whatsappNumber,
        standard,
        schoolName,
        country,
        state,
        city,
        paymentStatus: "unpaid",
        testCompleted: false,
        ranks: {},
        createdAt: new Date().toISOString(),
      });
      console.log("User details successfully written to the database.");
    } catch (dbError) {
      console.error("Error writing user details to the database:", dbError);
      return res.status(500).json({
        message: "Failed to save user details to the database.",
        error: dbError.message,
      });
    }

    // Generate JWT token for the user after registration
    const token = jwt.sign(
      { uid, username, name }, // Include UID, username, and name in the JWT payload
      process.env.JWT_SECRET_KEY, // Secret key for signing the token
      { expiresIn: "1d" } // Expiration time for the token (1 day)
    );

    res.status(201).json({
      message: "User registered successfully",
      uid, // Include UID in the response
      username, // Include username in the response
      name, // Include name in the response
      token, // Send the JWT token to the frontend
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
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      message: "Username and password are required",
    });
  }

  try {
    // Look for the user by username in the database
    const userRef = ref(database, "gio-students");
    const snapshot = await get(userRef);

    let user = null;
    snapshot.forEach((childSnapshot) => {
      if (childSnapshot.val().username === username) {
        user = childSnapshot.val(); // Found the user by username
      }
    });

    if (!user) {
      return res.status(401).json({
        message: "Invalid username or password",
      });
    }

    // Compare the entered password with the stored hashed password
    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return res.status(401).json({
        message: "Invalid username or password",
      });
    }

    // Generate JWT token for the user
    const token = jwt.sign(
      { uid: user.uid, username: user.username },
      process.env.JWT_SECRET_KEY,
      { expiresIn: "1d" }
    );

    res.status(200).json({
      message: "Login successful",
      username: user.username,
      token,
    });
  } catch (error) {
    console.error("Error logging in user:", error);
    res.status(500).json({
      message: "Failed to log in user",
      error: error.message,
    });
  }
};

// Get User Profile
const getUserProfile = async (req, res) => {
  // Extract the token from the Authorization header
  // const token = req.headers.authorization?.split(" ")[1]; // Assuming the token is sent as Bearer <token>

  // if (!token) {
  //   return res.status(400).json({
  //     message: "Token is required for authentication.",
  //   });
  // }
  const user = req.user;
  const username = user.username;

  try {
    // Verify the token and extract the username from it
    // const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    // const username = decoded.username; // Assuming the username is included in the JWT payload

    // Fetch user data from the database using the username (no longer using uid)
    const userRef = ref(database, "gio-students");
    const snapshot = await get(userRef);

    let userProfile = null;

    // Search for the user by username in the database
    snapshot.forEach((childSnapshot) => {
      if (childSnapshot.val().username === username) {
        userProfile = childSnapshot.val(); // Found the matching user
      }
    });

    if (!userProfile) {
      return res.status(404).json({
        message: "User not found in the database.",
      });
    }

    res.status(200).json({
      message: "User profile fetched successfully",
      user: userProfile, // Send the user's profile data
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({
      message: "Failed to fetch user profile",
      error: error.message,
    });
  }
};

const updatePaymentStatus = async (req, res) => {
  const user = req.user; // Assumes `req.user` is set after authentication middleware
  const { paymentStatus, testCompleted } = req.body;

  if (!user) {
    return res.status(400).json({
      message: "User data not found.",
    });
  }

  if (paymentStatus === undefined && testCompleted === undefined) {
    return res.status(400).json({
      message: "At least one of paymentStatus or testCompleted is required.",
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

    const updates = {};
    if (paymentStatus !== undefined) {
      updates.paymentStatus = paymentStatus; // Example values: "unpaid", "paid_but_not_attempted"
    }
    if (testCompleted !== undefined) {
      updates.testCompleted = testCompleted; // Example values: true, false
    }

    await set(userRef, {
      ...snapshot.val(),
      ...updates, // Update only the specified fields
    });

    res.status(200).json({
      message: "Payment status and/or test completion updated successfully.",
    });
  } catch (error) {
    console.error("Error updating payment status:", error);
    res.status(500).json({
      message: "Failed to update payment status.",
      error: error.message,
    });
  }
};

// Load Mock Ranks JSON
let globalMockRanksData, countryMockRanksData, stateMockRanksData;

try {
  globalMockRanksData = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../public/mockranks/globalrange.json"),
      "utf8"
    )
  );
  countryMockRanksData = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../public/mockranks/countryrange.json"),
      "utf8"
    )
  );
  stateMockRanksData = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../public/mockranks/staterange.json"),
      "utf8"
    )
  );
} catch (error) {
  console.error("Error loading mock ranks JSON:", error.message);
  process.exit(1);
}

// Load JSON files for live rank data
let globalRanksData, countryRanksData, stateRanksData;

try {
  globalRanksData = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../public/liveranks/globalrange.json"),
      "utf8"
    )
  );
} catch (error) {
  console.error("Error loading globalrange.json:", error.message);
  process.exit(1);
}

try {
  countryRanksData = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../public/liveranks/countryrange.json"),
      "utf8"
    )
  );
} catch (error) {
  console.error("Error loading countryrange.json:", error.message);
  process.exit(1);
}

try {
  stateRanksData = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../public/liveranks/staterange.json"),
      "utf8"
    )
  );
} catch (error) {
  console.error("Error loading staterange.json:", error.message);
  process.exit(1);
}
// Helper function to calculate rank and category
const getRankAndCategory = (score, jsonData, maxScore) => {
  // If the score is the maximum possible score, assign rank 1
  if (score === maxScore) {
    return { rank: 1, category: "Gold" };
  }

  // Find the matching score entry in the JSON
  const entry = jsonData.find((item) => item.score === score);

  if (!entry) {
    return { rank: "Unranked", category: "Unranked" }; // No matching entry
  }

  const [start, end] = entry.rankRange.split(" to ").map(Number);
  const randomRank = Math.floor(Math.random() * (end - start + 1)) + start;

  return { rank: randomRank, category: entry.category };
};

// Save Quiz Marks
const saveQuizMarks = async (req, res) => {
  const { uid } = req.user; // Assuming `uid` is part of the authenticated user object
  const { score, total, type } = req.body;

  if (!uid) {
    return res.status(400).json({
      message: "User UID is required.",
    });
  }

  if (score === undefined || total === undefined || !type) {
    return res.status(400).json({
      message: "Score, total, and type are required.",
    });
  }

  try {
    // Sanitize testId
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const testId = `test-${timestamp}`;

    // Reference to the user's marks
    const marksRef = ref(
      database,
      `gio-students/${uid}/marks/${type}/${testId}`
    );

    // Save the new test marks
    await set(marksRef, { score, total, timestamp });

    // Update Rankings
    const maxScore = type === "mock" ? 100 : 400; // Adjust maxScore as needed
    await updateUserRankings(uid, score, type, maxScore);

    res.status(200).json({
      message: `${
        type.charAt(0).toUpperCase() + type.slice(1)
      } test marks saved and rankings updated successfully.`,
    });
  } catch (error) {
    console.error("Error saving marks:", error.message);
    res.status(500).json({
      message: "Failed to save test marks.",
      error: error.message,
    });
  }
};

// Update User Rankings
const updateUserRankings = async (uid, score, type, maxScore) => {
  let globalData, countryData, stateData;

  // Select ranking JSON based on type
  if (type === "mock") {
    globalData = globalMockRanksData;
    countryData = countryMockRanksData;
    stateData = stateMockRanksData;
  } else if (type === "live") {
    globalData = globalRanksData;
    countryData = countryRanksData;
    stateData = stateRanksData;
  } else {
    throw new Error("Invalid type. Must be 'mock' or 'live'.");
  }

  // Calculate ranks based on score
  const globalRank = getRankAndCategory(score, globalData, maxScore);
  const countryRank = getRankAndCategory(score, countryData, maxScore);
  const stateRank = getRankAndCategory(score, stateData, maxScore);

  // Save rankings to the appropriate node
  const rankingsRef = ref(database, `gio-students/${uid}/ranks/${type}`);
  await set(rankingsRef, {
    global: globalRank,
    country: countryRank,
    state: stateRank,
  });

  console.log(
    `${
      type.charAt(0).toUpperCase() + type.slice(1)
    } rankings updated successfully for user:`,
    uid
  );
};

// Get User Rankings
const getUserRankings = async (req, res) => {
  const { uid } = req.user; // Assuming `uid` is part of the authenticated user object
  const { type } = req.query;

  if (!uid) {
    return res.status(400).json({
      message: "User UID is required.",
    });
  }

  if (!type) {
    return res.status(400).json({
      message: "Query parameter 'type' is required.",
    });
  }

  try {
    const rankingsRef = ref(database, `gio-students/${uid}/ranks/${type}`);
    const snapshot = await get(rankingsRef);

    if (!snapshot.exists()) {
      return res.status(200).json({
        message: "No rankings available yet.",
        rankings: {
          global: { rank: "Unranked", category: "Unranked" },
          country: { rank: "Unranked", category: "Unranked" },
          state: { rank: "Unranked", category: "Unranked" },
        },
      });
    }

    const userRankings = snapshot.val();
    res.status(200).json({
      message: "Rankings fetched successfully.",
      rankings: userRankings,
    });
  } catch (error) {
    console.error("Error fetching rankings:", error.message);
    res.status(500).json({
      message: "Failed to fetch rankings.",
      error: error.message,
    });
  }
};

// Get Test Counts
const getTestCounts = async (req, res) => {
  try {
    const { uid } = req.user; // Assume authentication middleware attaches `req.user`

    if (!uid) {
      return res.status(400).json({ message: "User UID is required." });
    }

    // Reference to the user's marks in Firebase
    const marksRef = ref(database, `gio-students/${uid}/marks`);
    const snapshot = await get(marksRef);

    if (!snapshot.exists()) {
      return res.status(200).json({
        message: "No test data available.",
        mock: 0,
        live: 0,
      });
    }

    const marks = snapshot.val();

    // Count mock and live tests
    const mockCount = marks.mock ? Object.keys(marks.mock).length : 0;
    const liveCount = marks.live ? Object.keys(marks.live).length : 0;

    res.status(200).json({
      message: "Test counts fetched successfully.",
      mock: mockCount,
      live: liveCount,
    });
  } catch (error) {
    console.error("Error fetching test counts:", error.message);
    res.status(500).json({
      message: "Failed to fetch test counts.",
      error: error.message,
    });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getUserProfile,
  saveQuizMarks,
  updatePaymentStatus,
  getUserRankings,
  getTestCounts,
};
