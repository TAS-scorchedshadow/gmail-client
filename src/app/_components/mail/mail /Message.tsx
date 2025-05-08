import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Separator } from "~/components/ui/separator";
import { format } from "date-fns/format";
import elipseSubstring from "~/app/utils/substring";
import DOMPurify from "dompurify";
import type { DBMessage } from "~/server/types";
import { unescape } from "lodash";
import { useQuery } from "@tanstack/react-query";

export default function Message({
  message,
}: {
  // Currently coerces to link into of s3link ????????
  message: DBMessage;
}) {
  // const { data } = api.email.getS3Bucket.useQuery({
  //   key: `message-${message.id}`,
  // });

  // const [html, setHtml] = useState<string>("");
  // useEffect(() => {
  //   console.log(message);
  //   fetch(message.s3Link)
  //     .then((res) => {
  //       return res.text();
  //     })
  //     .then((resp) => setHtml(resp))
  //     .catch((err) => "Error" + console.log(err));
  // }, [message]);
  console.log(message);

  const query = useQuery({
    queryKey: ["message", message.id],
    queryFn: () => fetch(message.s3Link).then((res) => res.text()),
  });

  const html = query.data ?? "";

  const headers = message.headers;

  const _sender = message.from.map((f) => f.name).join(", ");
  const sender = elipseSubstring(_sender, 40);
  const date = headers?.find((h) => h.key === "date")?.line;

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
      <div className="flex-1 p-4 text-sm whitespace-pre-wrap">
        <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} />
      </div>
    </div>
  );
}
