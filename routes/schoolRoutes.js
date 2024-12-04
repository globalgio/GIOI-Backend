const express = require("express");
const router = express.Router();

const upload = require("../middleware/multer");
const {
  registerSchool,
  loginSchool,
  bulkUploadStudents,
<<<<<<< HEAD
  getStudentsBySchoolName,
  getSchoolRepresentativeDetails
=======
  fetchUsersBySchool
>>>>>>> f442124f2cb517573a66f0630d856059753a4273
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
