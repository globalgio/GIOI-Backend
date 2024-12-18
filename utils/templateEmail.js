// emailTemplates.js

/**
 * Registration Confirmation Email Template
 * @param {string} name - Coordinator's name
 * @returns {string} - HTML email content
 */
const registrationEmailTemplate = (name) => {
  return `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>Welcome to Global Innovator Olympiad, ${name}!</h2>
        <p>Thank you for registering as a Coordinator. Your account has been successfully created and is now pending approval by our administration team.</p>
        <p>We appreciate your interest and commitment. Once approved, you will receive a notification to start accessing your coordinator dashboard.</p>
        <p>If you have any questions or need assistance, feel free to contact us at <a href="tel:9594402916">+91 959 440 2916</a>.</p>
        <br/>
        <p>Best Regards,</p>
        <p>The Global Innovator Olympiad Team</p>
      </div>
    `;
};

/**
 * Approval Notification Email Template
 * @param {string} name - Coordinator's name
 * @returns {string} - HTML email content
 */
const approvalEmailTemplate = (name) => {
  return `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>Congratulations, ${name}!</h2>
        <p>We are pleased to inform you that your coordinator account has been approved by our administration team.</p>
        <p>You can now log in to your dashboard and start managing your activities.</p>
        <p>If you encounter any issues or have questions, please reach out to us at <a href="tel:+9594402916">+9594402916</a>.</p>
        <br/>
        <p>Welcome aboard!</p>
        <p>Best Regards,</p>
        <p>The Global Innovator Olympiad Team</p>
      </div>
    `;
};

module.exports = {
  registrationEmailTemplate,
  approvalEmailTemplate,
};
