const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const nodemailer = require("nodemailer");
const { defineSecret } = require("firebase-functions/params");

initializeApp();
const db = getFirestore();

// Secrets for email credentials (set via firebase functions:secrets:set)
const gmailEmail = defineSecret("GMAIL_EMAIL");
const gmailAppPassword = defineSecret("GMAIL_APP_PASSWORD");

function createTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: gmailEmail.value(),
      pass: gmailAppPassword.value(),
    },
  });
}

// --- Email template helper ---
function emailTemplate(title, bodyContent) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#fffbf5;font-family:Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:32px 16px;">
    <!-- Header -->
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;width:48px;height:48px;background:linear-gradient(135deg,#fb7185,#fb923c);border-radius:14px;line-height:48px;text-align:center;transform:rotate(3deg);">
        <span style="color:white;font-size:24px;">&#10084;</span>
      </div>
      <h1 style="font-family:Georgia,serif;font-size:24px;color:#1e293b;margin:12px 0 0;">IGY</h1>
    </div>

    <!-- Card -->
    <div style="background:white;border-radius:20px;padding:32px 24px;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
      <h2 style="font-family:Georgia,serif;font-size:20px;color:#1e293b;margin:0 0 16px;">${title}</h2>
      ${bodyContent}
    </div>

    <!-- Footer -->
    <div style="text-align:center;margin-top:24px;color:#94a3b8;font-size:12px;">
      <p style="margin:0 0 4px;">&copy; 2026 IGY (I Got You)</p>
      <p style="margin:0;">
        <a href="https://igy-app.web.app" style="color:#fb7185;text-decoration:none;">Visit IGY</a>
        &nbsp;&middot;&nbsp;
        <a href="https://igy-app.web.app/community-guidelines.html" style="color:#fb7185;text-decoration:none;">Community Guidelines</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

// --- Helper to get a user's email from their nickname ---
async function getEmailByNickname(nickname) {
  const snapshot = await db.collection("profiles")
    .where("nickname", "==", nickname)
    .limit(1)
    .get();
  if (snapshot.empty) return null;
  return snapshot.docs[0].data().email || null;
}

// --- Helper to check notification settings ---
async function shouldNotify(nickname, settingKey) {
  const snapshot = await db.collection("profiles")
    .where("nickname", "==", nickname)
    .limit(1)
    .get();
  if (snapshot.empty) return true;
  const settings = snapshot.docs[0].data().notificationSettings || {};
  return settings[settingKey] !== false;
}

// ========================================
// 1. WELCOME EMAIL - on new profile creation
// ========================================
exports.sendWelcomeEmail = onDocumentCreated(
  { document: "profiles/{userId}", secrets: [gmailEmail, gmailAppPassword] },
  async (event) => {
    const profile = event.data.data();
    const email = profile.email;
    if (!email) return;

    const transporter = createTransporter();
    const html = emailTemplate(
      `Welcome to IGY, ${profile.nickname || "friend"}!`,
      `
      <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px;">
        Thank you for joining the IGY community! We're so glad you're here.
      </p>
      <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px;">
        IGY connects neighbors who want to help each other. Here are a few things to know:
      </p>
      <ul style="color:#475569;font-size:14px;line-height:1.8;padding-left:20px;margin:0 0 16px;">
        <li><strong>Ask for help</strong> when you need it &mdash; that's what we're here for</li>
        <li><strong>Give back</strong> when you can &mdash; a recipe, a joke, or lending a hand</li>
        <li><strong>Be respectful</strong> and treat everyone with kindness</li>
        <li><strong>Stay safe</strong> &mdash; let someone know when you're meeting a helper</li>
      </ul>
      <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 20px;">
        Ready to get started? Visit IGY and browse your community feed!
      </p>
      <div style="text-align:center;">
        <a href="https://igy-app.web.app" style="display:inline-block;background:linear-gradient(135deg,#fb7185,#fb923c);color:white;padding:12px 32px;border-radius:12px;font-weight:bold;text-decoration:none;font-size:15px;">Open IGY</a>
      </div>
      `
    );

    await transporter.sendMail({
      from: `"IGY" <${gmailEmail.value()}>`,
      to: email,
      subject: `Welcome to IGY, ${profile.nickname || "friend"}!`,
      html,
    });
  }
);

// ========================================
// 2. NOTIFICATION EMAIL - on new notification creation
// ========================================
exports.sendNotificationEmail = onDocumentCreated(
  { document: "notifications/{notifId}", secrets: [gmailEmail, gmailAppPassword] },
  async (event) => {
    const notif = event.data.data();
    const recipientNickname = notif.userId;
    if (!recipientNickname) return;

    // Check if user has opted out of this notification type
    if (notif.type === "comment") {
      const shouldSend = await shouldNotify(recipientNickname, "comments");
      if (!shouldSend) return;
    }
    if (notif.type === "neighborhoodRequest") {
      const shouldSend = await shouldNotify(recipientNickname, "neighborhoodRequests");
      if (!shouldSend) return;
    }

    const email = await getEmailByNickname(recipientNickname);
    if (!email) return;

    // Build email content based on notification type
    let subject, bodyContent;

    switch (notif.type) {
      case "accepted":
        subject = "Your request has been accepted!";
        bodyContent = `
          <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px;">
            Great news! ${notif.message}
          </p>
          <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 20px;">
            Head to IGY to see the details and coordinate with your helper.
          </p>
          <div style="text-align:center;">
            <a href="https://igy-app.web.app" style="display:inline-block;background:linear-gradient(135deg,#fb7185,#fb923c);color:white;padding:12px 32px;border-radius:12px;font-weight:bold;text-decoration:none;font-size:15px;">View Request</a>
          </div>`;
        break;

      case "completed":
        subject = "A request has been completed!";
        bodyContent = `
          <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px;">
            ${notif.message}
          </p>
          <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 20px;">
            Don't forget to leave a review for the other person!
          </p>
          <div style="text-align:center;">
            <a href="https://igy-app.web.app" style="display:inline-block;background:linear-gradient(135deg,#fb7185,#fb923c);color:white;padding:12px 32px;border-radius:12px;font-weight:bold;text-decoration:none;font-size:15px;">Leave a Review</a>
          </div>`;
        break;

      case "review":
        subject = "You received a new review!";
        bodyContent = `
          <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px;">
            ${notif.message}
          </p>
          <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 20px;">
            Check out your profile to see the full review.
          </p>
          <div style="text-align:center;">
            <a href="https://igy-app.web.app" style="display:inline-block;background:linear-gradient(135deg,#fb7185,#fb923c);color:white;padding:12px 32px;border-radius:12px;font-weight:bold;text-decoration:none;font-size:15px;">View Profile</a>
          </div>`;
        break;

      case "comment":
        subject = "Someone commented on your post!";
        bodyContent = `
          <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px;">
            ${notif.message}
          </p>
          <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 20px;">
            Head to the community feed to see the conversation.
          </p>
          <div style="text-align:center;">
            <a href="https://igy-app.web.app" style="display:inline-block;background:linear-gradient(135deg,#fb7185,#fb923c);color:white;padding:12px 32px;border-radius:12px;font-weight:bold;text-decoration:none;font-size:15px;">View Comments</a>
          </div>`;
        break;

      default:
        subject = "New notification from IGY";
        bodyContent = `
          <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px;">
            ${notif.message}
          </p>
          <div style="text-align:center;">
            <a href="https://igy-app.web.app" style="display:inline-block;background:linear-gradient(135deg,#fb7185,#fb923c);color:white;padding:12px 32px;border-radius:12px;font-weight:bold;text-decoration:none;font-size:15px;">Open IGY</a>
          </div>`;
    }

    const transporter = createTransporter();
    const html = emailTemplate(subject, bodyContent);

    await transporter.sendMail({
      from: `"IGY" <${gmailEmail.value()}>`,
      to: email,
      subject,
      html,
    });
  }
);
