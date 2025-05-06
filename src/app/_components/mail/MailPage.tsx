import { Button } from "~/components/ui/button";
import { accounts, mails } from "./data";
import { Mail } from "./Mail";
import { api } from "~/trpc/react";

export default function MailPage() {
  const defaultLayout = "react-resizable-panels:layout:mail";
  const defaultCollapsed = "react-resizable-panels:collapsed";
  const mut = api.email.backFillUpdates.useMutation({});
  const mutSync = api.email.syncedFromHistory.useMutation({});

  return (
    <div className="flex w-full flex-col">
      <div className="flex gap-2">
        <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
          {mut.isPending ? "Pulling..." : "Pull next 300"}
        </Button>
        <Button onClick={() => mutSync.mutate()} disabled={mutSync.isPending}>
          {mutSync.isPending ? "Pulling..." : "Pull Next"}
        </Button>
      </div>
      <Mail
        accounts={accounts}
        mails={mails}
        defaultLayout={undefined}
        navCollapsedSize={0}
      />
    </div>
  );
}
