import Message from "./Message";
import { ScrollArea } from "~/components/ui/scroll-area";
import type { DBThread } from "~/server/types";

export default function Thread({ thread }: { thread: DBThread }) {
  const messages = thread.messages;

  return (
    <div className="flex flex-1 flex-col">
      <ScrollArea className="h-full max-h-[95vh]">
        {messages
          ?.map((message) => <Message key={message.id} message={message} />)
          .reverse()}
      </ScrollArea>
    </div>
  );
}
