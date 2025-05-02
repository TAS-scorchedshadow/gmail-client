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
import Message from "./Message";
import { ScrollArea } from "~/components/ui/scroll-area";

interface Thread {
  historyId?: string | null | undefined;
  id?: string | null | undefined;
  messages?: gmail_v1.Schema$Message[] | undefined;
  snippet?: string | null | undefined;
}

export default function Thread({ thread }: { thread: Thread }) {
  console.log(thread);
  const messages = thread?.messages;
  const message = thread?.messages[0];

  const headers = message?.payload?.headers;
  console.log(thread);

  const _sender =
    headers?.find((h) => h.name === "From")?.value?.split("<")[0] ?? "Unknown";
  const sender = elipseSubstring(_sender, 40);
  const subject =
    headers?.find((h) => h.name === "Subject")?.value ?? "Unknown";
  const date = headers?.find((h) => h.name === "Date")?.value;

  return (
    <div className="flex flex-1 flex-col">
      <ScrollArea className="h-full max-h-screen overflow-y-auto">
        {messages &&
          messages.map((message) => (
            <Message key={message.id} message={message} />
          ))}
        <Separator className="mt-auto" />
        <div className="p-4">
          <form>
            <div className="grid gap-4">
              <Textarea className="p-4" placeholder={`Reply ${sender}...`} />
              <div className="flex items-center">
                <Label
                  htmlFor="mute"
                  className="flex items-center gap-2 text-xs font-normal"
                >
                  <Switch id="mute" aria-label="Mute thread" /> Mute this thread
                </Label>
                <Button
                  onClick={(e) => e.preventDefault()}
                  size="sm"
                  className="ml-auto"
                >
                  Send
                </Button>
              </div>
            </div>
          </form>
        </div>
      </ScrollArea>
    </div>
  );
}
