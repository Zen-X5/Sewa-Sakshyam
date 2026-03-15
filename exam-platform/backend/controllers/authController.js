const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const EmailOtp = require("../models/EmailOtp");
const User = require("../models/User");
const { sendOtpEmail } = require("../services/otpEmailService");

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();
const otpExpiryMinutes = Number(process.env.OTP_EXPIRY_MINUTES || 10);
const otpVerifiedGraceMinutes = Number(process.env.OTP_VERIFIED_GRACE_MINUTES || 30);

const sendStudentOtp = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const purpose = req.body.purpose || "exam";

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    if (!["register", "login", "exam"].includes(purpose)) {
      return res.status(400).json({ message: "purpose must be register, login, or exam" });
    }

    const existingUser = await User.findOne({ email });

    if (purpose === "register" && existingUser) {
      return res.status(409).json({ message: "Email already registered" });
    }

    if (purpose === "login") {
      if (!existingUser || existingUser.role !== "student") {
        return res.status(404).json({ message: "Student account not found" });
      }

      if (!existingUser.emailVerified) {
        return res.status(403).json({ message: "Email is not verified for this account" });
      }
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + otpExpiryMinutes * 60 * 1000);

    await EmailOtp.findOneAndUpdate(
      { email },
      {
        email,
        otpHash,
        expiresAt,
        verifiedAt: null,
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    const emailSent = await sendOtpEmail({ to: email, otp, expiryMinutes: otpExpiryMinutes });

    return res.json({
      message: `OTP sent to email for ${purpose}`,
      ...(emailSent || process.env.NODE_ENV === "production" ? {} : { devOtp: otp }),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to send OTP" });
  }
};

const verifyStudentOtp = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const otp = String(req.body.otp || "").trim();

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    const otpRecord = await EmailOtp.findOne({ email });
    if (!otpRecord) {
      return res.status(404).json({ message: "OTP request not found for this email" });
    }

    if (new Date() > otpRecord.expiresAt) {
      return res.status(400).json({ message: "OTP expired. Please request a new OTP" });
    }

    const isOtpValid = await bcrypt.compare(otp, otpRecord.otpHash);
    if (!isOtpValid) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    otpRecord.verifiedAt = new Date();
    await otpRecord.save();

    return res.json({ message: "Email verified successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message || "OTP verification failed" });
  }
};

const registerStudent = async (req, res) => {
  try {
    const { name, email, instituteName } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!name || !normalizedEmail || !instituteName) {
      return res.status(400).json({ message: "Name, email and institute name are required" });
    }

    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const otpRecord = await EmailOtp.findOne({ email: normalizedEmail });
    if (!otpRecord || !otpRecord.verifiedAt) {
      return res.status(400).json({ message: "Verify email via OTP before registration" });
    }

    const verificationAgeMs = Date.now() - new Date(otpRecord.verifiedAt).getTime();
    if (verificationAgeMs > otpVerifiedGraceMinutes * 60 * 1000) {
      return res.status(400).json({ message: "Email verification expired. Please verify again" });
    }

    const user = await User.create({
      name,
      email: normalizedEmail,
      role: "student",
      instituteName: instituteName.trim(),
      emailVerified: true,
    });

    await EmailOtp.deleteOne({ email: normalizedEmail });

    const token = signToken(user);

    return res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        instituteName: user.instituteName,
        emailVerified: user.emailVerified,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Registration failed" });
  }
};

const login = async (req, res) => {
  try {
    const { email, password, role } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email: normalizedEmail }).select("+password");

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (role && user.role !== role) {
      return res.status(403).json({ message: `This account is not a ${role}` });
    }

    if (user.role === "student") {
      if (!user.emailVerified) {
        return res.status(403).json({ message: "Email is not verified" });
      }

      const otpRecord = await EmailOtp.findOne({ email: normalizedEmail });
      if (!otpRecord || !otpRecord.verifiedAt) {
        return res.status(400).json({ message: "Verify OTP to login" });
      }

      const verificationAgeMs = Date.now() - new Date(otpRecord.verifiedAt).getTime();
      if (verificationAgeMs > otpVerifiedGraceMinutes * 60 * 1000) {
        return res.status(400).json({ message: "OTP verification expired. Please verify again" });
      }

      await EmailOtp.deleteOne({ email: normalizedEmail });
    } else {
      if (!password) {
        return res.status(400).json({ message: "Password is required" });
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
    }

    const token = signToken(user);

    return res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        instituteName: user.instituteName,
        emailVerified: user.emailVerified,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Login failed" });
  }
};

module.exports = {
  sendStudentOtp,
  verifyStudentOtp,
  registerStudent,
  login,
};
