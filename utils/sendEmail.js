// mailer.js
const nodemailer = require("nodemailer");

// Create a transporter using Gmail SMTP
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.MAIL_USER, // Your Gmail address
    pass: process.env.MAIL_PASS, // Your Gmail App Password
  },
});

// Verify the connection configuration
transporter.verify((error, success) => {
  if (error) {
    console.error("Error configuring Nodemailer:", error);
  } else {
   
  }
});

/**
 * Send an email
 * @param {Object} mailOptions - Options for the email
 * @returns {Promise}
 */
const sendEmail = (mailOptions) => {
  return new Promise((resolve, reject) => {
    transporter.sendMail(mailOptions, (err, info) => {
      if (err) {
        console.error("Error sending email:", err);
        reject(err);
      } else {
     
        resolve(info);
      }
    });
  });
};

module.exports = { sendEmail };
