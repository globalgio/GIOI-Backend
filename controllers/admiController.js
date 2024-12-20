const bcrypt = require("bcrypt");
const { auth, database } = require("../config/firebase-config");
const {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} = require("firebase/auth");
const { ref, set, get, remove, child, update } = require("firebase/database");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const xlsx = require("xlsx");
const fs = require("fs");
require("dotenv").config();
const { sendEmail } = require("../utils/sendEmail");
const { approvalEmailTemplate } = require("../utils/templateEmail")
// Admin Login
const adminLogin = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );
    const user = userCredential.user;

    const userRef = ref(database, `admins/${user.uid}`);
    const snapshot = await get(userRef);

    if (snapshot.exists()) {
      const adminData = snapshot.val();

      if (adminData.role === "admin") {
        const token = jwt.sign(
          { uid: user.uid, email: user.email, role: "admin" },
          process.env.JWT_SECRET_KEY,
          { expiresIn: "30d" }
        );

        return res.status(200).json({
          message: "Admin logged in successfully",
          token,
          uid: user.uid,
          email: user.email,
        });
      } else {
        return res.status(403).json({ message: "Access denied. Admins only." });
      }
    } else {
      return res
        .status(404)
        .json({ message: "Admin data not found in database" });
    }
  } catch (error) {
    console.error("Login error:", error);

    if (
      error.code === "auth/user-not-found" ||
      error.code === "auth/wrong-password"
    ) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    return res
      .status(500)
      .json({ message: "Login failed", error: error.message });
  }
};

// Admin Registration
const registerAdmin = async (req, res) => {
  const { email, password, confirmPassword, name } = req.body;

  if (!email || !password || !confirmPassword || !name) {
    return res
      .status(400)
      .json({ message: "Email, password, and name are required" });
  }

  if (password !== confirmPassword) {
    return res
      .status(400)
      .json({ message: "Password and confirm password do not match" });
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );
    const user = userCredential.user;

    // Store admin data in Firebase using UID as the key
    const adminRef = ref(database, `admins/${user.uid}`); // Store by UID
    await set(adminRef, {
      uid: user.uid,
      email: user.email,
      name,
      role: "admin",
      createdAt: new Date().toISOString(),
    });

    const token = jwt.sign(
      { uid: user.uid, email: user.email, role: "admin" },
      process.env.JWT_SECRET_KEY,
      { expiresIn: "30d" }
    );

    res.status(201).json({
      message: "Admin registered successfully",
      uid: user.uid,
      email: user.email,
      token,
    });
  } catch (error) {
    console.error("Error registering admin:", error);
    res
      .status(500)
      .json({ message: "Failed to register admin", error: error.message });
  }
};

// Get All Students
const getAllStudents = async (req, res) => {
  try {
    const studentRef = ref(database, "gio-students/");
    const snapshot = await get(studentRef);

    if (snapshot.exists()) {
      const students = snapshot.val();
      const formattedStudents = Object.keys(students).map((uid) => ({
        uid,
        ...students[uid], // Include all nested data
      }));
      res.status(200).json({
        message: "Students fetched successfully",
        students: formattedStudents,
      });
    } else {
      res.status(404).json({ message: "No students found" });
    }
  } catch (error) {
    console.error("Error fetching students:", error);
    res
      .status(500)
      .json({ message: "Error fetching students", error: error.message });
  }
};

// Generate Reference Code

