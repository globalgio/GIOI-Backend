const debug = require("debug")("app:server");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const userRoutes = require("./routes/userRoutes");
const adminRoutes = require("./routes/adminRoutes");
const scoolRoutes = require("./routes/schoolRoutes");
const cookieParser = require("cookie-parser");

const path = require("path");
const razorPayment = require("./routes/razorpayRoutes");
const coordinatorRoutes = require("./routes/coordinatorRoutes");



// Load environment variables
dotenv.config();

const app = express();

// Set PORT from environment or default to 5002
const PORT = process.env.PORT || 5002;

// Middleware
app.use(helmet());
const corsOptions = {
  origin: "*",
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
  allowedHeaders:
    "Origin, X-Requested-With, Content-Type, Accept, Authorization",
  credentials: true,
};
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use("/static", express.static(path.join(__dirname, "public")));

// Define API routes
app.use("/api/gio", userRoutes);
app.use("/api/payment", razorPayment);
app.use("/api/admin", adminRoutes);
app.use("/api/school", scoolRoutes);
app.use("/api/coordinator", coordinatorRoutes);

// Default route
app.get("/", (req, res) => {
  res.send("Server is running");
});

// Start the server (use `server.listen` for WebSocket compatibility)
app.listen(PORT, () => {
  debug(`Server is running on http://localhost:${PORT}`);
});
