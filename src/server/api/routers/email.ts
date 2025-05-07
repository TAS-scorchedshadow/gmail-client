/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { type gmail_v1, google } from "googleapis";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { simpleParser, type ParsedMail } from "mailparser";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  type PutObjectCommandInput,
} from "@aws-sdk/client-s3";

import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { type DBMessage, type DBThread } from "~/server/types";
import { assert } from "console";
import { isPresignedUrlExpired } from "../utils/s3refresh";
import { parseAddress, parseAddressMany } from "../utils/address";

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
async function getMessage(
  gmailClient: gmail_v1.Gmail,
  messageId: string,
  format = "full",
) {
  const res = await gmailClient.users.messages.get({
    userId: "me",
    format: format,
    id: messageId,
  });
  return res;
}

const s3 = new S3Client();

async function putS3Bucket(key: string, body: PutObjectCommandInput["Body"]) {
  try {
    const res = await s3.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: key,
        Body: body,
      }),
    );
    return res;
  } catch (error) {
    console.log(error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to put HTML to bucket - key:${key}`,
    });
  }
}

async function getFromS3Bucket(key: string) {
  try {
    const res = await s3.send(
      new GetObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: key,
      }),
    );
    return res;
  } catch {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to get HTML from bucket - key:${key}}`,
    });
  }
}
async function getSignedUrlS3(key: string) {
  try {
    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
    });
    const signedUrl = await getSignedUrl(s3, command, {
      expiresIn: 60 * 60 * 24 * 7,
    });
    return signedUrl;
  } catch {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to get HTML from bucket - key:${key}`,
    });
  }
}

async function addMessages(
  db: PrismaClient,
  gmail: gmail_v1.Gmail,
  userId: string,
  messages: gmail_v1.Schema$Message[],
) {
  // console.log("messages", messages);
  if (messages.length === 0) {
    return;
  }
  // Ensure that the threads are in the db
  const threadIds = [
    ...new Set(
      messages
        .map((message) => message.threadId)
        .filter((id) => id !== undefined && id !== null),
    ),
  ];

  const threads = threadIds.map((id) => {
    return db.thread.upsert({
      where: {
        id: id,
      },
      update: {},
      create: {
        id: id,
        userId: userId,
      },
    });
  });
  await db.$transaction(threads);

  const parsedMessages = await Promise.allSettled(
    messages.map(async (message) => {
      // Check the db cache if exists we should do the minimal update
      if (!message.id || !message.threadId || !message) {
        console.log(
          " ================= Missing id or thread id ===============",
        );
        return false;
      }
      //TODO: Implement the minimal update
      await db.message.findFirst({
        where: {
          id: message.id,
        },
      });

      // For now always do the full update
      const queriedMessage = await getMessage(gmail, message.id, "raw");

      const data = queriedMessage.data;
      if (!data.id || !data.raw) {
        return false;
      }

      const rawContent = Buffer.from(data.raw, "base64").toString("utf-8");
      const parsed: ParsedMail = await simpleParser(rawContent);
      if (!parsed.html) {
        return false;
      }

      await putS3Bucket(`message-${message.id}`, parsed.html);
      const link = await getSignedUrlS3(`message-${message.id}`);

      if (!parsed.subject || !parsed.from || !parsed.date || !parsed.to) {
        return false;
      }

      const toInsert: DBMessage = {
        id: data.id,
        s3Link: link,
        headers: [...parsed.headerLines],
        subject: parsed.subject.toString(),
        date: parsed.date,
        to: parseAddressMany(parsed.to),
        from: parseAddress(parsed.from),
        cc: parsed.cc ? parseAddressMany(parsed.cc) : [],
        bcc: parsed.bcc ? parseAddressMany(parsed.bcc) : [],
        replyTo: parsed.replyTo ? parseAddress(parsed.replyTo) : [],
        inReplyTo: parsed.inReplyTo?.toString(),
        threadId: message.threadId,
        text: parsed.text ? parsed.text.toString() : "",
        snippet: (queriedMessage.data.snippet ?? "").toString(),
      };
      return toInsert;
    }),
  );

  const middle = parsedMessages
    .filter((x) => x.status === "fulfilled")
    .map((x) => x.value);
  const insert = middle.filter((x) => x) as DBMessage[];

  const operations = insert.map((messageL) => {
    return db.message.upsert({
      where: {
        id: messageL.id,
      },
      create: { ...messageL },
      update: {
        s3Link: messageL.s3Link,
        headers: messageL.headers,
        subject: messageL.subject,
        date: messageL.date,
        to: messageL.to,
        from: messageL.from,
        cc: messageL.cc,
        bcc: messageL.bcc,
        replyTo: messageL.replyTo,
        inReplyTo: messageL.inReplyTo,
        snippet: messageL.snippet,
        text: messageL.text,
      },
    });
  });
  await db.$transaction(operations);

  return true;
}

// TODO: Uncomment when the concurrent delete is fixed
// async function deleteMessages(
//   db: PrismaClient,
//   messages: gmail_v1.Schema$Message[],
// ) {
//   if (messages.length === 0) {
//     return;
//   }

//   const operations = messages.map((message) => {
//     return db.message.delete({
//       where: {
//         id: message.id ?? "",
//       },
//     });
//   });
//   return await db.$transaction(operations);
// }

export const emailRouter = createTRPCRouter({
  // Example query

  putS3Bucket: protectedProcedure
    .input(
      z.object({
        key: z.string(),
        body: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const res = putS3Bucket(input.key, input.body);
      return res;
    }),

  getS3Bucket: protectedProcedure
    .input(
      z.object({
        key: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const res = await getFromS3Bucket(input.key);
      if (!res.Body) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to get HTML from bucket - key:${input.key}`,
        });
      }
      return res.Body;
    }),

  getThreadsPaginated: protectedProcedure
    .input(
      z.object({
        maxResults: z.number(),
        cursor: z.string().nullish(),
        q: z.string().nullish(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const res = await ctx.db.thread.findMany({
        take: input.maxResults,
        skip: input.cursor ? 1 : 0,
        cursor: input.cursor
          ? {
              id: input.cursor,
            }
          : undefined,
        where: {
          userId: ctx.session.user.id,
          messages: {
            some: {
              OR: [
                {
                  subject: {
                    contains: input.q ?? "",
                  },
                },
                {
                  text: {
                    contains: input.q ?? "",
                  },
                },
              ],
            },
          },
        },
        include: {
          messages: true,
        },
        orderBy: {
          id: "desc",
        },
      });
      if (res.length === 0) {
        return { data: [], cursor: undefined };
      }
      const last = res[res.length - 1]!;
      const threads = (
        await Promise.allSettled(
          // @ts-expect-error - JSON coersion not implemented
          res.map(async (thread) => await refreshThread(thread, ctx.db)),
        )
      )
        .filter((threadPromise) => threadPromise.status === "fulfilled")
        .map((x) => x.value);
      return { data: threads, cursor: last.id };
    }),

  // Doesn't guarantee sync after a single call, processes 500 messages at a time updates lastHistoryId in the database
  // May have an issue when more than 500 updates happen between jobs.
  syncedFromHistory: protectedProcedure.mutation(async ({ ctx }) => {
    return await syncedHistory(
      ctx.db,
      ctx.session.accessToken,
      ctx.session.user.id,
    );
  }),

  // Used for full sync, each iteration should sync X messages
  backFillUpdates: protectedProcedure.mutation(async ({ ctx }) => {
    return await backFillUpdates(
      ctx.db,
      ctx.session.accessToken,
      ctx.session.user.id,
    );
  }),

  backFillUpdatesAllUsers: publicProcedure.mutation(async ({ ctx }) => {
    const users = await ctx.db.user.findMany({
      include: {
        accounts: {
          where: {
            provider: "google",
          },
        },
      },
    });
    // console.warn(
    //   "Found users",
    //   users.map((u) => u.email),
    // );
    const updated = [];
    for (const user of users) {
      const googleAccount = user.accounts[0];

      if (!googleAccount) {
        // console.warn("Google account was not found", user.email);
        continue;
      }

      if (
        !googleAccount.expires_at ||
        googleAccount.expires_at * 1000 < Date.now()
      ) {
        // Token is invalid return
        // console.warn("Token has expired", user.email);
        continue;
      }
      await backFillUpdates(ctx.db, googleAccount.access_token, user.id);
      updated.push(user.email);
      // console.warn("Successfully awaited", user.email);
    }
    return updated;
  }),

  syncedHistoryAllUsers: publicProcedure.mutation(async ({ ctx }) => {
    const users = await ctx.db.user.findMany({
      include: {
        accounts: {
          where: {
            provider: "google",
          },
        },
      },
    });
    // console.warn(
    //   "Found users",
    //   users.map((u) => u.email),
    // );
    const updated = [];
    for (const user of users) {
      const googleAccount = user.accounts[0];

      if (!googleAccount) {
        // console.warn("Google account was not found", user.email);
        continue;
      }

      if (
        !googleAccount.expires_at ||
        googleAccount.expires_at * 1000 < Date.now()
      ) {
        // Token is invalid return
        // console.warn("Token has expired", user.email);
        continue;
      }

      await syncedHistory(ctx.db, googleAccount.access_token, user.id);
      updated.push(user.email);
      // console.warn("Successfully awaited", user.email);
    }
    return updated;
  }),
});

