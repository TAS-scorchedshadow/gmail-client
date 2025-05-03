import { gmail_v1, google } from "googleapis";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import type { PrismaClient, Thread } from "@prisma/client";
import { date, z } from "zod";
import { simpleParser, type ParsedMail, type AddressObject } from "mailparser";
import {
  S3Client,
  PutObjectCommand,
  CreateBucketCommand,
  DeleteObjectCommand,
  DeleteBucketCommand,
  paginateListObjectsV2,
  GetObjectCommand,
  type PutObjectCommandInput,
} from "@aws-sdk/client-s3";

import {
  getSignedUrl,
  S3RequestPresigner,
} from "@aws-sdk/s3-request-presigner";
import type { JSONObject } from "node_modules/superjson/dist/types";
import type { InputJsonObject } from "@prisma/client/runtime/library";
import { type DBAddress, type DBMessage, type DBThread } from "~/server/types";
import { parse } from "path";
import { threadId } from "worker_threads";

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
    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
      Body: body,
    });
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
async function getSingedUrlS3Bucket(key: string) {
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
    console.log("FAILLLLED");
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to get HTML from bucket - key:${key}`,
    });
  }
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

  console.log(thread2);
  let dbThread = await db.thread.upsert({
    where: {
      id: thread2.id!,
    },
    create: {
      id: thread2.id!,
      snippet: thread2.snippet ?? "",
      userId: userId,
    },
    update: {
      snippet: thread2.snippet ?? "",
      userId: userId,
    },
  });

  const parsedMessages = await Promise.all(
    thread2.messages!.map(async ({ id }) => {
      if (!id) {
        return false;
      }

      const resp = await getMessage(gmail, id, "raw");
      const data = resp.data;
      const rawContent = Buffer.from(data.raw!, "base64").toString("utf-8");
      const parsed: ParsedMail = await simpleParser(rawContent);
      if (!parsed.html) {
        return false;
      }

      await putS3Bucket(`message-${id}`, parsed.html);
      const link = await getSingedUrlS3Bucket(`message-${id}`);

      if (!parsed.subject || !parsed.from || !parsed.date || !parsed.to) {
        return false;
      }

      function parseAddress(address: AddressObject): DBAddress[] {
        return address.value.map((x) => {
          return {
            name: x.name,
            email: x.address,
          };
        });
      }
      function parseAddressMany(addresses: AddressObject[]): DBAddress[] {
        const rtn: DBAddress[] = [];
        addresses.forEach((address) => {
          rtn.push(...parseAddress(address));
        });
        return rtn;
      }

      const toInsert: DBMessage = {
        id: resp.data.id!,
        s3Link: link,
        headers: [...parsed.headerLines],
        subject: parsed.subject,
        date: parsed.date,
        to: Array.isArray(parsed.to)
          ? parseAddressMany(parsed.to)
          : parseAddress(parsed.to),
        from: parseAddress(parsed.from),
        cc: parsed.cc
          ? Array.isArray(parsed.cc)
            ? parseAddressMany(parsed.cc)
            : parseAddress(parsed.cc)
          : [],
        bcc: parsed.cc
          ? Array.isArray(parsed.cc)
            ? parseAddressMany(parsed.cc)
            : parseAddress(parsed.cc)
          : [],
        replyTo: parsed.replyTo ? parseAddress(parsed.replyTo) : [],
        inReplyTo: parsed.inReplyTo,
        threadId: dbThread.id,
        snippet: (resp.data.snippet ?? "").toString(),
      };

      return toInsert;
    }),
  );

  // Remove failed parses
  const messages = parsedMessages.filter((x) => x) as DBMessage[];

  const x = await Promise.all(
    messages.map(async (message) => {
      await db.message.upsert({
        where: {
          id: message.id,
        },
        create: message,
        update: message,
      });
    }),
  );

  return true;
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
      const gmail = getGmailClient(ctx.session.accessToken);

      if (!input.cursor) {
        const res = await ctx.db.thread.findMany({
          take: 100,
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
        const last = res[res.length - 1]!;
        return { data: res, cursor: last.id };
      }

      const res = await ctx.db.thread.findMany({
        take: 100,
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
      const last = res[res.length - 1]!;

      const out = res.map((thread) => {
        const messages = thread.messages as DBMessage[];
        return { ...thread, messages };
      });

      return { data: out, cursor: last.id };
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
    const res = await gmail.users.threads.list({
      userId: "me",
      maxResults: 100,
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

    const finished = await Promise.all(
      threadResp.map((thread) => {
        if (!thread) {
          return false;
        }
        updateThread(ctx.db, gmail, ctx.session.user.id, thread.id!);
      }),
    );
    return finished;
  }),

  // updateThread: protectedProcedure
  //   .input(
  //     z.object({
  //       threadId: z.string(),
  //     }),
  //   )
  //   .mutation(async ({ ctx, input }) => {
  //     const gmail = getGmailClient(ctx.session.accessToken);
  //     const threadsResp = await gmail.users.threads.get({
  //       userId: "me",
  //       format: "minimal",
  //       id: input.threadId,
  //     });
  //     if (!threadsResp) {
  //       throw new TRPCError({ code: "NOT_FOUND" });
  //     }

  //     const thread2 = threadsResp.data;

  //     const messages = await Promise.all(
  //       thread2.messages!.map(async ({ id }) => {
  //         const data = await getMessage(gmail, id!, "raw");
  //         const rawContent = Buffer.from(data.data.raw!, "base64").toString(
  //           "utf-8",
  //         );
  //         let parsed = await simpleParser(rawContent);
  //         await putS3Bucket(`message-${id}`, parsed.html);
  //         const link = await getSingedUrlS3Bucket(`message-${id}`);
  //         return { ...data, link };
  //       }),
  //     );

  //     let dbThread = await ctx.db.thread.findFirst({
  //       where: {
  //         id: thread2.id!,
  //       },
  //     });
  //     if (!dbThread) {
  //       dbThread = await ctx.db.thread.create({
  //         data: {
  //           id: thread2.id!,
  //           userId: ctx.session.user.id,
  //         },
  //       });
  //     }
  //     const x = await Promise.all(
  //       messages.map(async (message) => {
  //         console.log(message);
  //         const metaDataPayload = message.payload as InputJsonObject;
  //         const toInsert = { ...message, payload: metaDataPayload, raw: {} };
  //         await ctx.db.message.upsert({
  //           where: {
  //             id: message.id!,
  //           },
  //           create: {
  //             id: message.id!,
  //             threadId: thread2.id!,
  //             metaData: toInsert,
  //             s3Link: message.link,
  //           },
  //           update: {
  //             metaData: toInsert,
  //             s3Link: message.link,
  //           },
  //         });
  //       }),
  //     );

  //     return { ...thread2, rawMessages: messages };
  //   }),

  getThreadWithMessages: protectedProcedure
    .input(
      z.object({
        threadId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const res = await ctx.db.thread.findFirst({
        where: {
          id: input.threadId,
        },
        include: {
          messages: true,
        },
      });
      if (!res) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return { ...res, messages: res.messages.map((x) => x as DBMessage) };
    }),

  getMessage: protectedProcedure
    .input(
      z.object({
        messageId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const gmail = getGmailClient(ctx.session.accessToken);
      const res = gmail.users.messages.get({
        userId: "me",
        id: input.messageId,
      });
      return res;
    }),
});
