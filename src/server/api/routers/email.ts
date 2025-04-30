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
    const gmail = google.gmail({ version: "v1", auth });
    const response = await gmail.users.messages.list({
      userId: "me",
      maxResults: 10,
    });
    console.log("============");
    console.log(response.data.messages);
    return response.data.messages;
  }),
});
