const {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} = require("firebase/auth");
const {
  getDatabase,
  ref,
  set,
  get,
  update,
  child,
  query,
  orderByChild,
  equalTo,
} = require("firebase/database");
const jwt = require("jsonwebtoken");
const { validateEmail } = require("../utils/validation");
const xlsx = require("xlsx");
const fs = require("fs");
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");
const axios = require("axios"); // Ensure axios is imported
const { updateData, getData } = require("../utils/database");
const { app } = require("../config/firebase-config");
const auth = getAuth(app);
const { sendEmail } = require("../utils/sendEmail");
const database = getDatabase(app);
const { registrationEmailTemplate } = require("../utils/templateEmail");
const { log } = require("console");
require("dotenv").config();

/**
 * Categories and Incentives Config
 */
const CATEGORY_CONFIG = [
  { name: "Starter Partner", min: 1, max: 100, perStudentShare: 75 },
  { name: "Bronze Partner", min: 101, max: 200, perStudentShare: 85 },
  { name: "Silver Partner", min: 201, max: 300, perStudentShare: 95 },
  { name: "Gold Partner", min: 301, max: 400, perStudentShare: 110 },
  { name: "Platinum Partner", min: 401, max: Infinity, perStudentShare: 125 },
];

const ENGAGEMENT_BONUSES = [
  { threshold: 50, bonus: 20 },
  { threshold: 20, bonus: 15 },
  { threshold: 10, bonus: 10 },
  { threshold: 5, bonus: 5 },
  { threshold: 0, bonus: 0 }, // fallback if no milestones reached
];

/**
 * Helper Functions
 */

// Determine Partner Category based on total paid students
function determineCategory(totalPaidStudents) {
  for (const cat of CATEGORY_CONFIG) {
    if (totalPaidStudents >= cat.min && totalPaidStudents <= cat.max) {
      return cat;
    } else if (cat.max === Infinity && totalPaidStudents >= cat.min) {
      return cat;
    }
  }
  // Default to Starter if no match (unlikely if config covers all ranges)
  return CATEGORY_CONFIG[0];
}

// Calculate Engagement Bonus based on practice tests attempted
function calculateEngagementBonus(practiceTestsAttempted) {
  for (const level of ENGAGEMENT_BONUSES) {
    if (practiceTestsAttempted >= level.threshold) {
      return level.bonus;
    }
  }
  return 0;
}

/**
 * Coordinator Registration
 */


const coordinatorRegister = async (req, res) => {
  const {
    email,
    password,
    phoneNumber,
    whatsappNumber,
    country,
    state,
    city,
    name,
  } = req.body;

  // Validate required fields
  if (!email || !password || !phoneNumber || !whatsappNumber || !country || !state || !city || !name) {
    return res.status(400).json({ error: "All fields are required." });
  }

  // Validate email and password
  if (!validateEmail(email)) {
    return res.status(400).json({ error: "Invalid email format." });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }

  try {
    // Create user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const userId = userCredential.user.uid;

    // Hash the password for DB storage
    const hashedPassword = await bcrypt.hash(password, 10);

    // Store coordinator in Realtime Database
    const userRef = ref(database, `coordinators/${userId}`);
    await set(userRef, {
      email,
      password: hashedPassword,
      phoneNumber,
      whatsappNumber,
      country,
      state,
      city,
      name,
      role: "coordinator",
      createdAt: new Date().toISOString(),
      category: "Starter Partner",
      totalStudents: 0,
      totalPaidStudents: 0,
      totalIncentives: 0,
      bonusAmount: 0,
      totalEarnings: 0,
      status: "pending"
    });

    // Send confirmation email (optional)
    const mailOptions = {
      from: process.env.MAIL_USER,
      to: email,
      subject: "Welcome to Global Innovator Olympiad!",
      html: registrationEmailTemplate(name),
    };
    try {
      await sendEmail(mailOptions);
    } catch (emailError) {
      console.error("Error sending registration email:", emailError);
    }

    // Generate JWT token
    const token = jwt.sign({ userId, email, role: "coordinator", status: "pending" }, process.env.JWT_SECRET_KEY, {
      expiresIn: "30d"
    });

    return res.status(200).json({
      message: "Coordinator registered successfully! Your account is pending admin approval.",
      token,
      data: { userId, email, role: "coordinator", status: "pending" },
    });
  } catch (error) {
    console.error("Error during registration:", error);
    if (error.code === "auth/email-already-in-use") {
      return res.status(400).json({ error: "Email is already in use." });
    }
    return res.status(500).json({ error: error.message || "Internal Server Error" });
  }
};


