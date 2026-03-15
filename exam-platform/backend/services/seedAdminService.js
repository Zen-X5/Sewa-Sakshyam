const User = require("../models/User");

const ensureAdminExists = async () => {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    return;
  }

  const existingAdmin = await User.findOne({ email: adminEmail.toLowerCase() });
  if (existingAdmin) {
    return;
  }

  await User.create({
    name: process.env.ADMIN_NAME || "System Admin",
    email: adminEmail.toLowerCase(),
    password: adminPassword,
    role: "admin",
  });

  console.log(`Default admin created: ${adminEmail}`);
};

module.exports = {
  ensureAdminExists,
};
