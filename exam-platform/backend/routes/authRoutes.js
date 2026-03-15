const express = require("express");
const { login, registerStudent, sendStudentOtp, verifyStudentOtp } = require("../controllers/authController");

const router = express.Router();

router.post("/send-otp", sendStudentOtp);
router.post("/verify-otp", verifyStudentOtp);
router.post("/register", registerStudent);
router.post("/login", login);

module.exports = router;
