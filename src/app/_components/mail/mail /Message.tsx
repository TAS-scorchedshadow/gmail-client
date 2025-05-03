import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import type { Mail } from "../data";
import { format } from "date-fns/format";
import type { gmail_v1 } from "googleapis/build/src/apis/gmail/v1";
import elipseSubstring from "~/app/utils/substring";
import { api } from "~/trpc/react";
import { useEffect, useState } from "react";
import DOMPurify from "dompurify";
import type { DBMessage } from "~/server/types";

export default function Message({
  message,
}: {
  // Currently coerces to link into of s3link ????????
  message: DBMessage;
}) {
  // const { data } = api.email.getS3Bucket.useQuery({
  //   key: `message-${message.id}`,
  // });

  const [html, setHtml] = useState<string>("");
  useEffect(() => {
    console.log(message);
    fetch(message.s3Link)
      .then((res) => {
        return res.text();
      })
      .then((resp) => setHtml(resp))
      .catch((err) => "Error" + console.log(err));
  }, [message]);
  console.log(message);

  const headers = message.headers;

  const _sender =
    headers?.find((h) => h.key === "From")?.line?.split("<")[0] ?? "Unknown";
  const sender = elipseSubstring(_sender, 40);
  const subject = headers?.find((h) => h.key === "Subject")?.line ?? "Unknown";
  const date = headers?.find((h) => h.key === "Date")?.line;

  return (
    <div className="mb-10 flex flex-1 flex-col">
      <div className="flex items-start p-4">
        <div className="flex items-start gap-4 text-sm">
          <Avatar>
            <AvatarImage alt={sender} />
            <AvatarFallback>
              {sender
                .split(" ")
                .map((chunk) => chunk[0])
                .join("")}
            </AvatarFallback>
          </Avatar>
          <div className="grid gap-1">
            <div className="font-semibold">{sender}</div>
            <div className="line-clamp-1 text-xs">{subject}</div>
            <div className="line-clamp-1 text-xs">
              <span className="font-medium">Reply-To:</span> {"Reply to email"}
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
      <div className="flex-1 p-4 text-sm whitespace-pre-wrap">
        <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} />
      </div>
    </div>
  );
}
