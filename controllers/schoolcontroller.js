const { auth, database } = require("../config/firebase-config");
const { createUserWithEmailAndPassword, signInWithEmailAndPassword } = require("firebase/auth");
const { ref, query, orderByChild, equalTo, get,set,push} = require("firebase/database");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt"); // Assuming bcrypt is used for password hashing
const { v4: uuidv4 } = require("uuid"); 
const xlsx = require("xlsx");
const fs = require("fs");
require("dotenv").config();

const registerSchool = async (req, res) => {
    const { schoolName, email, password, confirmPassword } = req.body;

    if (!schoolName || !email || !password || !confirmPassword) {
        return res.status(400).json({ message: "All fields are required: schoolName, email, password, confirmPassword." });
    }

    if (password !== confirmPassword) {
        return res.status(400).json({ message: "Password and confirm password do not match." });
    }

    try {
        // Register user in Firebase Authentication
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Save school details in Firebase Database
        const schoolRef = ref(database, `schools/${user.uid}`);
        await set(schoolRef, {
            uid: user.uid,
            email,
            schoolName,
            role: 'school', // Assigning the role as 'school'
            createdAt: new Date().toISOString(),
        });

        // Generate JWT token with role included
        const token = jwt.sign({ uid: user.uid, email, role: 'school' }, process.env.JWT_SECRET_KEY, { expiresIn: "30d" });

        res.status(201).json({ message: "School registered successfully", token });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to register school", error: error.message });
    }
};
// Login for school
const loginSchool = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required." });
  }

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    const token = jwt.sign({ uid: user.uid, email, role: 'school' }, process.env.JWT_SECRET_KEY, { expiresIn: "30d" });

    res.status(200).json({ message: "Login successful", token });
  } catch (error) {
    console.error(error);
    res.status(401).json({ message: "Invalid email or password", error: error.message });
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
          const userRef = ref(database, `gio-students/${uid}`);  // This is where data will be saved
          await push(userRef, {
            uid,                    // Save the UID
            name: student.name,      // Name from the uploaded data
            username: student.username,  // Username from the uploaded data
            password: hashedPassword,    // Storing the hashed password
            PhoneNumber: student.PhoneNumber,
            teacherPhoneNumber: student.teacherPhoneNumber,
            whatsappNumber: student.whatsappNumber,
            standard: student.standard,
            schoolName: student.schoolName,
            country: student.country,
            state: student.state,
            city: student.city,
            paymentStatus: "unpaid",  // Default value, can be updated later
            testCompleted: false,     // Default value, can be updated later
            ranks: {},                // Default empty object for ranks
            createdAt: new Date().toISOString(),  // Timestamp of creation
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


const fetchUsersBySchool = async (req, res) => {
    const { schoolName } = req.body;

    if (!schoolName) {
        return res.status(400).json({ message: "School name is required in the request body." });
    }

    try {
        // Reference to the users data
        const usersRef = ref(database, "gio-students");

        // Get all users data
        const snapshot = await get(usersRef);

        if (!snapshot.exists()) {
            return res.status(404).json({ message: "No users found." });
        }

        const users = [];
        snapshot.forEach((childSnapshot) => {
            const user = childSnapshot.val();

            // Only include users whose schoolName matches the requested one
            if (user.schoolName === schoolName) {
                users.push({
                    name: user.name,
                    standard: user.standard,
                    schoolName: user.schoolName,
                    paymentStatus: user.paymentStatus,
                    testCompleted: user.testCompleted,
                    ranks: user.ranks,
                });
            }
        });

        if (users.length === 0) {
            return res.status(404).json({ message: `No users found for ${schoolName}.` });
        }

        res.status(200).json({
            message: "Users fetched successfully.",
            users,
        });
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ message: "Failed to fetch users", error: error.message });
    }
};

  module.exports = { registerSchool, loginSchool, bulkUploadStudents,fetchUsersBySchool };
