// utils/generateOtp.js
const crypto = require('crypto');

// Generate a 6-digit OTP
const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Generate a unique Transaction ID
const generateTransactionId = () => {
  return crypto.randomBytes(16).toString('hex');
};

module.exports = { generateOtp, generateTransactionId };
