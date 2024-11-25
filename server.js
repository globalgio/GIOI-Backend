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
const corsOptions = {
  origin: "*", // Allow all origins
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS", // Allow all methods
  allowedHeaders: "Content-Type,Authorization", // Specify allowed headers
  credentials: true, // Allow credentials (optional; set to false if not required)
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Handle preflight requests
app.options("*", cors(corsOptions)); // Explicitly handle OPTIONS method // Enable CORS for preflight requests

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
