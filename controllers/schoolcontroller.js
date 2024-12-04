const { auth, database } = require("../config/firebase-config");
const {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} = require("firebase/auth");
const {
  ref,
  query,
  orderByChild,
  equalTo,
  get,
  set,
  push,
} = require("firebase/database");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt"); // Assuming bcrypt is used for password hashing
const { v4: uuidv4 } = require("uuid");
const xlsx = require("xlsx");
const fs = require("fs");
require("dotenv").config();

const registerSchool = async (req, res) => {
  const { schoolName, email, password, confirmPassword } = req.body;

  if (!schoolName || !email || !password || !confirmPassword) {
    return res
      .status(400)
      .json({
        message:
          "All fields are required: schoolName, email, password, confirmPassword.",
      });
  }

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
    console.log("Processing file:", req.file.path);

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
        if (!student.email || !student.password || !student.PhoneNumber) {
          failedEntries.push({
            student,
            reason: "Missing required fields (email, password, or PhoneNumber)",
          });
          continue;
        }

        // Hash the password before saving
        const hashedPassword = await bcrypt.hash(student.password, 10); // Hash with salt rounds

        // Generate a unique ID for the user
        const uid = uuidv4(); // Generate UID for each student

        // Save user details to the Realtime Database in the same "gio-students" table as registration
        const userRef = ref(database, `gio-students/${uid}`); // This is where data will be saved
        await push(userRef, {
          uid, // Save the UID
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

        successCount++;
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

const getStudentsBySchoolName = async (req, res) => {
  // Get school name from request body
  const { schoolName } = req.body; // Access schoolName from body

  console.log("Received school name:", schoolName);

  // Get token from headers
  const token = req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    return res
      .status(401)
      .json({ message: "Authorization token is required." });
  }

  try {
    // Decode the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

    if (!schoolName) {
      return res.status(400).json({ message: "School name is required." });
    }

    try {
      // Create a query to filter students by schoolName
      const studentsRef = ref(database, `gio-students/${uid}`); // Reference to the 'gio-students' node in Firebase DB
      const studentsQuery = query(
        studentsRef,
        orderByChild("schoolName"),
        equalTo(schoolName)
      ); // Query to filter students by schoolName

      // Fetch data using the query
      const snapshot = await get(studentsQuery);

      if (!snapshot.exists()) {
        return res
          .status(404)
          .json({
            message: `No students found for the school: ${schoolName}.`,
          });
      }

      // If students are found, return the student data with additional info
      const studentsData = snapshot.val();

      // Format the response to match the desired structure
      const formattedStudents = Object.keys(studentsData).map((key) => {
        const student = studentsData[key];
        return {
          uid: key, // Use the Firebase-generated UID as the student identifier
          name: student.name,
          standard: student.standard,
          schoolName: student.schoolName,
          paymentStatus: student.paymentStatus || null, // Default value if not present
          testCompleted: student.testCompleted || false, // Default to false if not present
          marks: student.marks || [], // Default to empty array if not present
          rankings: student.rankings || {}, // Default to empty object if not present
        };
      });

      // Return the formatted response with the message
      return res.status(200).json({
        message: "Students fetched successfully.",
        students: formattedStudents,
      });
    } catch (error) {
      console.error("Error fetching students data:", error.message);
      return res
        .status(500)
        .json({
          message: "Failed to fetch student data",
          error: error.message,
        });
    }
  } catch (error) {
    return res.status(401).json({ message: "Invalid token or token expired." });
  }
};

const getSchoolRepresentativeDetails = async (req, res) => {
  // Get token from headers
  const token = req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    return res
      .status(401)
      .json({ message: "Authorization token is required." });
  }

  try {
    // Decode the token
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

    // Return the representative's details
    return res.status(200).json({
      message: "School representative details fetched successfully.",
      representative: {
        uid: decoded.uid,
        email: schoolData.email,
        schoolName: schoolData.schoolName,
        role: schoolData.role || "school",
        createdAt: schoolData.createdAt || null,
      },
    });
  } catch (error) {
    console.error(
      "Error fetching school representative details:",
      error.message
    );
    return res
      .status(500)
      .json({
        message: "Failed to fetch school representative details",
        error: error.message,
      });
  }
};
module.exports = {
  registerSchool,
  loginSchool,
  bulkUploadStudents,
  getStudentsBySchoolName,
  getSchoolRepresentativeDetails
};
