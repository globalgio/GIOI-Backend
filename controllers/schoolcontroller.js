const { auth, database } = require("../config/firebase-config");
const {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} = require("firebase/auth");
const {
  ref,


  get,
  set,

} = require("firebase/database");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt"); // Assuming bcrypt is used for password hashing
const { v4: uuidv4 } = require("uuid");
const xlsx = require("xlsx");
const fs = require("fs");
require("dotenv").config();

const registerSchool = async (req, res) => {
  const { schoolName, email, password, confirmPassword, principalName } =
    req.body;

  // Validate all required fields
  if (!schoolName || !email || !password || !confirmPassword || !principalName) {
    return res.status(400).json({
      message:
        "All fields are required: schoolName, email, password, confirmPassword, and principalName.",
    });
  }

  // Validate if password and confirm password match
  if (password !== confirmPassword) {
    return res
      .status(400)
      .json({ message: "Password and confirm password do not match." });
  }

  try {
    // Register user in Firebase Authentication
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );
    const user = userCredential.user;

    // Save school details in Firebase Database
    const schoolRef = ref(database, `schools/${user.uid}`);
    await set(schoolRef, {
      uid: user.uid,
      email,
      schoolName,
      principalName, // Store the principal's name
      role: "school", // Assigning the role as 'school'
      createdAt: new Date().toISOString(),
    });

    // Generate JWT token with role included
    const token = jwt.sign(
      { uid: user.uid, email, role: "school" },
      process.env.JWT_SECRET_KEY,
      { expiresIn: "30d" }
    );

    res.status(201).json({ message: "School registered successfully", token });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Failed to register school", error: error.message });
  }
};

// Login for school
const loginSchool = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .json({ message: "Email and password are required." });
  }

  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );
    const user = userCredential.user;

    const token = jwt.sign(
      { uid: user.uid, email, role: "school" },
      process.env.JWT_SECRET_KEY,
      { expiresIn: "30d" }
    );

    res.status(200).json({ message: "Login successful", token });
  } catch (error) {
    console.error(error);
    res
      .status(401)
      .json({ message: "Invalid email or password", error: error.message });
  }
};

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

    // Save each student in the "gio-students" table
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

        // Hash the password before saving
        const hashedPassword = await bcrypt.hash(student.password, 10); // Hash with salt rounds

        // Generate a unique ID for the user
        const uid = uuidv4(); // Generate UID for each student

        // Save user details to the Realtime Database
        const userRef = ref(database, `gio-students/${uid}`);
        await set(userRef, {
          name: student.name, // Name from the uploaded data
          username: student.username, // Username from the uploaded data
          password: hashedPassword, // Storing the hashed password
          PhoneNumber: student.PhoneNumber,
          teacherPhoneNumber: student.teacherPhoneNumber,
          whatsappNumber: student.whatsappNumber,
          standard: student.standard,
          schoolName: student.schoolName,
          country: student.country,
          state: student.state,
          city: student.city,
          paymentStatus: "unpaid", // Default value, can be updated later
          testCompleted: false, // Default value, can be updated later
          ranks: {}, // Default empty object for ranks
          createdAt: new Date().toISOString(), // Timestamp of creation
        });

        // Generate JWT token for the student after registration
        const token = jwt.sign(
          { uid, username: student.username, name: student.name }, // Include UID, username, and name in the JWT payload
          process.env.JWT_SECRET_KEY, // Secret key for signing the token
          { expiresIn: "1d" } // Expiration time for the token (1 day)
        );

        successCount++;

        // Add token to the student data in the response
        student.token = token;
      } catch (error) {
        console.error("Error processing student:", error.message);
        failedEntries.push({ student, reason: error.message });
      }
    }

    // Remove the uploaded file after processing
    fs.unlinkSync(req.file.path);

    res.status(200).json({
      message: "Bulk upload completed",
      successCount,
      failedCount: failedEntries.length,
      failedEntries,
    });
  } catch (error) {
    console.error("Error in bulk upload:", error);
    res.status(500).json({
      message: "Failed to upload students",
      error: error.message,
    });
  }
};

