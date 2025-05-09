import type { gmail_v1 } from "googleapis/build/src/apis/gmail/v1";
import type { User } from "next-auth";
import MailComposer from "nodemailer/lib/mail-composer";

export default async function sendMessage(
  gmailClient: gmail_v1.Gmail,
  user: User,
  to: string | string[],
  subject: string,
  text?: string,
  html?: string,
  cc?: string | string[],
  bcc?: string | string[],
  inReplyTo?: string,
) {
  console.log(to, subject, text, html, cc, bcc);
  console.log(user.email);

  const mail = new MailComposer({
    from: user.email && user.name ? `${user.name} <${user.email}>` : "",
    to: to,
    subject: subject,
    text: text,
    html: html,
    inReplyTo: inReplyTo,
  });

  const message = await mail.compile().build();

  const base64EncodedEmail = Buffer.from(message).toString("base64");
  // .replace(/\+/g, "-")
  // .replace(/\//g, "_");

  const res = await gmailClient.users.messages.send({
    userId: "me",
    requestBody: {
      raw: base64EncodedEmail,
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
