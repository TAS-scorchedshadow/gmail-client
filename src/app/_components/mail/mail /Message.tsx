import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Separator } from "~/components/ui/separator";
import { format } from "date-fns/format";
import elipseSubstring from "~/app/utils/substring";
import DOMPurify from "dompurify";
import type { DBAddress, DBMessage } from "~/server/types";
import { unescape } from "lodash";
import { api } from "~/trpc/react";

export default function Message({
  message,
}: {
  // Currently coerces to link into of s3link ????????
  message: DBMessage;
}) {
  const query = api.email.getMessageHTML.useQuery({
    messageId: message.id,
  });
  const html = query.data ?? "";

  const from: DBAddress = message.from[0] ?? { email: "Unknown", name: "" };

  const sender = elipseSubstring(
    from.name && from.name !== "" ? `${from.name} <${from.email}>` : from.email,
    40,
  );

  const date = message.date;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-start p-4">
        <div className="flex items-start gap-4 text-sm">
          <Avatar>
            <AvatarImage alt={sender} />
            <AvatarFallback>
              {from.name
                .split(" ")
                .map((chunk) => chunk[0])
                .join("")}
            </AvatarFallback>
          </Avatar>
          <div className="grid gap-1">
            <div className="font-semibold">{unescape(sender)}</div>
            <div className="line-clamp-1 text-xs">
              {unescape(message.subject)}
            </div>
          </div>
        </div>
        {date && (
          <div className="text-muted-foreground ml-auto text-xs">
            {format(new Date(date), "PPpp")}
          </div>
        )}
      </div>
      <Separator />
      <div className="flex-1 overflow-hidden p-4 text-sm whitespace-pre-wrap">
        <iframe className="h-screen w-full" srcDoc={DOMPurify.sanitize(html)} />
      </div>
    </div>
  );
}