/**
 * Coordinator Login
 */
/**
 * Coordinator Login
 */
const coordinatorLogin = async (req, res) => {
  const { email, password } = req.body;

  // Validate required fields
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  // Validate email format
  if (!validateEmail(email)) {
    return res.status(400).json({ error: "Invalid email format." });
  }

  try {
    // Sign in using Firebase Authentication
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const userId = userCredential.user.uid;
    const userRef = ref(database, `coordinators/${userId}`);
    const snapshot = await get(userRef);

    if (!snapshot.exists()) {
      return res.status(404).json({ error: "User not found." });
    }

    // Generate a JWT token
    const token = jwt.sign(
      { userId, email, role: "coordinator" },
      process.env.JWT_SECRET_KEY,
      { expiresIn: "30d" }
    );

    return res.status(200).json({
      message: "Login successful!",
      token,
      data: { userId, email, role: "coordinator" },
    });
  } catch (error) {
    console.error("Error during login:", error);
    if (error.code === "auth/wrong-password") {
      return res.status(400).json({ error: "Incorrect password." });
    }
    if (error.code === "auth/user-not-found") {
      return res.status(400).json({ error: "User not found." });
    }
    return res.status(500).json({ error: error.message || "Internal Server Error" });
  }
};



/**
 * Update Coordinator Profile
 */
// Helper function to validate IFSC code format
// Helper function to validate IFSC code format
const isValidIFSC = (ifsc) => {
  const regex = /^[A-Za-z]{4}0[A-Za-z0-9]{6}$/;
  return regex.test(ifsc);
};

/**
 * Update Coordinator Profile
 */
const updateProfile = async (req, res) => {
  if (req.method !== "PUT") {
    return res.status(405).json({ error: "Method Not Allowed. Use PUT." });
  }

  const { userId } = req.user;
  const { bankName, accountNumber, ifsc, branch, upiId, accountHolderName } = req.body;

  // Validate required fields
  // Now require accountHolderName along with ifsc and upiId
  if (!userId || !upiId || !ifsc || !accountHolderName || !accountNumber) {
    return res.status(400).json({
      error: "upiId, ifsc, accountHolderName, and accountNumber are required.",
    });
  }

  // Validate IFSC code format
  if (!isValidIFSC(ifsc)) {
    return res.status(400).json({ error: "Invalid IFSC code format." });
  }

  try {
    // Fetch bank details using Razorpay IFSC API
    const ifscResponse = await axios.get(`https://ifsc.razorpay.com/${ifsc}`);
    const fetchedBankName = ifscResponse.data.BANK;
    const fetchedBranch = ifscResponse.data.BRANCH;

    // Reference to the coordinator's data in Realtime Database
    const userRef = ref(database, `coordinators/${userId}`);

    // Update the coordinator's profile
    await update(userRef, {
      upiId: upiId || "",
      bankName: fetchedBankName || "",
      accountNumber: accountNumber || "",
      ifsc: ifsc || "",
      branch: fetchedBranch || "",
      accountHolderName: accountHolderName || "", // store account holder name
      updatedAt: new Date().toISOString(),
    });

    // Optionally, you can return the updated data. For now, just a success message.
    res.status(200).json({ message: "Profile updated successfully!" });
  } catch (error) {
    console.error(
      "Error updating profile:",
      error.response?.data?.error || error.message
    );
    if (error.response && error.response.status === 400) {
      // Likely invalid IFSC code
      res
        .status(400)
        .json({ error: "Invalid IFSC code or unable to fetch bank details." });
    } else {
      res.status(500).json({ error: "Error updating profile." });
    }
  }
};

