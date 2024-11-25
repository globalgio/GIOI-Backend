const express = require("express");
const { registerForm } = require("../controllers/formController");

const router = express.Router();

// Route for form submission
router.post("/submit-form", registerForm);

module.exports = router;
