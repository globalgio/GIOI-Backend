const { auth, database } = require("../config/firebase-config");
const { createUserWithEmailAndPassword, signInWithEmailAndPassword } = require("firebase/auth");
const { ref, set, get,child } = require("firebase/database");
const jwt = require("jsonwebtoken");

// Admin Login
const adminLogin = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
    }

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
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
            return res.status(404).json({ message: "Admin data not found in database" });
        }

    } catch (error) {
        console.error("Login error:", error);

        if (error.code === "auth/user-not-found" || error.code === "auth/wrong-password") {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        return res.status(500).json({ message: "Login failed", error: error.message });
    }
};



  
// Admin Registration
const registerAdmin = async (req, res) => {
    const { email, password, confirmPassword, name } = req.body;

    if (!email || !password || !confirmPassword || !name) {
        return res.status(400).json({ message: "Email, password, and name are required" });
    }

    if (password !== confirmPassword) {
        return res.status(400).json({ message: "Password and confirm password do not match" });
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Store admin data in Firebase using UID as the key
        const adminRef = ref(database, `admins/${user.uid}`);  // Store by UID
        await set(adminRef, { uid: user.uid, email: user.email, name, role: "admin", createdAt: new Date().toISOString() });

        const token = jwt.sign({ uid: user.uid, email: user.email, role: "admin" }, process.env.JWT_SECRET_KEY, { expiresIn: "30d" });

        res.status(201).json({ message: "Admin registered successfully", uid: user.uid, email: user.email, token });
    } catch (error) {
        console.error("Error registering admin:", error);
        res.status(500).json({ message: "Failed to register admin", error: error.message });
    }
};


// Get All Students
const getAllStudents = async (req, res) => {
  try {
    const studentRef = ref(database, "gio-students/");
    const snapshot = await get(studentRef);

    if (snapshot.exists()) {
      const students = snapshot.val();
      const formattedStudents = Object.keys(students).map(uid => ({ uid, ...students[uid] }));
      res.status(200).json({ message: "Students fetched successfully", students: formattedStudents });
    } else {
      res.status(404).json({ message: "No students found" });
    }
  } catch (error) {
    console.error("Error fetching students:", error);
    res.status(500).json({ message: "Error fetching students", error: error.message });
  }
};

// Generate Reference Code
const generateRefCode = async (req, res) => {
  const { prefix } = req.body;
  const generateRandomNumber = () => Math.floor(1000 + Math.random() * 9000);

  if (!prefix) {
    return res.status(400).json({ error: 'Prefix is required' });
  }

  try {
    const refCode = `${prefix.toUpperCase()}-${generateRandomNumber()}`;

    const refCodeRef = ref(database, `reference_codes/${refCode}`);
    await set(refCodeRef, { prefix, referenceCode: refCode, createdAt: new Date().toISOString() });

    res.json({ referenceCode: refCode });
  } catch (err) {
    console.error('Error generating reference code:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Validate Reference Code
const validateRefCode = async (req, res) => {
  const { referenceCode } = req.body;

  try {
    if (!referenceCode) {
      return res.status(400).json({ error: 'Reference code is required' });
    }

    const trimmedCode = referenceCode.trim();
    const parts = trimmedCode.split('-');

    if (parts.length !== 2 || isNaN(parts[1])) {
      return res.status(400).json({ error: 'Invalid reference code format' });
    }

    const refCodeRef = ref(database, `reference_codes/${trimmedCode}`);
    const snapshot = await get(refCodeRef);

    if (!snapshot.exists()) {
      return res.status(404).json({ success: false });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('Error validating reference code:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

// View Reference Codes
const viewRefCodes = async (req, res) => {
  try {
    const refCodeSnapshot = await get(child(ref(database), 'reference_codes'));

    if (!refCodeSnapshot.exists()) {
      return res.status(404).json({ error: 'No reference codes found' });
    }

    const referenceCodes = [];
    refCodeSnapshot.forEach((childSnapshot) => {
      referenceCodes.push(childSnapshot.val());
    });

    res.status(200).json(referenceCodes);
  } catch (err) {
    console.error('Error fetching reference codes:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

module.exports = {
  adminLogin,
  registerAdmin,
  getAllStudents,
  generateRefCode,
  validateRefCode,
  viewRefCodes
};