/**
 * Get Coordinator Profile
 */
const getProfile = async (req, res) => {
  const { userId } = req.user;
  try {
    const userRef = ref(database, `coordinators/${userId}`);
    const snapshot = await get(userRef);

    if (!snapshot.exists()) {
      return res.status(404).json({ error: "User not found." });
    }

    res.status(200).json({ data: snapshot.val() });
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ error: "Error fetching profile." });
  }
};

/**
 * Bulk Upload Students
 */

async function saveQuizMarks({ user, body }) {
  // Dummy Implementation for demonstration
  return { message: "Quiz marks saved." };
}

// Mock `updateTotalStudents` function
const updateTotalStudents = async (coordinatorId, count) => {
  const coordinatorRef = `coordinators/${coordinatorId}`;
  const coordinatorData = await getData(coordinatorRef); // Assume `getData` is a helper for fetching Firebase data
  const totalStudents = (coordinatorData?.totalStudents || 0) + count;

  await saveData(coordinatorRef, { ...coordinatorData, totalStudents });
};

// Mock `saveData` and `getData` for Firebase
const saveData = async (path, data) => {
  // Implement Firebase saving logic
  await set(path, data)

};



// Bulk upload function


const bulkUploadStudents = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded." });
  }

  try {


    // Read uploaded Excel file
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Convert sheet data to JSON
    const students = xlsx.utils.sheet_to_json(sheet);

    let failedEntries = [];
    let successCount = 0;
    const coordinatorId = req.user.userId;

    // Iterate through each student and process
    for (const student of students) {
      try {
        // Validate required fields
        if (
          !student.name ||
          !student.username ||
          !student.password ||
          !student.PhoneNumber ||
          !student.teacherPhoneNumber ||
          !student.whatsappNumber ||
          !student.standard ||
          !student.schoolName ||
          !student.country ||
          !student.state ||
          !student.city
        ) {
          failedEntries.push({
            student,
            reason: "Missing required fields",
          });
          continue;
        }

        // Validate mockScore and liveScore (optional but recommended)
        if (
          student.mockScore !== undefined &&
          (typeof student.mockScore !== "number" ||
            student.mockScore < 0 ||
            student.mockScore > 100)
        ) {
          failedEntries.push({
            student,
            reason:
              "Invalid mockScore. It should be a number between 0 and 100.",
          });
          continue;
        }

        if (
          student.liveScore !== undefined &&
          (typeof student.liveScore !== "number" ||
            student.liveScore < 0 ||
            student.liveScore > 400)
        ) {
          failedEntries.push({
            student,
            reason:
              "Invalid liveScore. It should be a number between 0 and 400.",
          });
          continue;
        }

        // Hash the password before saving
        const hashedPassword = await bcrypt.hash(student.password, 10); // Hash with salt rounds

        // Generate a unique ID for the user
        const uid = uuidv4(); // Generate UID for each student

        // Save student data with standardized field names
        const studentData = {
          uid,
          name: student.name,
          username: student.username,
          password: hashedPassword,
          PhoneNumber: student.PhoneNumber,
          teacherPhoneNumber: student.teacherPhoneNumber,
          whatsappNumber: student.whatsappNumber,
          standard: student.standard,
          schoolName: student.schoolName,
          country: student.country,
          state: student.state,
          city: student.city,
          mockScore: student.mockScore || 0,
          liveScore: student.liveScore || 0,
          paymentStatus: "unpaid",
          testCompleted: false,
          practiceTestsAttempted: 0, // Standardized field name
          createdAt: new Date().toISOString(),
          addedBy: coordinatorId,
        };

        const studentRef = ref(database, `gio-students/${uid}`);
        await set(studentRef, studentData);

        // Generate JWT token for the student after registration (optional)
        const token = jwt.sign(
          { uid, username: student.username, name: student.name },
          process.env.JWT_SECRET_KEY,
          { expiresIn: "1d" }
        );

        // Process predefined mockScore
        if (student.mockScore !== undefined && student.mockScore !== null) {
          try {
            const mockResult = await saveQuizMarks({
              user: { uid },
              body: {
                score: student.mockScore,
                total: 100, // Assuming mock tests are out of 100
                type: "mock",
              },
            });
          
          } catch (error) {
            console.error(
              `Error saving mock test marks for UID: ${uid}:`,
              error.message
            );
            throw new Error(`Mock test mark saving failed: ${error.message}`);
          }
        }

        // Process predefined liveScore
        if (student.liveScore !== undefined && student.liveScore !== null) {
          try {
            const liveResult = await saveQuizMarks({
              user: { uid },
              body: {
                score: student.liveScore,
                total: 400, // Assuming live tests are out of 400
                type: "live",
              },
            });
           
          } catch (error) {
            console.error(
              `Error saving live test marks for UID: ${uid}:`,
              error.message
            );
            throw new Error(`Live test mark saving failed: ${error.message}`);
          }
        }

        // Update Rankings (Assuming you have global rankings data)
        // Placeholder implementation; replace with actual logic
        const globalMockRanksData = {}; // Fetch or define as needed
        const globalRanksData = {}; // Fetch or define as needed

        const mockRank = getRankAndCategory(
          student.mockScore || 0,
          globalMockRanksData,
          100
        );
        const liveRank = getRankAndCategory(
          student.liveScore || 0,
          globalRanksData,
          400
        );

        const rankingsRef = ref(database, `gio-students/${uid}/ranks`);
        await set(rankingsRef, {
          mock: mockRank,
          live: liveRank,
        });

        successCount++;
      } catch (error) {
        console.error("Error processing student:", error.message);
        failedEntries.push({ student, reason: error.message });
      }
    }

    // Remove the uploaded file after processing
    fs.unlinkSync(req.file.path);

    // Update coordinator totalStudents count
    const coordRef = ref(database, `coordinators/${coordinatorId}`);
    const coordSnapshot = await get(coordRef);
    if (coordSnapshot.exists()) {
      const coordData = coordSnapshot.val();
      const newTotal = (coordData.totalStudents || 0) + successCount;
      await update(coordRef, { totalStudents: newTotal });
    }

    res.status(200).json({
      message: "Bulk upload completed with rankings and quiz marks updated.",
      successCount,
      failedCount: failedEntries.length,
      failedEntries,
    });
  } catch (error) {
    console.error("Error in bulk upload:", error);
    res.status(500).json({
      message: "Bulk upload failed.",
      error: error.message,
    });
  }
};






