const mongoose = require("mongoose");

const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error("MONGODB_URI is missing in environment variables");
  }

  await mongoose.connect(mongoUri, {
    maxPoolSize: 20,               // default 5 — handles 500-user burst
    serverSelectionTimeoutMS: 5000, // fail fast if Atlas is unreachable
    socketTimeoutMS: 45000,         // drop stale sockets cleanly
  });
  console.log("MongoDB connected");
};

module.exports = connectDB;
