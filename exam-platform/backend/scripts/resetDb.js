const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const resetDb = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI missing in backend/.env");
  }

  await mongoose.connect(process.env.MONGODB_URI);
  await mongoose.connection.db.dropDatabase();
  console.log(`Database dropped: ${mongoose.connection.name}`);
  await mongoose.disconnect();
};

resetDb().catch(async (error) => {
  console.error("DB reset failed:", error.message);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore disconnect errors
  }
  process.exit(1);
});
