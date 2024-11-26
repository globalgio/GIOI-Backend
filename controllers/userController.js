const { auth, database } = require("../config/firebase-config");
const {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} = require("firebase/auth");
const { ref, set, get, push, update } = require("firebase/database");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const registerUser = async (req, res) => {
  const {
    name,
    email,
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
  if (!email || !password || !PhoneNumber) {
    return res.status(400).json({
      message: "Email, password, and phone number are required",
    });
  }

  // Validate password and confirmPassword match
  if (password !== confirmPassword) {
    return res.status(400).json({
      message: "Password and confirm password do not match",
    });
  }

  try {
    // Create the user in Firebase Authentication
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );
    const user = userCredential.user;

    // Save user details to the Realtime Database
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

    // Generate JWT token for the user
    const token = jwt.sign(
      { uid: user.uid, email: user.email },
      process.env.JWT_SECRET_KEY,
      { expiresIn: "1d" }
    );

    // Respond with success
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

// Save Quiz Marks and Update Rankings
const saveQuizMarks = async (req, res) => {
  const user = req.user;
  const { score, total } = req.body;

  if (!user) {
    return res.status(400).json({
      message: "User data not found.",
    });
  }

  if (score === undefined || total === undefined) {
    return res.status(400).json({
      message: "Score and total are required.",
    });
  }

  try {
    const marksRef = ref(database, `gio-students/${user.uid}/marks`);
    await push(marksRef, { score, total, timestamp: new Date().toISOString() });

    // Update Rankings
    await updateUserRankings(user.uid);

    res.status(200).json({
      message: "Score and total saved successfully. Rankings updated.",
    });
  } catch (error) {
    console.error("Error saving score and total:", error);
    res.status(500).json({
      message: "Failed to save score and total.",
      error: error.message,
    });
  }
};

// Update Rankings
const calculateCategory = (rank, maxRank) => {
  if (rank <= maxRank * 0.01) return "Gold";
  if (rank <= maxRank * 0.05) return "Silver";
  if (rank <= maxRank * 0.1) return "Bronze";
  return "Unranked";
};

const updateUserRankings = async (uid) => {
  const allParticipantsRef = ref(database, "gio-students");
  const snapshot = await get(allParticipantsRef);

  if (!snapshot.exists()) {
    console.log("No participants found in the database.");
    return;
  }

  const participants = [];
  snapshot.forEach((childSnapshot) => {
    const participant = childSnapshot.val();

    if (participant.marks && typeof participant.marks === "object") {
      const marksArray = Object.values(participant.marks);

      const totalScore = marksArray.reduce(
        (sum, mark) => sum + (mark.score || 0),
        0
      );

      participants.push({
        uid: childSnapshot.key,
        score: totalScore,
        country: participant.country || "Unknown",
        state: participant.state || "Unknown",
        city: participant.city || "Unknown",
      });
    } else {
      console.warn(
        `Marks for user ${childSnapshot.key} are missing or not in the correct format.`
      );
    }
  });

  if (participants.length === 0) {
    console.log("No valid participants found for ranking.");
    return;
  }

  // Sort participants globally by score in descending order
  participants.sort((a, b) => b.score - a.score);

  const calculateRanksWithCategory = (filteredScores, maxRank) => {
    const rankings = [];
    let rank = 1;

    for (const participant of filteredScores) {
      if (rank > maxRank) break;
      const category = calculateCategory(rank, maxRank);

      rankings.push({
        ...participant,
        rank,
        category,
      });
      rank++;
    }

    return rankings;
  };

  const globalRanks = calculateRanksWithCategory(participants, 1000000); // 10 lakh global
  const userCountry = participants.find((p) => p.uid === uid)?.country || "";
  const userState = participants.find((p) => p.uid === uid)?.state || "";
  const userCity = participants.find((p) => p.uid === uid)?.city || "";

  const countryRanks = calculateRanksWithCategory(
    participants.filter((p) => p.country === userCountry),
    500000 // 5 lakh per country
  );
  const stateRanks = calculateRanksWithCategory(
    participants.filter((p) => p.state === userState),
    100000 // 1 lakh per state
  );
  const cityRanks = calculateRanksWithCategory(
    participants.filter((p) => p.city === userCity),
    50000 // 50k per city
  );

  const userGlobalRank = globalRanks.find((r) => r.uid === uid) || {};
  const userCountryRank = countryRanks.find((r) => r.uid === uid) || {};
  const userStateRank = stateRanks.find((r) => r.uid === uid) || {};
  const userCityRank = cityRanks.find((r) => r.uid === uid) || {};

  const userRef = ref(database, `gio-students/${uid}/ranks`);
  await set(userRef, {
    global: userGlobalRank.rank
      ? { rank: userGlobalRank.rank, category: userGlobalRank.category }
      : { rank: "Unranked", category: "Unranked" },
    country: userCountryRank.rank
      ? { rank: userCountryRank.rank, category: userCountryRank.category }
      : { rank: "Unranked", category: "Unranked" },
    state: userStateRank.rank
      ? { rank: userStateRank.rank, category: userStateRank.category }
      : { rank: "Unranked", category: "Unranked" },
    city: userCityRank.rank
      ? { rank: userCityRank.rank, category: userCityRank.category }
      : { rank: "Unranked", category: "Unranked" },
  });

  console.log("Rankings updated successfully for user:", uid);
};``

const getUserRankings = async (req, res) => {
  const user = req.user;

  if (!user) {
    return res.status(400).json({
      message: "User data not found.",
    });
  }

  try {
    const userRef = ref(database, `gio-students/${user.uid}/ranks`);
    const snapshot = await get(userRef);

    if (!snapshot.exists()) {
      return res.status(200).json({
        message: "No rankings available yet.",
        rankings: {
          global: { rank: "Unranked", category: "Unranked" },
          country: { rank: "Unranked", category: "Unranked" },
          state: { rank: "Unranked", category: "Unranked" },
          city: { rank: "Unranked", category: "Unranked" },
        },
      });
    }

    res.status(200).json({
      message: "Rankings fetched successfully.",
      rankings: snapshot.val(),
    });
  } catch (error) {
    console.error("Error fetching rankings:", error);
    res.status(500).json({
      message: "Failed to fetch rankings.",
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
};
