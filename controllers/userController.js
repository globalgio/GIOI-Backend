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
  const user = req.user; // Extract user information from middleware (e.g., authentication middleware)
  const username = user?.username; // Ensure username exists

  if (!username) {
    return res.status(400).json({
      message: "Username is required for authentication.",
    });
  }

  try {
    // Fetch the database reference
    const userRef = ref(database, "gio-students");
    const snapshot = await get(userRef);

    if (!snapshot.exists()) {
      return res.status(404).json({
        message: "No users found in the database.",
      });
    }

    // Find the user profile based on the username
    const userProfile = Object.values(snapshot.val()).find(
      (userData) => userData.username === username
    );

    if (!userProfile) {
      return res.status(404).json({
        message: "User not found in the database.",
      });
    }

    res.status(200).json({
      message: "User profile fetched successfully.",
      user: userProfile,
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({
      message: "Failed to fetch user profile.",
      error: error.message,
    });
  }
};

const updatePaymentStatus = async (req, res) => {
  const { paymentStatus } = req.body;
  const user = req.user;

  if (!user) {
    return res.status(400).json({ message: "User data not found." });
  }

  try {
    const userRef = ref(database, `gio-students/${user.uid}`);
    const snapshot = await get(userRef);

    if (!snapshot.exists()) {
      return res
        .status(400)
        .json({ message: "User not found in the database." });
    }

    const userData = snapshot.val();

    const updates = {
      ...userData,
      paymentStatus,
    };

    // If paymentStatus indicates quiz completion or a new cycle, reset testCompleted
    if (paymentStatus === "quiz_attempted") {
      updates.testCompleted = true; // Mark as completed
    } else if (paymentStatus === "unpaid") {
      updates.testCompleted = false; // Reset for the next attempt
    }

    await set(userRef, updates);

    res
      .status(200)
      .json({ message: "Payment status and test state updated successfully." });
  } catch (error) {
    console.error("Error updating payment status:", error);
    res.status(500).json({ message: "Failed to update payment status." });
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
// Helper function to calculate rank and category
const getRankAndCategory = (score, jsonData, maxScore) => {
  score = Number(score); // Ensure score is a number

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

const saveQuizMarks = async (req, res) => {
  const { uid } = req.user;
  const { score, total, type } = req.body;

  if (!uid) {
    return res.status(400).json({ message: "User UID is required." });
  }

  if (score === undefined || total === undefined || !type) {
    return res
      .status(400)
      .json({ message: "Score, total, and type are required." });
  }

  try {
    const scoreNum = Number(score);
    const totalNum = Number(total);

    // Sanitize testId and timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const testId = `test-${timestamp}`;

    // Save marks to user-specific node
    const marksRef = ref(
      database,
      `gio-students/${uid}/marks/${type}/${testId}`
    );
    await set(marksRef, { score: scoreNum, total: totalNum, timestamp });

    // Update Rankings
    const maxScore = type === "mock" ? 100 : 400;
    await updateUserRankings(uid, scoreNum, type, maxScore);

    // Fetch updated rankings and user data
    const [rankingsSnapshot, userSnapshot] = await Promise.all([
      get(ref(database, `gio-students/${uid}/ranks/${type}`)),
      get(ref(database, `gio-students/${uid}`)),
    ]);

    if (!rankingsSnapshot.exists()) {
      return res.status(200).json({
        message: "No rankings available yet.",
        rankings: {
          global: { rank: "Unranked", category: "Unranked" },
          country: { rank: "Unranked", category: "Unranked" },
          state: { rank: "Unranked", category: "Unranked" },
        },
      });
    }

    const userRankings = rankingsSnapshot.val();
    const userData = userSnapshot.val();
    const userName = userData.name || "Unknown";

    // Handle live test certificate generation
    if (type === "live" && totalNum === 400) {
      const certificateCode = `GIO-GQC-${Math.floor(
        1000 + Math.random() * 9000
      )}`;

      const certificateData = {
        code: certificateCode,
        name: userName,
        rankings: {
          global: userRankings.global,
          country: userRankings.country,
          state: userRankings.state,
        },
        timestamp: new Date().toISOString(),
      };

      const userCertificateRef = ref(
        database,
        `gio-students/${uid}/certificateCodes`
      );
      await set(userCertificateRef, certificateData);

      const globalCertificateRef = ref(
        database,
        `certificateCodes/${certificateCode}`
      );
      await set(globalCertificateRef, {
        certificateCode: certificateCode,
        createdAt: certificateData.timestamp,
        type: "GQC",
        user: userName,
      });

      return res.status(200).json({
        message: "Live test saved and certificate updated successfully.",
        certificateCode,
        name: userName,
        rankings: userRankings,
        timestamp: certificateData.timestamp,
      });
    }

    return res.status(200).json({
      message: `${
        type.charAt(0).toUpperCase() + type.slice(1)
      } test marks saved and rankings updated successfully.`,
      rankings: userRankings,
    });
  } catch (error) {
    console.error("Error saving marks:", error.message);
    return res.status(500).json({
      message: "Failed to save test marks.",
      error: error.message,
    });
  }
};

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

  // Save rankings to the database
  const rankingsRef = ref(database, `gio-students/${uid}/ranks/${type}`);
  await set(rankingsRef, {
    global: globalRank,
    country: countryRank,
    state: stateRank,
  });

  // Fetch and log the updated rankings to verify
  const updatedRankingsSnapshot = await get(rankingsRef);
 
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
const getAllStudentsTestCounts = async (req, res) => {
  try {
    const { uid } = req.user; // The authenticated school user UID

    if (!uid) {
      return res.status(400).json({ message: "User UID is required." });
    }

    // Fetch the school name from the user's profile (this assumes you have the school in the user's data)
    const schoolName = req.user.schoolName; // Assuming `schoolName` is available in `req.user`

    // Reference to all students in the school
    const studentsRef = ref(database, `gio-students`);
    const snapshot = await get(studentsRef);

    if (!snapshot.exists()) {
      return res.status(200).json({
        message: "No students found for the school.",
        mock: 0,
        live: 0,
      });
    }

    const students = snapshot.val();

    let mockCount = 0;
    let liveCount = 0;

    // Loop through all students to count mock and live tests
    Object.values(students).forEach((student) => {
      if (student.marks && student.marks.mock) {
        mockCount += Object.keys(student.marks.mock).length;
      }
      if (student.marks && student.marks.live) {
        liveCount += Object.keys(student.marks.live).length;
      }
    });

    res.status(200).json({
      message: "Test counts fetched successfully.",
      mock: mockCount,
      live: liveCount,
    });
  } catch (error) {
    console.error("Error fetching all students' test counts:", error.message);
    res.status(500).json({
      message: "Failed to fetch test counts.",
      error: error.message,
    });
  }
};

const verifyCertificateCode = async (req, res) => {
  const { certificateCode } = req.body;

  if (!certificateCode) {
    return res.status(400).json({
      message: "Certificate code is required",
    });
  }

  try {
    // Reference to the 'gio-students' path in the database
    const studentsRef = ref(database, `gio-students`);
    const snapshot = await get(studentsRef);

    if (!snapshot.exists()) {
      return res.status(404).json({
        message: "No students found in the database",
      });
    }

    // Search for the certificate code within 'certificateCodes'
    let certificateData = null;
    let studentName = null;
    snapshot.forEach((childSnapshot) => {
      const studentData = childSnapshot.val();
      if (studentData.certificateCodes?.code === certificateCode) {
        certificateData = studentData.certificateCodes;
        studentName = studentData.name; // Retrieve the associated name
      }
    });

    if (!certificateData) {
      return res.status(404).json({
        message: `Certificate code not found: ${certificateCode}`,
      });
    }

    // Return the certificate details along with the name
    return res.status(200).json({
      message: "Certificate verified successfully",
      certificateCode: certificateData.code,
      name: studentName, // Include the name in the response
      rankings: certificateData.rankings,
      timestamp: certificateData.timestamp,
    });
  } catch (error) {
    console.error("Error verifying certificate code:", error);
    res.status(500).json({
      message: "Failed to verify certificate code",
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
  getAllStudentsTestCounts,
  verifyCertificateCode,
};
