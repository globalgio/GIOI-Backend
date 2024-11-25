const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const userRoutes = require("./routes/userRoutes"); // Import user routes
const cookieParser = require("cookie-parser");

const razorPayment = require("./routes/razorpayRoutes");
// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5002;

// Middleware
app.use(helmet()); // Adds security headers
const allowedOrigins = ["https://gio.international"]; // Correct origin without trailing slash

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests if the origin is in the allowed list or if the origin is undefined (e.g., server-to-server requests)
    if (allowedOrigins.includes(origin) || !origin) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true, // Allow credentials (e.g., cookies, authorization headers)
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS", // Explicitly allow all required methods
  allowedHeaders: "Content-Type,Authorization", // Specify allowed headers
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Handle preflight requests
app.options("*", cors(corsOptions)); // Enable CORS for preflight requests

app.use(cookieParser()); // Enables cookie parsing for authentication tokens
app.use(bodyParser.json()); // Parses JSON requests
app.use(bodyParser.urlencoded({ extended: true })); // Parses URL-encoded data

// Define API routes
app.use("/api/gio", userRoutes); // Use the userRoutes for "/api/users" path
app.use("/api/payment", razorPayment); // Use the razorPayment
// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
app.get("/", (req, res) => {
  res.send("Server is running");
});
