import type { gmail_v1 } from "googleapis/build/src/apis/gmail/v1";

export default async function sendMessage(
  gmailClient: gmail_v1.Gmail,
  to: string | string[],
  subject: string,
  text?: string,
  html?: string,
  cc?: string | string[],
  bcc?: string | string[],
) {
  console.log(to, subject, text, html, cc, bcc);
  const emailContent = [
    `To: ${formatRecipients(to)}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "",
    html ?? text, // Prefer HTML if provided, otherwise use text
  ].join("\n");

  // Base64url encode the email content

  console.log(emailContent);
  const encodedEmail = Buffer.from(emailContent).toString("base64");
  const res = await gmailClient.users.messages.send({
    userId: "me",
    requestBody: {
      raw: encodedEmail,
    },
  });
  return res;
}

// Add CC and BCC headers if provided
// if (cc) {
//   emailLines.splice(2, 0, `Cc: ${formatRecipients(cc)}`); // Insert after Subject
// }
// if (bcc) {
//    // BCC is a bit different. You include it in the raw message headers
//    // but it's typically stripped by the receiving mail server so recipients don't see it.
//    // Including it here is the standard way for the sending client to handle it.
//    emailLines.splice(cc ? 3 : 2, 0, `Bcc: ${formatRecipients(bcc)}`); // Insert after Subject or Cc
// }

const formatRecipients = (recipients?: string | string[]) => {
  if (!recipients) return "";
  if (Array.isArray(recipients)) {
    return recipients.join(", ");
  }
  return recipients;
};
