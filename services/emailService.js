import nodemailer from 'nodemailer';
import { logger } from '../utils/logger.js';

const getTransporter = () => {
  const host = process.env.EMAIL_HOST;
  const port = process.env.EMAIL_PORT ? Number(process.env.EMAIL_PORT) : undefined;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!host || !port || !user || !pass) {
    throw new Error('Email service is not configured. Set EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS.');
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
  (process.env.EMAIL_USER ? `Hostel Management <${process.env.EMAIL_USER}>` : undefined);

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
