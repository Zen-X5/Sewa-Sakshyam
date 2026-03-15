const jwt = require("jsonwebtoken");

const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach a lightweight user object from the JWT claims — avoids a DB query on
    // every authenticated request (saves ~1 query per student per 15-second save).
    // The JWT is signed and tamper-proof, so id + role are trustworthy.
    req.user = { _id: decoded.id, id: decoded.id, role: decoded.role };
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ message: "Forbidden" });
  }
  return next();
};

module.exports = {
  protect,
  authorize,
};
