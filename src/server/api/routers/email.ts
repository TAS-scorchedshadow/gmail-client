import { gmail_v1, google } from "googleapis";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { accessSync } from "fs";
import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@prisma/client";
import { gmail } from "googleapis/build/src/apis/gmail";

function getGmailClient(access_token: string | null) {
  if (!access_token) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  const auth = new google.auth.OAuth2(
    process.env.AUTH_GOOGLE_ID,
    process.env.AUTH_GOOGLE_SECRET,
  );
  auth.setCredentials({ access_token: access_token });
  return google.gmail({ version: "v1", auth });
}

type DB = PrismaClient;

async function getThread(gmailClient: gmail_v1.Gmail, threadId: string) {
  const res = await gmailClient.users.threads.get({
    userId: "me",
    id: threadId,
  });
  return res.data;
}

async function getMessage(gmailClient: gmail_v1.Gmail, messageId: string) {
  const res = await gmailClient.users.messages.get({
    userId: "me",
    id: messageId,
  });
  return res.data;
}

export const emailRouter = createTRPCRouter({
  // Example query
  getEmails: protectedProcedure.query(async ({ ctx }) => {
    const gmail = getGmailClient(ctx.session.accessToken);
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
  getAllThreads: protectedProcedure.query(async ({ ctx }) => {
    const gmail = getGmailClient(ctx.session.accessToken);
    const res = await gmail.users.threads.list({
      userId: "me",
      maxResults: 10,
    });

    if (!res.data.threads || res.data.threads.length === 0) {
      console.log("No threads found.");
      return;
    }

    const threadResp = await Promise.all(
      res.data.threads.map(async ({ id }) => getThread(gmail, id!)),
    );
    if (!threadResp || threadResp.length === 0) {
      console.log("No threads found.");
      return;
    }

    const threads = [];
    for (const thread of threadResp) {
      const messages = await Promise.all(
        thread.messages!.map(async ({ id }) => getMessage(gmail, id!)),
      );
      console.log(thread);
      threads.push({ ...thread, rawMessages: messages });
    }
    console.log(threads);

    return threads;
  }),
});