async function syncedHistory(
  db: PrismaClient,
  accessToken: string | null,
  userId: string,
) {
  const gmail = getGmailClient(accessToken);

  const user = await db.user.findFirst({
    where: {
      id: userId,
    },
  });

  if (!user) {
    return;
  }

  const lastHistory = user.lastHistoryId ?? undefined;

  console.log("============" + lastHistory);
  try {
    const res = await gmail.users.history.list({
      userId: "me",
      maxResults: 300,
      startHistoryId: lastHistory,
    });

    if (!res.data.history) {
      // No updates
      return;
    }
    const messagesToAdd: gmail_v1.Schema$Message[] = [];
    const messagesToRemove: gmail_v1.Schema$Message[] = [];
    res.data.history.forEach((history) => {
      if (history.messagesAdded) {
        history.messagesAdded.forEach((messageAdded) => {
          if (messageAdded.message) {
            messagesToAdd.push(messageAdded.message);
          }
        });
      }

      if (history.messagesDeleted) {
        history.messagesDeleted.forEach((messageDeleted) => {
          if (messageDeleted.message) {
            messagesToRemove.push(messageDeleted.message);
          }
        });
      }
    });
    await addMessages(db, gmail, userId, messagesToAdd);
    // await deleteMessages(db, messagesToRemove);

    // Update to the last historyId
    // TODO: Handle when more than 300 updates occur
    await db.user.update({
      where: {
        id: userId,
      },
      data: {
        lastHistoryId: res.data.historyId,
      },
    });
  } catch (err) {
    console.log("Handling Error ", err);
    // Invalid start historyId restart full sync
    const resp = await db.user.update({
      where: {
        id: userId,
      },
      data: {
        lastHistoryId: null,
        isSynced: false,
        nextPageToken: null,
      },
    });
    return resp;
  }
}

