import { cn } from "~/lib/utils";
import elipseSubstring from "~/app/utils/substring";
import { formatDistanceToNow } from "date-fns/formatDistanceToNow";
import { useSafeContext } from "../../../providers/useSafeContext";
import { ThreadContext } from "../../../providers/ThreadContext";
import type { DBAddress, DBThread } from "~/server/types";
import { unescape } from "lodash";

export default function ThreadPreview({ thread }: { thread: DBThread }) {
  const { activeThread, setActiveThread } = useSafeContext(ThreadContext);

  if (thread.messages.length === 0) {
    return <div>Loading</div>;
  }

  const message = thread.messages[0]!;

  const from: DBAddress = message.from[0] ?? { email: "Unknown", name: "" };

  const sender = elipseSubstring(
    from.name && from.name !== "" ? `${from.name} <${from.email}>` : from.email,
    40,
  );

  const date = message.date;

  return (
    <button
      key={thread.id}
      className={cn(
        "hover:bg-accent flex h-28 w-full flex-col items-start gap-2 rounded-lg border p-3 text-left text-sm transition-all",
        activeThread.id === thread.id && "bg-muted",
      )}
      onClick={() => {
        // mut.mutate({threadId: thread.id! });
        setActiveThread(thread);
      }}
    >
      <div className="flex w-full flex-col gap-1">
        <div className="flex items-center">
          <div className="flex items-center gap-2">
            <div className="font-semibold">{unescape(sender)}</div>
            {/* {
              labels?.includes("UNREAD") && (
                <span className="flex h-2 w-2 rounded-full bg-blue-600" />
              )
              // Has been read
            } */}
          </div>
          <div
            className={cn(
              "ml-auto text-xs",
              thread.id === activeThread.id
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
          {elipseSubstring(unescape(message.subject), 52)}
        </div>
      </div>
      <div className="text-muted-foreground line-clamp-2 text-xs">
        {elipseSubstring(unescape(message.snippet.toString()), 110)}
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

// function getBadgeVariantFromLabel(
//   label: string,
// ): ComponentProps<typeof Badge>["variant"] {
//   if (["work"].includes(label.toLowerCase())) {
//     return "default";
//   }

//   if (["personal"].includes(label.toLowerCase())) {
//     return "outline";
//   }

//   return "secondary";
// }
