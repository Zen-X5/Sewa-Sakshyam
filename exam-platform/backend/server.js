const path = require("path");
const cors = require("cors");
const dotenv = require("dotenv");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

dotenv.config({ path: path.resolve(__dirname, ".env") });

const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const studentRoutes = require("./routes/studentRoutes");
const { ensureAdminExists } = require("./services/seedAdminService");
const { setIO } = require("./lib/socket");

const app = express();

const allowedOrigins = String(process.env.FRONTEND_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOriginHandler = (origin, callback) => {
  if (!origin) {
    return callback(null, true);
  }

  if (process.env.NODE_ENV !== "production") {
    return callback(null, true);
  }

  if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
    return callback(null, true);
  }

  return callback(new Error(`CORS blocked for origin: ${origin}`));
};

app.use(
  cors({
    origin: corsOriginHandler,
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
    const httpServer = http.createServer(app);
    const io = new Server(httpServer, {
      cors: {
        origin: corsOriginHandler,
        credentials: true,
      },
    });

    setIO(io);

    io.on("connection", (socket) => {
      socket.on("join-exam-room", ({ examId }) => {
        if (!examId) {
          return;
        }
        socket.join(`exam:${examId}`);
      });
    });

    httpServer.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
};

startServer();
