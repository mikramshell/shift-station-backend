import twilio from "twilio";
import sgMail from "@sendgrid/mail";
import admin from "firebase-admin";
import { db } from "../db.js";

// --- Twilio (SMS) ---
const twilioClient =
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null;

// --- SendGrid (Email) ---
if (process.env.SENDGRID_API_KEY) sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// --- Firebase (Android + Web push) ---
if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON && !admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)),
  });
}

/**
 * Sends a message to an employee across SMS, email, and push,
 * and writes a Notification row logging the outcome of each channel.
 * Any channel that isn't configured (missing API key, no phone on file, etc.)
 * is marked "skipped" rather than failing the whole call.
 */
export async function notifyEmployee(employeeId, message) {
  const employee = await db.employee.findUnique({
    where: { id: employeeId },
    include: { pushTokens: true },
  });
  if (!employee) throw new Error("Employee not found");

  const result = { smsStatus: "skipped", emailStatus: "skipped", pushStatus: "skipped" };

  // SMS
  if (twilioClient && employee.phone) {
    try {
      await twilioClient.messages.create({
        body: message,
        from: process.env.TWILIO_FROM_NUMBER,
        to: employee.phone,
      });
      result.smsStatus = "sent";
    } catch (err) {
      console.error("SMS send failed:", err.message);
      result.smsStatus = "failed";
    }
  }

  // Email
  if (process.env.SENDGRID_API_KEY && employee.email) {
    try {
      await sgMail.send({
        to: employee.email,
        from: process.env.SENDGRID_FROM_EMAIL,
        subject: "Shift Station update",
        text: message,
      });
      result.emailStatus = "sent";
    } catch (err) {
      console.error("Email send failed:", err.message);
      result.emailStatus = "failed";
    }
  }

  // Push (in-app / native)
  if (admin.apps.length && employee.pushTokens.length) {
    try {
      await admin.messaging().sendEachForMulticast({
        tokens: employee.pushTokens.map((t) => t.token),
        notification: { title: "Shift Station", body: message },
      });
      result.pushStatus = "sent";
    } catch (err) {
      console.error("Push send failed:", err.message);
      result.pushStatus = "failed";
    }
  }

  return db.notification.create({
    data: {
      employeeId,
      message,
      channels: ["sms", "email", "push"],
      ...result,
    },
  });
}
