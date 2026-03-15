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
    secure: port === 465,   // true = SSL (465), false = STARTTLS (587)
    auth: { user, pass },
  });
};

const buildHtmlEmail = (otp, expiryMinutes) => `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#1a56db;padding:28px 40px;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">Exam Portal</h1>
            <p style="margin:4px 0 0;color:#bfdbfe;font-size:13px;">Candidate Verification</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px 24px;">
            <p style="margin:0 0 8px;color:#374151;font-size:15px;">Hello,</p>
            <p style="margin:0 0 28px;color:#374151;font-size:15px;line-height:1.6;">
              Use the one-time code below to verify your email address and proceed with your exam registration.
            </p>
            <div style="background:#f0f4ff;border:2px dashed #1a56db;border-radius:8px;padding:20px;text-align:center;margin-bottom:28px;">
              <p style="margin:0 0 6px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Your OTP</p>
              <p style="margin:0;color:#1a56db;font-size:38px;font-weight:800;letter-spacing:10px;font-family:monospace;">${otp}</p>
            </div>
            <p style="margin:0 0 8px;color:#6b7280;font-size:13px;">
              &#x23F1; This code expires in <strong>${expiryMinutes} minutes</strong>.
            </p>
            <p style="margin:0;color:#6b7280;font-size:13px;">
              If you did not request this code, please ignore this email.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:16px 40px;border-top:1px solid #e5e7eb;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">
              This is an automated message. Please do not reply to this email.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
`;

const sendOtpEmail = async ({ to, otp, expiryMinutes }) => {
  const transporter = buildTransporter();

  if (!transporter) {
    // No SMTP configured — dev fallback: print to server console only
    console.log(`[DEV] OTP for ${to}: ${otp}`);
    return false;
  }

  const from = `"Exam Portal" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`;

  await transporter.sendMail({
    from,
    to,
    subject: "Your Exam Verification Code",
    text: `Your OTP is ${otp}. It expires in ${expiryMinutes} minutes. Do not share this code.`,
    html: buildHtmlEmail(otp, expiryMinutes),
  });

  return true;
};

module.exports = {
  sendOtpEmail,
};
