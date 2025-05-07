"use client";

import { Button } from "~/components/ui/button";
import { mails } from "./data";
import { Mail } from "./Mail";
import { api } from "~/trpc/react";
import type { Session } from "next-auth";

export default function MailPage({ user }: { user: Session["user"] }) {
  // const defaultLayout = "react-resizable-panels:layout:mail";
  // const defaultCollapsed = "react-resizable-panels:collapsed";
  const mut = api.email.backFillUpdatesAllUsers.useMutation({});
  const mutSync = api.email.syncedHistoryAllUsers.useMutation({});

  return (
    <div className="flex w-full flex-col">
      <div className="flex gap-2">
        <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
          {mut.isPending ? "Pulling..." : "Backfill update all users"}
        </Button>
        <Button onClick={() => mutSync.mutate()} disabled={mutSync.isPending}>
          {mutSync.isPending ? "Pulling..." : "Sync All users"}
        </Button>
      </div>
      <Mail
        mails={mails}
        user={user}
        defaultLayout={undefined}
        navCollapsedSize={0}
      />
    </div>
  );
}
