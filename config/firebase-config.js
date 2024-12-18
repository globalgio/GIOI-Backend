const { initializeApp } = require("firebase/app");
const { getAuth } = require("firebase/auth");
const { getDatabase } = require("firebase/database");
require("dotenv").config(); // Load environment variables

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY, // Ensure this is correct
  authDomain: process.env.FIREBASE_AUTH_DOMAIN, // Ensure this is correct
  databaseURL: process.env.FIREBASE_DATABASE_URL, // Ensure this is correct
  projectId: process.env.FIREBASE_PROJECT_ID, // Ensure this is correct
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID, // Ensure this is correct
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Auth and Database services
const auth = getAuth(app); // Firebase Auth initialization
const database = getDatabase(app); // Firebase Database initialization

module.exports = { app, auth, database };
