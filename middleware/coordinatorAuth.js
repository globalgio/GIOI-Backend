// middlewares/authMiddleware.js
const jwt = require("jsonwebtoken");

const coordinatorAuth = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Expecting 'Bearer <token>'

  if (!token) {
    return res.status(403).json({ error: "No token provided." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    req.user = decoded; // Attach decoded user info to the request object
    next();
  } catch (error) {
    return res.status(401).json({ error: "Unauthorized: Invalid token." });
  }
};

module.exports = coordinatorAuth;
