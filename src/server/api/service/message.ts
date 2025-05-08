import type { PrismaClient } from "@prisma/client";
import type { gmail_v1 } from "googleapis";
import { type ParsedMail, simpleParser } from "mailparser";
import type { DBMessage } from "~/server/types";
import { parseAddress, parseAddressMany } from "../utils/address";
import { putS3Bucket, getSignedUrlS3 } from "./s3service";
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

      // TODO: Support text only emails
      if (!parsed.html) {
        return false;
      }

      await putS3Bucket(`message-${message.id}`, parsed.html);
      const link = await getSignedUrlS3(`message-${message.id}`);

      if (
        !parsed.subject ||
        !parsed.from ||
        !parsed.date ||
        !parsed.to ||
        !parsed.messageId
      ) {
        return false;
      }
      console.log(parsed.from);

      const toInsert: DBMessage = {
        id: data.id,
        emailRawId: parsed.messageId,
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

export { getMessage, addMessages };