const fetchUsersBySchool = async (req, res) => {
  const { schoolName, standard } = req.query;

  if (!schoolName) {
    return res.status(400).json({ message: "School name is required." });
  }

  try {
  

    const usersRef = ref(database, "gio-students");
    const snapshot = await get(usersRef);

    if (!snapshot.exists()) {
     
      return res.status(200).json({ message: "No students found.", users: [] });
    }

    const standardQuery = standard ? standard.trim().toLowerCase() : "";
    const users = [];

    snapshot.forEach((childSnapshot) => {
      const user = childSnapshot.val();
     

      const matchesSchool =
        user.schoolName &&
        user.schoolName.trim().toLowerCase() ===
          schoolName.trim().toLowerCase();

      let matchesStandard = false;

      if (!standardQuery) {
        matchesStandard = true; // No filter applied
      } else {
        const normalizedStandard =
          typeof user.standard === "number"
            ? String(user.standard)
            : user.standard.trim().toLowerCase();

        const formattedStandardQuery = standardQuery.replace(/th$/, "");

        matchesStandard =
          normalizedStandard === formattedStandardQuery ||
          normalizedStandard === `${formattedStandardQuery}th`;
      }

      if (matchesSchool && matchesStandard) {
        // Include marks, certificateCodes, and other student information
        users.push({
          uid: user.uid,
          name: user.name,
          username: user.username,
          PhoneNumber: user.PhoneNumber,
          teacherPhoneNumber: user.teacherPhoneNumber,
          whatsappNumber: user.whatsappNumber,
          standard: user.standard,
          schoolName: user.schoolName,
          country: user.country,
          state: user.state,
          city: user.city,
          paymentStatus: user.paymentStatus,
          testCompleted: user.testCompleted,
          createdAt: user.createdAt,
          marks: user.marks || {}, // Include marks (default to empty object if not available)
          certificateCodes: user.certificateCodes || [], // Include certificateCodes (default to empty array if not available)
          ranks: {
            live: user.ranks?.live || {},
            mock: user.ranks?.mock || {},
          },
        });
      }
    });

    // If no users match the criteria, return an empty array
    if (users.length === 0) {
     
      return res.status(200).json({
        message: `No users found for school '${schoolName}' and standard '${
          standardQuery || "all"
        }'.`,
        users: [],
      });
    }

    res.status(200).json({ message: "Users fetched successfully.", users });
  } catch (error) {
    console.error("Error fetching users:", error.message);
    res
      .status(500)
      .json({ message: "Failed to fetch users", error: error.message });
  }
};


const getSchoolRepresentativeDetails = async (req, res) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    return res
      .status(401)
      .json({ message: "Authorization token is required." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

    // Fetch school details from Firebase Database using decoded token UID
    const schoolRef = ref(database, `schools/${decoded.uid}`);
    const snapshot = await get(schoolRef);

    if (!snapshot.exists()) {
      return res
        .status(404)
        .json({ message: "School representative not found." });
    }

    const schoolData = snapshot.val();

    // Reference to all students in gio-students
    const studentsRef = ref(database, "gio-students");
    const studentsSnapshot = await get(studentsRef);

    let totalPracticeTests = 0; // Mock test count
    let finalPracticeTests = 0; // Live test count

    if (studentsSnapshot.exists()) {
      studentsSnapshot.forEach((childSnapshot) => {
        const student = childSnapshot.val();

        if (
          student.schoolName &&
          student.schoolName.trim().toLowerCase() ===
            schoolData.schoolName.trim().toLowerCase()
        ) {
          const marks = student.marks || {};
          totalPracticeTests += marks.mock ? Object.keys(marks.mock).length : 0;
          finalPracticeTests += marks.live ? Object.keys(marks.live).length : 0;
        }
      });
    }

    res.status(200).json({
      message: "School representative details fetched successfully.",
      representative: {
        uid: decoded.uid,
        email: schoolData.email,
        schoolName: schoolData.schoolName,
        principalName: schoolData.principalName,
        role: schoolData.role || "school",
        createdAt: schoolData.createdAt || null,
      },
      practiceTestCounts: {
        totalPracticeTests,
        finalPracticeTests,
      },
    });
  } catch (error) {
    console.error(
      "Error fetching school representative details:",
      error.message
    );
    return res.status(500).json({
      message: "Failed to fetch school representative details",
      error: error.message,
    });
  }
};
module.exports = {
  registerSchool,
  loginSchool,
  bulkUploadStudents,
  fetchUsersBySchool,
  getSchoolRepresentativeDetails,
};
