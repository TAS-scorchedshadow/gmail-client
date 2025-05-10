import { google } from "googleapis";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { getFromS3Bucket, putS3Bucket } from "../service/s3service";
import { refreshThread } from "../service/refresh";
import { backFillUpdates } from "../service/backfill";
import { syncedHistory } from "../service/sync";
import sendMessage from "../service/sendMail";
import { emailZodType } from "~/server/types";

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
      getGmailClient(ctx.session.accessToken),
      ctx.db,
      ctx.session.user.id,
    );
  }),

  // Used for full sync, each iteration should sync X messages
  backFillUpdates: protectedProcedure.mutation(async ({ ctx }) => {
    return await backFillUpdates(
      getGmailClient(ctx.session.accessToken),
      ctx.db,
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
      orderBy: {
        lastSynced: "desc",
      },
      take: 10,
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
      await backFillUpdates(
        getGmailClient(googleAccount.access_token),
        ctx.db,
        user.id,
      );

      await ctx.db.user.update({
        where: {
          id: user.id,
        },
        data: {
          lastSynced: new Date(),
        },
      });
      updated.push(user.email);
      // console.warn("Successfully awaited", user.email);
    }
    return updated;
  }),

  syncedHistoryAllUsers: publicProcedure.mutation(async ({ ctx }) => {
    const users = await ctx.db.user.findMany({
      orderBy: {
        lastSynced: "desc",
      },
      include: {
        accounts: {
          where: {
            provider: "google",
          },
        },
      },
      take: 10,
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

      await syncedHistory(
        getGmailClient(googleAccount.access_token),
        ctx.db,
        user.id,
      );
      await ctx.db.user.update({
        where: {
          id: user.id,
        },
        data: {
          lastSynced: new Date(),
        },
      });
      updated.push(user.email);
      console.warn("Successfully awaited", user.email);
    }
    return updated;
  }),

  sendEmail: protectedProcedure
    .input(emailZodType)
    .mutation(async ({ ctx, input }) => {
      const res = await sendMessage(
        getGmailClient(ctx.session.accessToken),
        ctx.session.user,
        input.to,
        input.subject,
        input.text,
        input.html,
        input.cc,
        input.bcc,
        input.inReplyTo,
      );
      return res;
    }),
});
