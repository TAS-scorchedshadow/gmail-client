import { accounts, mails } from "./data";
import { Mail } from "./mail";

export default function MailPage() {
  const defaultLayout = "react-resizable-panels:layout:mail";
  const defaultCollapsed = "react-resizable-panels:collapsed";
  return (
    <div>
      <Mail
        accounts={accounts}
        mails={mails}
        defaultLayout={undefined}
        navCollapsedSize={0}
      />
    </div>
  );
}
