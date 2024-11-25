const { database } = require("../config/firebase-config");
const { ref, push, set, update } = require("firebase/database");

// Form Submission Controller
const registerForm = async (req, res) => {
  const {
    userId, // Assuming userId is being passed to associate form submission with the user
    name,
    email,
    country,
    state,
    city,
    PhoneNumber,
    teacherPhoneNumber,
    whatsappNumber,
    standard,
    schoolName,
  } = req.body;

  // Validation
  if (
    !name ||
    !email ||
    !country ||
    !state ||
    !city ||
    !PhoneNumber ||
    !teacherPhoneNumber ||
    !standard ||
    !schoolName
  ) {
    return res.status(400).json({ message: "All fields are required." });
  }

  try {
    // Generate a unique key for each submission and save the data
    const formRef = ref(database, "registrations-gio-profile");
    const newEntryRef = push(formRef); // `push` returns a reference to the new node

    // Save the form data
    await set(newEntryRef, {
      id: newEntryRef.key, // Store the generated unique key
      name,
      email,
      country,
      state,
      city,
      PhoneNumber,
      teacherPhoneNumber,
      whatsappNumber,
      standard,
      schoolName,
      submittedAt: new Date().toISOString(),
    });

    // Update the user's profile completion status
    const userRef = ref(database, `users/${userId}`);
    await update(userRef, { isComplete: true });

    res
      .status(201)
      .json({ message: "Form submitted successfully.", isComplete: true });
  } catch (error) {
    console.error("Error saving form data:", error);
    res.status(500).json({ message: "Failed to submit the form." });
  }
};

module.exports = { registerForm };
