import type { PrismaClient } from "@prisma/client";
import assert from "assert";
import { getMessage, addMessages } from "./message";
import type { gmail_v1 } from "googleapis";

async function backFillUpdates(
  gmail: gmail_v1.Gmail,
  db: PrismaClient,
  userId: string,
) {
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
    maxResults: parseInt(process.env.MAX_RECENT_EMAILS ?? "100"),
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
        res.data.nextPageToken === undefined || res.data.nextPageToken === null,
    },
  });
  console.log("========old=======" + user.nextPageToken);
  console.log("========new=======" + res.data.nextPageToken);

  await addMessages(db, gmail, userId, messages);

  return true;
}

export { backFillUpdates };
