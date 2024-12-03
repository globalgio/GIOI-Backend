// middleware/authAdmin.js
const jwt = require("jsonwebtoken");

const authenticateAdmin = (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1]; // Extract token from Authorization header

  if (!token) {
    return res.status(403).json({ message: "No token provided, access denied." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY); // Decode the token

    if (decoded.role !== "admin") {
      return res.status(403).json({ message: "You do not have admin rights." });
    }

    req.user = decoded; // Attach the decoded user information to the request object
    next(); // Proceed to the next middleware or route handler
  } catch (error) {
    console.error("Token verification error:", error);
    res.status(403).json({ message: "Invalid token, access denied." });
  }
};

module.exports = authenticateAdmin; // Ensure proper export
