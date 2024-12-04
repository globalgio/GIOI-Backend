const express = require("express");
const router = express.Router();

const upload = require("../middleware/multer");
const {
  registerSchool,
  loginSchool,
  bulkUploadStudents,
  fetchUsersBySchool,
  getSchoolRepresentativeDetails

} = require("../controllers/schoolcontroller");


// School authentication routes
router.post("/register", registerSchool);
router.post("/login", loginSchool);

// Bulk upload route
router.post("/bulk-upload", upload.single("file"), bulkUploadStudents);

router.get("/representative", getSchoolRepresentativeDetails);
// GET ALL STUDENTS DETAILS ON VIEW
router.get("/fetch-users", fetchUsersBySchool);


module.exports = router;
