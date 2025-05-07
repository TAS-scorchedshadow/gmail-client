import type { PrismaClient } from "@prisma/client";
import type { DBThread, DBMessage } from "~/server/types";
import { isPresignedUrlExpired } from "../utils/s3refresh";
import { getSignedUrlS3 } from "./s3service";

// Get new signed links for s3

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

export { refreshThread, refreshS3Link };
