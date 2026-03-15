const path = require("path");
const cors = require("cors");
const dotenv = require("dotenv");
const express = require("express");

dotenv.config({ path: path.resolve(__dirname, ".env") });

const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const studentRoutes = require("./routes/studentRoutes");
const { ensureAdminExists } = require("./services/seedAdminService");

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ message: "Exam Platform API is running" });
});

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/student", studentRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

const startServer = async () => {
  try {
    await connectDB();
    await ensureAdminExists();

    const port = process.env.PORT || 5000;
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
};

startServer();
