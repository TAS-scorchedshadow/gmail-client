import type { PrismaClient } from "@prisma/client";
import type { gmail_v1 } from "googleapis";
import { addMessages } from "./message";

async function syncedHistory(
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

  const lastHistory = user.lastHistoryId ?? undefined;

  console.log("============" + lastHistory);
  try {
    const res = await gmail.users.history.list({
      userId: "me",
      maxResults: parseInt(process.env.MAX_RECENT_EMAILS ?? "100"),
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

export { syncedHistory };