/**
 * Get Students Added by Coordinator
 */
const getStudentsByCoordinator = async (req, res) => {
  try {
    const { userId } = req.user; // Must be set by the authenticate middleware
    if (!userId) {
      return res.status(400).json({ message: "Coordinator ID is required." });
    }

    const dbRef = ref(database, "gio-students");
    const studentsSnapshot = await get(dbRef);

    if (!studentsSnapshot.exists()) {
      return res.status(404).json({ message: "No students found." });
    }

    const allStudents = studentsSnapshot.val();
  
    
    const studentsByCoordinator = Object.keys(allStudents)
      .filter((key) => allStudents[key].addedBy === userId)
      .reduce((acc, key) => {
        acc[key] = allStudents[key];
        return acc;
      }, {});
     

      

    if (Object.keys(studentsByCoordinator).length === 0) {
      return res.status(404).json({ message: "No students found for this coordinator." });
    }

    return res.status(200).json({ students: studentsByCoordinator });
  } catch (error) {
    console.error("Error fetching students by coordinator:", error);
    return res.status(500).json({ message: "Error fetching students", error: error.message });
  }
};

/**
 * Calculate Incentives for a Coordinator
 * This endpoint recalculates the category and incentives based on current data.
 */
const calculateIncentives = async (req, res) => {
  const { userId } = req.user;


  try {
    // Get coordinator info
    const coordRef = ref(database, `coordinators/${userId}`);
    const coordSnapshot = await get(coordRef);
    if (!coordSnapshot.exists()) {
      return res.status(404).json({ error: "Coordinator not found." });
    }
    const coordData = coordSnapshot.val();

    // Fetch students
    const dbRef = ref(database, "gio-students");
    const studentsSnapshot = await get(dbRef);
    if (!studentsSnapshot.exists()) {
      return res
        .status(200)
        .json({ message: "No students found, no incentives to calculate." });
    }

    const allStudents = studentsSnapshot.val();
    const studentsByCoordinator = Object.values(allStudents).filter(
      (s) => s.addedBy === userId
    );

    // Count how many have paymentStatus = "paid"
    const paidStudents = studentsByCoordinator.filter(
      (s) => s.paymentStatus === "paid_but_not_attempted"
    );

    const totalPaidStudents = paidStudents.length;
    // Determine category
    const categoryObj = determineCategory(totalPaidStudents);

    // Calculate engagement bonuses
    let totalEngagementBonus = 0;
    for (const stu of paidStudents) {
      const practiceTestsAttempted = stu.practiceTestsAttempted || 0;
      const bonus = calculateEngagementBonus(practiceTestsAttempted);
      totalEngagementBonus += bonus;
    }

    // Per student share is from categoryObj
    const perStudentShare = categoryObj.perStudentShare;
    const baseIncentive = perStudentShare * totalPaidStudents;

    // Calculate incentives and bonuses
    const totalIncentives = baseIncentive;
    const bonusAmount = totalEngagementBonus;

    // Calculate total earnings
    const totalEarnings = totalIncentives + bonusAmount;

    // Update coordinator record with new fields
    await update(coordRef, {
      category: categoryObj.name,
      totalPaidStudents: totalPaidStudents,
      totalIncentives: totalIncentives,
      bonusAmount: bonusAmount,
      totalEarnings: totalEarnings,
      lastIncentiveCalculation: new Date().toISOString(),
    });

    res.status(200).json({
      message: "Incentives calculated successfully!",
      data: {
        category: categoryObj.name,
        totalPaidStudents,
        baseIncentive,
        bonusAmount,
        totalEarnings,
      },
    });
  } catch (error) {
    console.error("Error calculating incentives:", error);
    res.status(500).json({ error: "Failed to calculate incentives." });
  }
};

