import nodemailer from 'nodemailer';
import { logger } from '../utils/logger.js';

const getTransporter = () => {
  // Support both naming conventions (SMTP_* and EMAIL_*)
  const host = process.env.SMTP_HOST || process.env.EMAIL_HOST;
  const port = Number(process.env.SMTP_PORT || process.env.EMAIL_PORT) || 587;
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;

  if (!host || !user || !pass) {
    throw new Error(
      'Email service is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in your .env file.'
    );
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
};

const defaultFrom =
  process.env.EMAIL_FROM ||
  process.env.SMTP_USER ||
  process.env.EMAIL_USER
    ? `Hostel Management <${process.env.EMAIL_FROM || process.env.SMTP_USER || process.env.EMAIL_USER}>`
    : undefined;

const sendEmail = async ({ to, subject, html, text, from } = {}) => {
  if (!to) throw new Error('sendEmail: `to` is required');
  if (!subject) throw new Error('sendEmail: `subject` is required');
  if (!html && !text) throw new Error('sendEmail: `html` or `text` is required');

  const transporter = getTransporter();

  const info = await transporter.sendMail({
    from: from || defaultFrom,
    to,
    subject,
    html,
    text,
  });

  logger.info(`Email sent: ${info.messageId}`);
  return info;
};

export { sendEmail };