async function backFillUpdates(
  db: PrismaClient,
  accessToken: string | null,
  userId: string,
) {
  const gmail = getGmailClient(accessToken);

  const user = await db.user.findFirst({
    where: {
      id: userId,
    },
  });

  if (!user) {
    return;
  }

  const nextPageToken = user.nextPageToken ?? undefined;

  const res = await gmail.users.messages.list({
    userId: "me",
    maxResults: 300,
    pageToken: nextPageToken,
  });
  if (!res.data?.messages) {
    assert("This should not happen");
  }

  const messages = res.data.messages;
  if (!messages || messages.length === 0) {
    console.log("No messages found.");
    return;
  }
  const message = messages[0];

  console.log("==========", user.lastHistoryId);

  if (user.lastHistoryId === undefined || user.lastHistoryId === null) {
    //TODO: Inspect if not setting the history is the correct behaviour
    if (message?.id) {
      const firstMessage = await getMessage(gmail, message.id, "minimal");
      const history = firstMessage.data.historyId;
      console.log("==== set history =====", history);
      await db.user.update({
        where: {
          id: userId,
        },
        data: {
          lastHistoryId: history,
        },
      });
    }
  }

  await db.user.update({
    where: {
      id: userId,
    },
    data: {
      nextPageToken: res.data.nextPageToken,
      isSynced:
        res.data.nextPageToken !== undefined && res.data.nextPageToken !== null,
    },
  });
  console.log("========old=======" + user.nextPageToken);
  console.log("========new=======" + res.data.nextPageToken);

  await addMessages(db, gmail, userId, messages);

  return true;
}

async function refreshThread(thread: DBThread, db: PrismaClient) {
  const messages = await Promise.allSettled(
    thread.messages.map(async (m) => refreshS3Link(m, db)),
  );
  return {
    ...thread,
    messages: messages
      .filter((m) => m.status === "fulfilled")
      .map((m) => m.value),
  };
}

async function refreshS3Link(
  message: DBMessage,
  db: PrismaClient,
): Promise<DBMessage> {
  const isExpired = isPresignedUrlExpired(message.s3Link);
  if (!isExpired) {
    return message;
  }
  const newUrl = await getSignedUrlS3(`message-${message.id}`);
  await db.message.update({
    where: {
      id: message.id,
    },
    data: {
      s3Link: newUrl,
    },
  });
  const newMessage = { ...message, s3Link: newUrl };

  return newMessage;
}