/**
 * Get Partner Ranking
 * Rank coordinators based on totalEarnings in descending order.
 */
const getPartnerRank = async (req, res) => {
  const { userId } = req.user;
  try {
    const coordinatorsRef = ref(database, `coordinators`);
    const snapshot = await get(coordinatorsRef);
    if (!snapshot.exists()) {
      return res.status(404).json({ error: "No coordinators found." });
    }

    const allCoordinators = snapshot.val();
    // Convert to an array for sorting
    const coordinatorArray = Object.keys(allCoordinators).map((key) => ({
      userId: key,
      name: allCoordinators[key].name,
      category: allCoordinators[key].category || "N/A",
      totalIncentives: allCoordinators[key].totalIncentives || 0,
      bonusAmount: allCoordinators[key].bonusAmount || 0,
      totalEarnings: allCoordinators[key].totalEarnings || 0,
    }));

    // Sort by totalEarnings descending
    coordinatorArray.sort(
      (a, b) => (b.totalEarnings || 0) - (a.totalEarnings || 0)
    );

    let rank = 0;
    for (let i = 0; i < coordinatorArray.length; i++) {
      if (coordinatorArray[i].userId === userId) {
        rank = i + 1;
        break;
      }
    }

    // Update coordinator rank in DB
    const userRef = ref(database, `coordinators/${userId}`);
    await update(userRef, { rank });

    res.status(200).json({
      message: "Rank fetched successfully!",
      data: {
        rank,
        totalCoordinators: coordinatorArray.length,
      },
    });
  } catch (error) {
    console.error("Error fetching rank:", error);
    res.status(500).json({ error: "Failed to fetch rank." });
  }
};

