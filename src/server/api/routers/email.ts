import { google } from "googleapis";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const emailRouter = createTRPCRouter({
  getEmails: protectedProcedure.query(async ({ ctx }) => {
    const auth = new google.auth.OAuth2(
      process.env.AUTH_GOOGLE_ID,
      process.env.AUTH_GOOGLE_SECRET,
    );

    auth.setCredentials({
      access_token: ctx.session.accessToken,
    });
    console.log(auth.credentials);
    const gmail = google.gmail({ version: "v1", auth });
    const res = await gmail.users.messages.list({
      userId: "me",
      maxResults: 10,
    });

    const messages = res.data.messages;

    if (!messages || messages.length === 0) {
      console.log("No messages found.");
      return;
    }

    console.log("Messages:");
    for (const message of messages) {
      // You'll need to fetch individual message details to get headers, body, etc.
      const messageDetails = await gmail.users.messages.get({
        userId: "me",
        id: message.id!,
      });
      console.log(`- ${messageDetails.data.snippet}`); // Example: log the message snippet
    }
    console.log("============");
    console.log(res.data.messages);
    return res.data.messages;
  }),
});
