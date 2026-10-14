import { Resend } from "resend";
import nodemailer from "nodemailer";
import { logger } from "../middleware/logger.js";

let resendClient = null;
let smtpTransporter = null;

const isPlaceholder = (val) => {
    if (!val) return true;
    const lower = val.toLowerCase();
    return lower.includes("placeholder") || lower.includes("your-") || lower === "re_placeholder";
};

const extractOtp = (html, text) => {
    const fromHtml = html?.match(/>\s*([0-9]{6})\s*</);
    if (fromHtml) return fromHtml[1];
    const fromText = (text || html)?.match(/\b([0-9]{6})\b/);
    return fromText ? fromText[1] : null;
};

/**
 * Send email using Resend, Nodemailer (SMTP/Gmail), or console fallback in development
 * @param {Object} mailOptions - Email options (to, subject, html, from, etc.)
 * @param {Object} options - Additional options
 * @returns {Promise} - Result with messageId
 */
export const sendEmail = async (mailOptions, options = {}) => {
    const isDev = process.env.NODE_ENV !== "production";
    const rawApiKey = process.env.EMAIL_PASS?.trim() || "";
    const apiKey = rawApiKey.replace(/\s+/g, ""); // Remove spaces (e.g. from Google app passwords)
    const emailUser = process.env.EMAIL_USER?.trim() || "";

    // In development mode, if placeholder key is used, log OTP to console and succeed immediately
    if (isDev && isPlaceholder(apiKey)) {
        const otp = extractOtp(mailOptions.html, mailOptions.text);
        console.log("\n\x1b[33m======================= [DEV EMAIL / OTP] =======================\x1b[0m");
        console.log(`\x1b[36mTo:\x1b[0m      ${mailOptions.to}`);
        console.log(`\x1b[36mSubject:\x1b[0m ${mailOptions.subject}`);
        if (otp) {
            console.log(`\x1b[32m\x1b[1mOTP Code:\x1b[0m \x1b[32m\x1b[1m${otp}\x1b[0m (Enter this code in the signup form)`);
        }
        console.log("\x1b[33m=================================================================\x1b[0m\n");

        return {
            messageId: `dev-mock-${Date.now()}`,
            mock: true,
        };
    }

    try {
        // 1. Resend API (used when key starts with 're_')
        if (apiKey && apiKey.startsWith("re_")) {
            if (!resendClient) {
                resendClient = new Resend(apiKey);
            }

            const { data, error } = await resendClient.emails.send({
                from: mailOptions.from,
                to: mailOptions.to,
                subject: mailOptions.subject,
                html: mailOptions.html,
            });

            if (error) {
                throw new Error(`Resend API error: ${error.message || JSON.stringify(error)}`);
            }

            return {
                messageId: data?.id || data?.messageId,
                ...data,
            };
        }

        // 2. Nodemailer SMTP (used for Gmail, Outlook, custom SMTP)
        if (process.env.EMAIL_HOST && apiKey) {
            if (!smtpTransporter) {
                const isGmail = process.env.EMAIL_HOST.includes("gmail");
                const transportConfig = isGmail
                    ? {
                        service: "gmail",
                        auth: {
                            user: emailUser,
                            pass: apiKey,
                        },
                      }
                    : {
                        host: process.env.EMAIL_HOST,
                        port: parseInt(process.env.EMAIL_PORT || "587", 10),
                        secure: process.env.EMAIL_SECURE === "true",
                        auth: {
                            user: emailUser,
                            pass: apiKey,
                        },
                      };

                smtpTransporter = nodemailer.createTransport(transportConfig);
            }

            const info = await smtpTransporter.sendMail({
                from: mailOptions.from || `"Hostelia" <${emailUser}>`,
                to: mailOptions.to,
                subject: mailOptions.subject,
                html: mailOptions.html,
                text: mailOptions.text,
            });

            logger.info(`Email sent successfully via SMTP to ${mailOptions.to}`);

            return {
                messageId: info.messageId,
                ...info,
            };
        }

        throw new Error("No valid email configuration found (neither valid Resend key nor SMTP configured)");
    } catch (err) {
        // In development mode, if email fails, print OTP to console so testing is never blocked
        if (isDev) {
            const otp = extractOtp(mailOptions.html, mailOptions.text);
            logger.warn(`Email delivery failed (${err.message}). Falling back to terminal display for development.`);
            console.log("\n\x1b[33m======================= [DEV EMAIL / OTP] =======================\x1b[0m");
            console.log(`\x1b[36mTo:\x1b[0m      ${mailOptions.to}`);
            console.log(`\x1b[36mSubject:\x1b[0m ${mailOptions.subject}`);
            if (otp) {
                console.log(`\x1b[32m\x1b[1mOTP Code:\x1b[0m \x1b[32m\x1b[1m${otp}\x1b[0m (Enter this code in the signup form)`);
            }
            console.log("\x1b[33m=================================================================\x1b[0m\n");

            return {
                messageId: `dev-mock-${Date.now()}`,
                mock: true,
                warning: err.message,
            };
        }

        throw err;
    }
};

/**
 * Get the email user from environment variables
 */
export const getEmailUser = () => {
    return process.env.EMAIL_USER?.trim() || "onboarding@resend.dev";
};
