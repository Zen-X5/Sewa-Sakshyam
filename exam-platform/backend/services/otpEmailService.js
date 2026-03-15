const nodemailer = require("nodemailer");

const buildTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 0);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !port || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
};

const sendOtpEmail = async ({ to, otp, expiryMinutes }) => {
  const transporter = buildTransporter();

  if (!transporter) {
    console.log(`OTP for ${to}: ${otp}`);
    return false;
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  await transporter.sendMail({
    from,
    to,
    subject: "Exam Platform OTP Verification",
    text: `Your OTP for Exam Platform registration is ${otp}. It expires in ${expiryMinutes} minutes.`,
  });

  return true;
};

module.exports = {
  sendOtpEmail,
};
