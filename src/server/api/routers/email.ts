import { gmail_v1, google } from "googleapis";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { simpleParser, type ParsedMail, type AddressObject } from "mailparser";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  type PutObjectCommandInput,
} from "@aws-sdk/client-s3";

import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { type DBAddress, type DBMessage, type DBThread } from "~/server/types";
import { assert } from "console";
import { db } from "~/server/db";

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

async function getThread(gmailClient: gmail_v1.Gmail, threadId: string) {
  try {
    const res = await gmailClient.users.threads.get({
      userId: "me",
      id: threadId,
    });
    return res.data;
  } catch (err) {
    console.log("Ohhhh nooo!");
    console.log(err);
  }
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
  } catch (error) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to get HTML from bucket - key:${key}`,
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
      expiresIn: 60 * 60 * 24,
    });
    return signedUrl;
  } catch (error) {
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
  if (messages.length === 0) {
    return;
  }
  // Ensure that the threads are in the db
  const threadIds = [
    ...new Set(
      messages
        .map((message) => message.threadId)
        .filter((id) => id !== undefined && id !== null)
        .map((id) => id!),
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

  const parsedMessages = await Promise.all(
    messages.map(async (message) => {
      // Check the db cache if exists we should do the minimal update
      if (!message.id || !message.threadId || !message) {
        console.log(
          " ================= Missing id or thread id ===============",
        );
        return false;
      }
      const dbMessage = await db.message.findFirst({
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

      function parseAddress(address: AddressObject): DBAddress[] {
        return address.value.map((val) => {
          return {
            name: val.name,
            email: val.address,
          };
        });
      }

      function parseAddressMany(
        addresses: AddressObject[] | AddressObject,
      ): DBAddress[] {
        if (!Array.isArray(addresses)) {
          addresses = [addresses];
        }
        const rtn: DBAddress[] = [];
        addresses.forEach((address) => {
          rtn.push(...parseAddress(address));
        });
        return rtn;
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
  const insert = parsedMessages.filter((x) => x) as DBMessage[];

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

async function deleteMessages(
  db: PrismaClient,
  messages: gmail_v1.Schema$Message[],
) {
  if (messages.length === 0) {
    return;
  }

  const operations = messages.map((message) => {
    return db.message.delete({
      where: {
        id: message.id ?? "",
      },
    });
  });
  return await db.$transaction(operations);
}

async function updateThread(
  db: PrismaClient,
  gmail: gmail_v1.Gmail,
  userId: string,
  threadId: string,
) {
  const threadsResp = await gmail.users.threads.get({
    userId: "me",
    format: "minimal",
    id: threadId,
  });
  if (!threadsResp) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }

  const thread2 = threadsResp.data;
  if (!thread2.id) {
    return false;
  }

  let dbThread = await db.thread.upsert({
    where: {
      id: thread2.id,
    },
    create: {
      id: thread2.id,
      userId: userId,
    },
    update: {
      userId: userId,
    },
  });

  const parsedMessages = await Promise.all(
    thread2.messages!.map(async ({ id }) => {
      if (!id) {
        return false;
      }

      const message = await getMessage(gmail, id, "raw");

      const data = message.data;
      if (!data.id || !data.raw) {
        return false;
      }

      const rawContent = Buffer.from(data.raw, "base64").toString("utf-8");
      const parsed: ParsedMail = await simpleParser(rawContent);
      if (!parsed.html) {
        return false;
      }

      await putS3Bucket(`message-${id}`, parsed.html);
      const link = await getSignedUrlS3(`message-${id}`);

      if (!parsed.subject || !parsed.from || !parsed.date || !parsed.to) {
        return false;
      }

      function parseAddress(address: AddressObject): DBAddress[] {
        return address.value.map((val) => {
          return {
            name: val.name,
            email: val.address,
          };
        });
      }

      function parseAddressMany(
        addresses: AddressObject[] | AddressObject,
      ): DBAddress[] {
        if (!Array.isArray(addresses)) {
          addresses = [addresses];
        }
        const rtn: DBAddress[] = [];
        addresses.forEach((address) => {
          rtn.push(...parseAddress(address));
        });
        return rtn;
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
        threadId: dbThread.id,
        text: parsed.text ? parsed.text.toString() : "",
        snippet: (message.data.snippet ?? "").toString(),
      };

      return toInsert;
    }),
  );

  // Remove failed parses
  const messages = parsedMessages.filter((x) => x) as DBMessage[];

  const operations = messages.map((message) => {
    return db.message.upsert({
      where: {
        id: message.id,
      },
      create: { ...message },
      update: {
        s3Link: message.s3Link,
        headers: message.headers,
        subject: message.subject,
        date: message.date,
        to: message.to,
        from: message.from,
        cc: message.cc,
        bcc: message.bcc,
        replyTo: message.replyTo,
        inReplyTo: message.inReplyTo,
        snippet: message.snippet,
        text: message.text,
      },
    });
  });
  await db.$transaction(operations);

  return true;
}
export const emailRouter = createTRPCRouter({
  // Example query
  getEmails: protectedProcedure.query(async ({ ctx }) => {
    const gmail = getGmailClient(ctx.session.accessToken);
    const res = await gmail.users.messages.list({
      userId: "me",
      maxResults: 100,
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
    return res.data.messages;
  }),

  putS3Bucket: protectedProcedure
    .input(
      z.object({
        key: z.string(),
        body: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const res = putS3Bucket(input.key, input.body);
      return res;
    }),

  getS3Bucket: protectedProcedure
    .input(
      z.object({
        key: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const res = await getFromS3Bucket(input.key);
      if (!res.Body) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to get HTML from bucket - key:${input.key}`,
        });
      }
      return res.Body;
    }),

  getThreadsPaginatedGmail: protectedProcedure
    .input(
      z.object({
        maxResults: z.number(),
        cursor: z.string().nullish(),
        q: z.string().nullish(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const gmail = getGmailClient(ctx.session.accessToken);
      const res = await gmail.users.threads.list({
        userId: "me",
        maxResults: input.maxResults,
        pageToken: (input.cursor ??= undefined),
        q: (input.q ??= undefined),
      });
      return { data: res.data, cursor: res.data.nextPageToken };
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
      if (!input.cursor) {
        const res = await ctx.db.thread.findMany({
          take: input.maxResults,
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
        return { data: res, cursor: last.id };
      }

      const res = await ctx.db.thread.findMany({
        take: input.maxResults,
        skip: 1,
        cursor: {
          id: input.cursor,
        },
        where: {
          userId: ctx.session.user.id,
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

      assert(last !== undefined);

      return { data: res, cursor: last.id };
    }),

  getThread: protectedProcedure
    .input(
      z.object({
        threadId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const gmail = getGmailClient(ctx.session.accessToken);
      const res = gmail.users.threads.get({
        userId: "me",
        format: "metadata",
        id: input.threadId,
      });
      return res;
    }),

  pullUpdates: protectedProcedure.mutation(async ({ ctx }) => {
    const gmail = getGmailClient(ctx.session.accessToken);

    let nextPageToken: string | undefined = undefined;

    const res = await gmail.users.threads.list({
      userId: "me",
      maxResults: 300, // Max allowed by gmail api
    });
    if (!res.data) {
      assert("This should not happen");
    }

    const threads = res.data.threads;
    if (!threads || threads.length === 0) {
      console.log("No threads found.");
      return;
    }

    const threadResp = await Promise.all(
      threads.map(async ({ id }) => {
        if (!id) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Gmail thread list returned a thread with a missing id",
          });
        }

        return getThread(gmail, id);
      }),
    );
    if (!threadResp || threadResp.length === 0) {
      console.log("No threads found.");
      return;
    }

    const finished = await Promise.all(
      threadResp.map((thread) => {
        if (!thread || !thread.id) {
          console.log("error", thread);
          return false;
        }
        updateThread(ctx.db, gmail, ctx.session.user.id, thread.id);
      }),
    );
    return finished;
  }),

  // Doesn't guarantee sync after a single call, processes 500 messages at a time updates lastHistoryId in the database
  // May have an issue when more than 500 updates happen between jobs.
  syncedFromHistory: protectedProcedure.mutation(async ({ ctx }) => {
    const gmail = getGmailClient(ctx.session.accessToken);

    const user = await ctx.db.user.findFirst({
      where: {
        id: ctx.session.user.id,
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
        maxResults: 500,
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
      await addMessages(ctx.db, gmail, ctx.session.user.id, messagesToAdd);
      await deleteMessages(ctx.db, messagesToRemove);

      // Update to the last historyId
      // TODO: Handle when more than 500 updates occur
      await ctx.db.user.update({
        where: {
          id: ctx.session.user.id,
        },
        data: {
          lastHistoryId: res.data.historyId,
        },
      });
    } catch (err) {
      console.log("Handling Error");
      // Invalid start historyId restart full sync
      const resp = await ctx.db.user.update({
        where: {
          id: ctx.session.user.id,
        },
        data: {
          lastHistoryId: null,
          isSynced: false,
          nextPageToken: null,
        },
      });
      console.log("No history found.");
      return;
    }
  }),

  // Used for full sync, each iteration should sync X messages
  backFillUpdates: protectedProcedure.mutation(async ({ ctx }) => {
    const gmail = getGmailClient(ctx.session.accessToken);

    const user = await ctx.db.user.findFirst({
      where: {
        id: ctx.session.user.id,
      },
    });

    if (!user) {
      return;
    }

    const nextPageToken = user.nextPageToken ?? undefined;
    console.log("===============" + user.nextPageToken);

    const res = await gmail.users.messages.list({
      userId: "me",
      maxResults: 10,
      pageToken: nextPageToken,
    });
    if (!res.data || !res.data.messages) {
      assert("This should not happen");
    }

    const messages = res.data.messages;
    if (!messages || messages.length === 0) {
      console.log("No messages found.");
      return;
    }

    console.log("==========", user.lastHistoryId);
    if (user.lastHistoryId === undefined || user.lastHistoryId === null) {
      const firstMessage = await getMessage(gmail, messages[0]?.id!, "minimal");
      const history = firstMessage.data.historyId;
      console.log("==== set history =====", history);
      await ctx.db.user.update({
        where: {
          id: ctx.session.user.id,
        },
        data: {
          lastHistoryId: history,
        },
      });
    }

    const wait = await ctx.db.user.update({
      where: {
        id: ctx.session.user.id,
      },
      data: {
        nextPageToken: res.data.nextPageToken,
        isSynced:
          res.data.nextPageToken !== undefined &&
          res.data.nextPageToken !== null,
      },
    });

    await addMessages(ctx.db, gmail, ctx.session.user.id, messages);

    return true;
  }),
});