const generateRefCode = async (req, res) => {
  const { prefix, schoolName } = req.body; // Include schoolName in the request body
  const generateRandomNumber = () => Math.floor(1000 + Math.random() * 9000);

  if (!prefix || !schoolName) {
    return res
      .status(400)
      .json({ error: "Prefix and School Name are required" });
  }

  try {
    const refCode = `${prefix.toUpperCase()}-${generateRandomNumber()}`; // Generate reference code

    const refCodeRef = ref(database, `reference_codes/${refCode}`);
    await set(refCodeRef, {
      prefix,
      schoolName, // Save the school name
      referenceCode: refCode,
      createdAt: new Date().toISOString(),
    });

    res.json({ referenceCode: refCode, schoolName }); // Include schoolName in the response
  } catch (err) {
    console.error("Error generating reference code:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Validate Reference Code
const validateRefCode = async (req, res) => {
  const { referenceCode } = req.body;

  try {
    if (!referenceCode) {
      return res.status(400).json({ error: "Reference code is required" });
    }

    const trimmedCode = referenceCode.trim();
    const parts = trimmedCode.split("-");

    if (parts.length !== 2 || isNaN(parts[1])) {
      return res.status(400).json({ error: "Invalid reference code format" });
    }

    const refCodeRef = ref(database, `reference_codes/${trimmedCode}`);
    const snapshot = await get(refCodeRef);

    if (!snapshot.exists()) {
      return res.status(404).json({ success: false });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("Error validating reference code:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// View Reference Codes
const viewRefCodes = async (req, res) => {
  try {
    const refCodeSnapshot = await get(child(ref(database), "reference_codes"));

    if (!refCodeSnapshot.exists()) {
      return res.status(404).json({ error: "No reference codes found" });
    }

    const referenceCodes = [];
    refCodeSnapshot.forEach((childSnapshot) => {
      referenceCodes.push(childSnapshot.val());
    });

    res.status(200).json(referenceCodes);
  } catch (err) {
    console.error("Error fetching reference codes:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const getAllSchools = async (req, res) => {
  try {
    const schoolsRef = ref(database, "schools/");
    const snapshot = await get(schoolsRef);

    if (snapshot.exists()) {
      const school = snapshot.val();
      const formattedSchools = Object.keys(school).map((uid) => ({
        uid,
        ...school[uid],
      }));
      res.status(200).json({
        message: "school fetched successfully",
        school: formattedSchools,
      });
    } else {
      res.status(404).json({ message: "No school found" });
    }
  } catch (error) {
    console.error("Error fetching school:", error);
    res
      .status(500)
      .json({ message: "Error fetching school", error: error.message });
  }
};

const getApprovedCoordinators = async (req, res) => {
  try {
    const coordinatorsRef = ref(database, "coordinators/");
    const snapshot = await get(coordinatorsRef);

    if (!snapshot.exists()) {
      return res.status(404).json({ message: "No coordinators found." });
    }

    const coordinators = snapshot.val();
    const pendingCoordinators = Object.keys(coordinators)
      .filter((uid) => coordinators[uid].status === "approved")
      .map((uid) => ({ uid, ...coordinators[uid] }));

    res.status(200).json({
      message: "approved coordinators fetched successfully.",
      coordinators: pendingCoordinators,
    });
  } catch (error) {
    console.error("Error fetching approved coordinators:", error);
    res.status(500).json({
      message: "Failed to fetch approved coordinators.",
      error: error.message,
    });
  }
};

const bulkUploadStudents = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded." });
  }

  try {
    // Read the uploaded Excel file
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Convert sheet data to JSON
    const students = xlsx.utils.sheet_to_json(sheet);

    // Helper function to process and upload in batches
    const batchProcessStudents = async (studentsBatch) => {
      let failedEntries = [];
      let successCount = 0;
      const batchUpdates = {}; // This will store all batch updates

      for (const student of studentsBatch) {
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

          // Hash the password before saving
          const hashedPassword = await bcrypt.hash(student.password, 10);
          const uid = uuidv4(); // Generate a valid UID

          // Prepare the student data for batch update
          batchUpdates[`gio-students/${uid}`] = {
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
            paymentStatus: "unpaid",
            testCompleted: false,
            ranks: {},
            createdAt: new Date().toISOString(),
          };

          successCount++;
        } catch (error) {
          console.error("Error processing student:", error.message);
          failedEntries.push({ student, reason: error.message });
        }
      }

      // Perform batch update using update()
      if (Object.keys(batchUpdates).length > 0) {
        await update(ref(database), batchUpdates);
      }

      return { successCount, failedEntries };
    };

    // Split the students into batches (e.g., 50 students per batch)
    const batchSize = 50;
    const studentBatches = [];
    for (let i = 0; i < students.length; i += batchSize) {
      studentBatches.push(students.slice(i, i + batchSize));
    }

    // Process each batch sequentially
    let totalSuccessCount = 0;
    let totalFailedEntries = [];
    for (const batch of studentBatches) {
      const { successCount, failedEntries } = await batchProcessStudents(batch);
      totalSuccessCount += successCount;
      totalFailedEntries = [...totalFailedEntries, ...failedEntries];
    }

    // Remove the uploaded file after processing
    fs.unlinkSync(req.file.path);

    // Return the result
    res.status(200).json({
      message: "Bulk upload completed",
      successCount: totalSuccessCount,
      failedCount: totalFailedEntries.length,
      failedEntries: totalFailedEntries,
    });
  } catch (error) {
    console.error("Error in bulk upload:", error);
    res.status(500).json({
      message: "Failed to upload students",
      error: error.message,
    });
  }
};

// Update or Delete Student Profile
const updateUserProfile = async (req, res) => {
  const { uid, deleteAccount } = req.body; // Extract UID and delete flag

  if (!uid) {
    return res.status(400).json({ message: "Student UID is required." });
  }

  try {
    const userRef = ref(database, `gio-students/${uid}`);
    const snapshot = await get(userRef);

    if (!snapshot.exists()) {
      return res
        .status(404)
        .json({ message: "Student not found in the database." });
    }

    // Handle Account Deletion
    if (deleteAccount) {
      await remove(userRef); // Deletes the student record
      return res
        .status(200)
        .json({ message: "Student account deleted successfully." });
    }

    // Handle Profile Update
    const {
      name,
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

    const userData = snapshot.val(); // Fetch existing user data

    // Validate passwords match (if provided)
    if (password && confirmPassword && password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match." });
    }

    // Prepare updated data, retaining existing data for fields not provided
    const updatedData = {
      ...userData,
      name: name || userData.name,
      username: username || userData.username,
      PhoneNumber: PhoneNumber || userData.PhoneNumber,
      teacherPhoneNumber: teacherPhoneNumber || userData.teacherPhoneNumber,
      whatsappNumber: whatsappNumber || userData.whatsappNumber,
      standard: standard || userData.standard,
      schoolName: schoolName || userData.schoolName,
      country: country || userData.country,
      state: state || userData.state,
      city: city || userData.city,
    };

    // If password is provided, hash and update it
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updatedData.password = hashedPassword;
    }

    // Save updated data back to the database
    await set(userRef, updatedData);

    return res.status(200).json({
      message: "Student profile updated successfully.",
      user: updatedData,
    });
  } catch (error) {
    console.error("Error in student profile update/delete:", error.message);
    return res.status(500).json({
      message: "Failed to update/delete student profile.",
      error: error.message,
    });
  }
};
const getAllCoordinator = async (req, res) => {
  try {
    const coordinatorsRef = ref(database, "coordinators/");
    const snapshot = await get(coordinatorsRef);

    if (snapshot.exists()) {
      const coordinator = snapshot.val();
      const formattedCoordinators = Object.keys(coordinator).map((uid) => ({
        uid,
        ...coordinator[uid],
      }));
      res.status(200).json({
        message: "Coordinators fetched successfully",
        coordinators: formattedCoordinators,
      });
    } else {
      res.status(404).json({ message: "No coordinators found" });
    }
  } catch (error) {
    console.error("Error fetching coordinators:", error);
    res
      .status(500)
      .json({ message: "Error fetching coordinators", error: error.message });
  }
};
// adminController.js (approveCoordinator function)
const approveCoordinator = async (req, res) => {
  const { uid } = req.body;

  if (!uid) {
    return res.status(400).json({ message: "Coordinator UID is required" });
  }

  try {
    const coordinatorRef = ref(database, `coordinators/${uid}`);
    const snapshot = await get(coordinatorRef);

    if (!snapshot.exists()) {
      return res.status(404).json({ message: "Coordinator not found" });
    }

    const coordinatorData = snapshot.val();

    if (coordinatorData.status === "approved") {
      return res
        .status(400)
        .json({ message: "Coordinator is already approved" });
    }

    await update(coordinatorRef, {
      status: "approved",
      approvedAt: new Date().toISOString(),
    });

    const mailOptions = {
      from: process.env.MAIL_USER,
      to: coordinatorData.email,
      subject: "Your Coordinator Account Has Been Approved!",
      html: approvalEmailTemplate(coordinatorData.name),
    };

    await sendEmail(mailOptions);

    return res.status(200).json({ message: "Coordinator approved successfully" });
  } catch (error) {
    console.error("Error approving coordinator:", error);
    return res
      .status(500)
      .json({ message: "Failed to approve coordinator", error: error.message });
  }
};
const getPendingCoordinators = async (req, res) => {
  try {
    const coordinatorsRef = ref(database, "coordinators/");
    const snapshot = await get(coordinatorsRef);

    if (!snapshot.exists()) {
      return res.status(404).json({ message: "No coordinators found." });
    }

    const coordinators = snapshot.val();
    const pendingCoordinators = Object.keys(coordinators)
      .filter((uid) => coordinators[uid].status === "pending")
      .map((uid) => ({ uid, ...coordinators[uid] }));

    res
      .status(200)
      .json({
        message: "Pending coordinators fetched successfully.",
        coordinators: pendingCoordinators,
      });
  } catch (error) {
    console.error("Error fetching pending coordinators:", error);
    res
      .status(500)
      .json({
        message: "Failed to fetch pending coordinators.",
        error: error.message,
      });
  }
};
const deleteCoordinator = async (req, res) => {
  const { uid } = req.body;

  if (!uid) {
    return res.status(400).json({ message: "Coordinator UID is required" });
  }

  try {
    const coordinatorRef = ref(database, `coordinators/${uid}`);
    const snapshot = await get(coordinatorRef);

    if (!snapshot.exists()) {
      return res.status(404).json({ message: "Coordinator not found" });
    }

    await remove(coordinatorRef);

    return res.status(200).json({ message: "Coordinator deleted successfully" });
  } catch (error) {
    console.error("Error deleting coordinator:", error);
    return res.status(500).json({ message: "Failed to delete coordinator", error: error.message });
  }
};

// This function assumes you have a middleware that sets req.user = { userId: ... } from the JWT
// Get Coordinator Payment Details
const getCoordinatorPaymentDetails = async (req, res) => {
  const { userId } = req.query; // Using userId from query params

  if (!userId) {
    return res.status(400).json({ error: "User ID is required in query parameter." });
  }

  try {
    const userRef = ref(database, `coordinators/${userId}`);
    const snapshot = await get(userRef);

    if (!snapshot.exists()) {
      return res.status(404).json({ error: "Coordinator not found." });
    }

    const data = snapshot.val();
    const paymentDetails = {
      bankName: data.bankName || "",
      accountNumber: data.accountNumber || "",
      ifsc: data.ifsc || "",
      branch: data.branch || "",
      upiId: data.upiId || "",
      accountHolderName: data.accountHolderName || "",
    };

    return res.status(200).json({ paymentDetails });
  } catch (error) {
    console.error("Error fetching payment details:", error);
    return res.status(500).json({ error: "Failed to fetch payment details." });
  }
};
// Bulk upload coordinator function
const bulkUploadCoordinators = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded." });
  }

  try {
    console.log("Processing file:", req.file.path);
    // Read uploaded Excel file
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Convert sheet data to JSON
    const coordinators = xlsx.utils.sheet_to_json(sheet);

    let failedEntries = [];
    let successCount = 0;

    // Iterate through each coordinator and process
    for (const [index, coordinator] of coordinators.entries()) {
      try {
        // Validate required fields
        if (
          !coordinator.email ||
          !coordinator.password ||
          !coordinator.phoneNumber ||
          !coordinator.whatsappNumber ||
          !coordinator.country ||
          !coordinator.state ||
          !coordinator.city ||
          !coordinator.name ||
          !coordinator.category
        ) {
          failedEntries.push({
            coordinator,
            reason: "Missing required fields",
            row: index + 2,
          });
          continue;
        }

        // Hash the password before saving
        const hashedPassword = await bcrypt.hash(coordinator.password, 10); // Hash with salt rounds

        // Generate a unique ID for the coordinator
        const userId = uuidv4();

        // Map categories to the correct details
        const categoryDetails = {
          "Starter Partner": { min: 1, max: 100, perStudentShare: 75 },
          "Bronze Partner": { min: 101, max: 200, perStudentShare: 85 },
          "Silver Partner": { min: 201, max: 300, perStudentShare: 95 },
          "Gold Partner": { min: 301, max: 400, perStudentShare: 110 },
          "Platinum Partner": { min: 401, max: Infinity, perStudentShare: 125 },
        };

        const selectedCategory = categoryDetails[coordinator.category];
        if (!selectedCategory) {
          failedEntries.push({
            coordinator,
            reason: `Invalid category "${coordinator.category}"`,
            row: index + 2,
          });
          continue;
        }

        // Prepare coordinator data
        const coordinatorData = {
          userId,
          email: coordinator.email,
          password: hashedPassword,
          phoneNumber: coordinator.phoneNumber,
          whatsappNumber: coordinator.whatsappNumber,
          country: coordinator.country,
          state: coordinator.state,
          city: coordinator.city,
          name: coordinator.name,
          role: "coordinator",
          createdAt: new Date().toISOString(),
          category: coordinator.category,
          min: selectedCategory.min,
          max: selectedCategory.max,
          perStudentShare: selectedCategory.perStudentShare,
          totalStudents: 0, // Set default to 0
          totalPaidStudents: 0,
          totalIncentives: 0,
          bonusAmount: 0,
          totalEarnings: 0,
          status: "approved", // Automatically set to approved
        };
        console.log("hi juned");

        console.log(coordinatorData)
        // Save the coordinator data to Firebase
        const coordinatorRef = ref(database, `coordinators/${userId}`);
        await set(coordinatorRef, coordinatorData);

        successCount++;
      } catch (error) {
        console.error(`Error processing coordinator at row ${index + 2}:`, error.message);
        failedEntries.push({
          coordinator,
          reason: error.message,
          row: index + 2,
        });
      }
    }

    // Remove the uploaded file after processing
    try {
      await fs.unlink(req.file.path);
      console.log("File successfully deleted");
    } catch (err) {
      console.error("Error deleting file:", err.message);
    }

    // Return the result
    res.status(200).json({
      message: "Bulk upload of coordinators completed.",
      successCount,
      failedCount: failedEntries.length,
      failedEntries,
    });
  } catch (error) {
    console.error("Error in bulk upload:", error.message);
    res.status(500).json({
      message: "Bulk upload failed.",
      error: error.message,
    });
  }
};


const getRequestCallbacks = async (req, res) => {
  try {
    // Reference the "RequestCallback" node in the Firebase database
    const callbackRef = ref(database, "RequestCallback/");
    const snapshot = await get(callbackRef);

    if (snapshot.exists()) {
      // Convert snapshot data into an array of request objects
      const requestCallbacks = Object.keys(snapshot.val()).map((key) => ({
        id: key, // Unique ID for each request callback
        ...snapshot.val()[key], // Include all nested data
      }));

      return res.status(200).json({
        message: "Request callbacks retrieved successfully",
        requestCallbacks,
      });
    } else {
      return res.status(404).json({ message: "No request callbacks found." });
    }
  } catch (error) {
    console.error("Error retrieving request callbacks:", error);
    return res.status(500).json({ error: "Failed to retrieve request callbacks." });
  }
};



module.exports = {
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
  getCoordinatorPaymentDetails,
  bulkUploadCoordinators,
  getRequestCallbacks

};