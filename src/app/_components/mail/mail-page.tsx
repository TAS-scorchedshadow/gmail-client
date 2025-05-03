import { Button } from "~/components/ui/button";
import { accounts, mails } from "./data";
import { Mail } from "./mail";
import { api } from "~/trpc/react";

export default function MailPage() {
  const defaultLayout = "react-resizable-panels:layout:mail";
  const defaultCollapsed = "react-resizable-panels:collapsed";
  const mut = api.email.pullUpdates.useMutation();

  return (
    <div className="flex w-full flex-col">
      <Button onClick={() => mut.mutate()}>Pull Data</Button>
      <Mail
        accounts={accounts}
        mails={mails}
        defaultLayout={undefined}
        navCollapsedSize={0}
      />
    </div>
  );
}
