import {
  useState,
  type ComponentProps,
  type SetStateAction,
  type Dispatch,
} from "react";
import { cn } from "~/lib/utils";
import { mails } from "../data";
import type { gmail_v1 } from "googleapis/build/src/apis/gmail/v1";
import { api } from "~/trpc/react";
import elipseSubstring from "~/app/utils/substring";
import { Badge } from "~/components/ui/badge";
import { formatDistanceToNow } from "date-fns/formatDistanceToNow";

export default function ThreadPreview({
  thread,
  activeThreadId,
  setActiveThreadId,
}: {
  thread: gmail_v1.Schema$Thread;
  activeThreadId: string;
  setActiveThreadId: Dispatch<SetStateAction<string>>;
}) {
  const [mail, setMail] = useState(mails);

  const { data } = api.email.getThread.useQuery({ threadId: thread.id! });
  const mut = api.email.updateThread.useMutation();

  const message = data?.data.messages[0];

  const headers = message?.payload?.headers;
  const labels = message?.labelIds;

  const _sender =
    headers?.find((h) => h.name === "From")?.value?.split("<")[0] ?? "Unknown";
  const sender = elipseSubstring(_sender, 40);
  const subject =
    headers?.find((h) => h.name === "Subject")?.value ?? "Unknown";
  const date = headers?.find((h) => h.name === "Date")?.value;

  return (
    <button
      key={thread.id}
      className={cn(
        "hover:bg-accent flex h-28 w-full flex-col items-start gap-2 rounded-lg border p-3 text-left text-sm transition-all",
        activeThreadId === thread.id && "bg-muted",
      )}
      onClick={() => {
        mut.mutate({ threadId: thread.id! });
        setActiveThreadId(thread.id!);
      }}
    >
      <div className="flex w-full flex-col gap-1">
        <div className="flex items-center">
          <div className="flex items-center gap-2">
            <div className="font-semibold">{sender}</div>
            {
              labels?.includes("UNREAD") && (
                <span className="flex h-2 w-2 rounded-full bg-blue-600" />
              )
              // Has been read
            }
          </div>
          <div
            className={cn(
              "ml-auto text-xs",
              mail.selected === thread.id
                ? "text-foreground"
                : "text-muted-foreground",
            )}
          >
            {date
              ? formatDistanceToNow(new Date(date), {
                  addSuffix: true,
                })
              : null}
          </div>
        </div>
        <div className="text-xs font-medium">
          {elipseSubstring(subject, 52)}
        </div>
      </div>
      <div className="text-muted-foreground line-clamp-2 text-xs">
        {elipseSubstring(message?.snippet ?? "", 110)}
      </div>

      {/* {labels?.length ? (
        <div className="flex items-center gap-2">
          {labels.map((label) => (
            <Badge key={label} variant={getBadgeVariantFromLabel(label)}>
              {label}
            </Badge>
          ))}
        </div>
      ) : null} */}
    </button>
  );
}

function getBadgeVariantFromLabel(
  label: string,
): ComponentProps<typeof Badge>["variant"] {
  if (["work"].includes(label.toLowerCase())) {
    return "default";
  }

  if (["personal"].includes(label.toLowerCase())) {
    return "outline";
  }

  return "secondary";
}