/**
 * Verify Coordinator Details
 * Verifies bank and UPI details provided by the coordinator
 */
const verifyCoordinatorDetails = async (req, res) => {
  const { userId } = req.user;
  const { bankName, accountNumber, ifsc, branch, upiId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "User ID not found in token." });
  }

  if (!bankName && !upiId) {
    return res.status(400).json({
      error: "At least one verification detail (bank or UPI) is required.",
    });
  }

  try {
    let bankVerified = false;
    let upiVerified = false;

    // Verify Bank Details if provided
    if (bankName && accountNumber && ifsc && branch) {
      // Validate IFSC Code via Razorpay IFSC API
      try {
        const ifscResponse = await axios.get(
          `https://ifsc.razorpay.com/${ifsc}`
        );
        if (ifscResponse.status === 200) {
          bankVerified = true;
        }
      } catch (error) {
        return res.status(400).json({ error: "Invalid IFSC code." });
      }

      // Validate Account Number Format
      const accountNumberRegex = /^[0-9]{9,18}$/;
      if (!accountNumberRegex.test(accountNumber)) {
        return res
          .status(400)
          .json({ error: "Invalid account number format." });
      }
    }

    // Verify UPI ID if provided
    if (upiId) {
      const upiIdRegex = /^[\w.-]{2,256}@[a-zA-Z]{2,64}$/;
      if (upiIdRegex.test(upiId)) {
        upiVerified = true;
      } else {
        return res.status(400).json({ error: "Invalid UPI ID format." });
      }
    }

    // Prepare update data
    const updateDataObj = {
      updatedAt: new Date().toISOString(),
    };

    if (bankVerified) {
      updateDataObj.bankName = bankName;
      updateDataObj.accountNumber = accountNumber;
      updateDataObj.ifsc = ifsc;
      updateDataObj.branch = branch;
      updateDataObj.bankVerified = true;
    }

    if (upiVerified) {
      updateDataObj.upiId = upiId;
      updateDataObj.upiVerified = true;
    }

    // Update Realtime Database
    await updateData(`coordinators/${userId}`, updateDataObj);

    res.status(200).json({
      message: "Verification successful.",
      bankVerified,
      upiVerified,
    });
  } catch (error) {
    console.error("Verification Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * Get Leaderboard
 * Returns a list of coordinators sorted by totalEarnings in descending order.
 * Includes category, bonusAmount, and totalEarnings.
 */
const getLeaderboard = async (req, res) => {
  try {
    const coordinatorsRef = ref(database, "coordinators");
    const snapshot = await get(coordinatorsRef);

    if (!snapshot.exists()) {
      return res.status(404).json({ error: "No coordinators found." });
    }

    const allCoordinators = snapshot.val();

    // Convert to an array, include status, and filter only approved coordinators
    const leaderboard = Object.keys(allCoordinators)
      .map((key) => ({
        userId: key,
        name: allCoordinators[key].name,
        category: allCoordinators[key].category || "N/A",
        totalIncentives: allCoordinators[key].totalIncentives || 0,
        bonusAmount: allCoordinators[key].bonusAmount || 0,
        totalEarnings: allCoordinators[key].totalEarnings || 0,
        status: allCoordinators[key].status || "pending", // Default to 'pending' if status is undefined
      }))
      .filter((coordinator) => coordinator.status.toLowerCase() === "approved") // Filter only approved
      .sort((a, b) => (b.totalEarnings || 0) - (a.totalEarnings || 0)) // Sort by totalEarnings descending
      .slice(0, 10); // Select top 10

    res.status(200).json({ leaderboard });
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    res.status(500).json({ error: "Failed to fetch leaderboard." });
  }
};

/**
 * Get Achievements
 * Returns a list of achievements for the authenticated coordinator.
 */
const getAchievements = async (req, res) => {
  const { userId } = req.user;

  try {
    const achievementsRef = ref(
      database,
      `coordinators/${userId}/achievements`
    );
    const snapshot = await get(achievementsRef);

    if (!snapshot.exists()) {
      return res.status(200).json({ achievements: [] }); // No achievements yet
    }

    const achievements = snapshot.val();
    const achievementsList = Object.keys(achievements).map((key) => ({
      id: key,
      ...achievements[key],
    }));

    res.status(200).json({ achievements: achievementsList });
  } catch (error) {
    console.error("Error fetching achievements:", error);
    res.status(500).json({ error: "Failed to fetch achievements." });
  }
};

/**
 * Get Test Counts for All Students Added by the Coordinator
 */
// controllers/coordinatorController.js

const getCoordinatorTestCounts = async (req, res) => {
  try {
    const { userId } = req.user; // Assume `authenticate` middleware attaches `userId` to `req.user`

    if (!userId) {
      return res.status(400).json({ message: "Coordinator UID is required." });
    }

    const db = getDatabase();

    // Reference to all students in Firebase
    const studentsRef = ref(db, "gio-students");
    const snapshot = await get(studentsRef);

    if (!snapshot.exists()) {
      return res.status(200).json({
        message: "No students found.",
        totalPracticeTests: 0,
        finalPracticeTests: 0,
      });
    }

    const students = snapshot.val();
    let totalPracticeTests = 0;
    let finalPracticeTests = 0;

    // Iterate through each student
    Object.values(students).forEach((student) => {
      if (student.addedBy === userId) {
        // Aggregate mock tests as practice tests
        if (student.marks && student.marks.mock) {
          totalPracticeTests += Object.keys(student.marks.mock).length;
        }

        // Aggregate live tests as final tests
        if (student.marks && student.marks.live) {
          finalPracticeTests += Object.keys(student.marks.live).length;
        }
      }
    });

    res.status(200).json({
      message: "Test counts fetched successfully for your students.",
      totalPracticeTests,
      finalPracticeTests,
    });
  } catch (error) {
    console.error("Error fetching coordinator's test counts:", error.message);
    res.status(500).json({
      message: "Failed to fetch test counts for your students.",
      error: error.message,
    });
  }
};

/**
 * Update Student Payment Status
 */
const updateStudentPaymentStatus = async (req, res) => {
  const { studentId, paymentStatus } = req.body;
  const { userId } = req.user;

  if (!studentId || !paymentStatus) {
    return res
      .status(400)
      .json({ error: "Student ID and payment status are required." });
  }

  try {
    const studentRef = ref(database, `gio-students/${studentId}`);
    const studentSnapshot = await get(studentRef);

    if (!studentSnapshot.exists()) {
      return res.status(404).json({ error: "Student not found." });
    }

    const studentData = studentSnapshot.val();

    if (studentData.addedBy !== userId) {
      return res
        .status(403)
        .json({ error: "Unauthorized to update this student." });
    }

    await update(studentRef, { paymentStatus });

    // Recalculate incentives for the coordinator
    await calculateIncentives(req, res); // Reuse the calculateIncentives function

    res
      .status(200)
      .json({ message: "Payment status updated and incentives recalculated." });
  } catch (error) {
    console.error("Error updating payment status:", error);
    res.status(500).json({ error: "Failed to update payment status." });
  }
};

/**
 * Additional Helper Function (Assumed Implementation)
 * Replace this with your actual ranking logic
 */
function getRankAndCategory(score, ranksData, maxScore) {
  // Placeholder: Implement your ranking logic here
  // For example, determine rank based on score percentile
  return {
    rank: 1, // Example rank
    category: "A+", // Example category
  };
}

module.exports = {
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
  getCoordinatorTestCounts,
  updateStudentPaymentStatus,
};
