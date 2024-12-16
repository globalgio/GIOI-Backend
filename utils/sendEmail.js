// utils/sendEmail.js
const nodemailer = require('nodemailer');
require('dotenv').config();

const sendEmail = async (mailOptions) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail', // You can use other services
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  });

  await transporter.sendMail(mailOptions);
};

module.exports = { sendEmail };
