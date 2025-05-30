import { Forward, MoreVertical, Reply, ReplyAll } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { Button } from "~/components/ui/button";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Separator } from "~/components/ui/separator";
import Thread from "./mail /Thread";
import { useSafeContext } from "../../providers/useSafeContext";
import { ThreadContext } from "../../providers/ThreadContext";
import { SendModalContext } from "~/app/providers/SendContext";
import { useFormContext } from "react-hook-form";
import type { z } from "zod";
import type { emailZodType } from "~/server/types";
import {
  forwardedMessageHTML,
  replyMessageHTML,
} from "~/app/utils/emailHelper";
import { useSession } from "next-auth/react";
import { useCallback } from "react";

export function MailDisplay() {
  const { activeThread } = useSafeContext(ThreadContext);
  const { setOpen } = useSafeContext(SendModalContext);

  const form = useFormContext<z.infer<typeof emailZodType>>();
  const { setValue } = form;
  const { data: session } = useSession();

  const handleForward = useCallback(async () => {
    const message = activeThread.messages[0];
    if (!message) {
      return;
    }
    const res = await fetch(message.s3Link).then((res) => res.text());
    const forwardHeaders = forwardedMessageHTML(
      message.from[0]!,
      new Date(),
      message.subject,
      {
        name: session?.user.name ?? "",
        email: session?.user.email ?? "",
      },
      res,
    );
    setValue("subject", `Fwd: ${activeThread.messages[0]?.subject}`);
    setValue("html", forwardHeaders);
    setOpen(true);
  }, [activeThread, setValue, setOpen, session]);

  const handleReply = useCallback(async () => {
    const message = activeThread.messages[0];
    if (!message) {
      return;
    }
    const res = await fetch(message.s3Link).then((res) => res.text());
    const forwardHeaders = replyMessageHTML(
      message.from[0]!,
      new Date(),
      message.subject,
      {
        name: session?.user.name ?? "",
        email: session?.user.email ?? "",
      },
      res,
    );
    setValue("to", `${activeThread.messages[0]?.from[0]?.email}`);
    setValue("subject", `Re: ${activeThread.messages[0]?.subject}`);
    setValue("html", forwardHeaders);
    setValue("inReplyTo", message.emailRawId);
    setOpen(true);
    console.log(message);
  }, [activeThread, setValue, setOpen, session]);

  const handleReplyAll = useCallback(async () => {
    const message = activeThread.messages[0];
    if (!message) {
      return;
    }
    const res = await fetch(message.s3Link).then((res) => res.text());
    const forwardHeaders = replyMessageHTML(
      message.from[0]!,
      new Date(),
      message.subject,
      {
        name: session?.user.name ?? "",
        email: session?.user.email ?? "",
      },
      res,
    );
    const sendTo = [...message.to, ...message.cc];
    const to = sendTo.map((item) => item.email);

    setValue("to", to);
    setValue("subject", `Re: ${activeThread.messages[0]?.subject}`);
    setValue("html", forwardHeaders);
    setValue("inReplyTo", message.emailRawId);
    setOpen(true);
  }, [activeThread, setValue, setOpen, session]);

  const mail = activeThread;
  return (
    <div className="h-max-screen flex h-full flex-col">
      <div className="flex items-center p-2">
        {/* Unimplmented features
         <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" disabled={!mail}>
                <Archive className="h-4 w-4" />
                <span className="sr-only">Archive</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Archive</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" disabled={!mail}>
                <ArchiveX className="h-4 w-4" />
                <span className="sr-only">Move to junk</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Move to junk</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" disabled={!mail}>
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Move to trash</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Move to trash</TooltipContent>
          </Tooltip>
          <Separator orientation="vertical" className="mx-1 h-6" />
          <Tooltip>
            <Popover>
              <PopoverTrigger asChild>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" disabled={!mail}>
                    <Clock className="h-4 w-4" />
                    <span className="sr-only">Snooze</span>
                  </Button>
                </TooltipTrigger>
              </PopoverTrigger>
              <PopoverContent className="flex w-[535px] p-0">
                <div className="flex flex-col gap-2 border-r px-2 py-4">
                  <div className="px-4 text-sm font-medium">Snooze until</div>
                  <div className="grid min-w-[250px] gap-1">
                    <Button
                      variant="ghost"
                      className="justify-start font-normal"
                    >
                      Later today{" "}
                      <span className="text-muted-foreground ml-auto">
                        {format(addHours(today, 4), "E, h:m b")}
                      </span>
                    </Button>
                    <Button
                      variant="ghost"
                      className="justify-start font-normal"
                    >
                      Tomorrow
                      <span className="text-muted-foreground ml-auto">
                        {format(addDays(today, 1), "E, h:m b")}
                      </span>
                    </Button>
                    <Button
                      variant="ghost"
                      className="justify-start font-normal"
                    >
                      This weekend
                      <span className="text-muted-foreground ml-auto">
                        {format(nextSaturday(today), "E, h:m b")}
                      </span>
                    </Button>
                    <Button
                      variant="ghost"
                      className="justify-start font-normal"
                    >
                      Next week
                      <span className="text-muted-foreground ml-auto">
                        {format(addDays(today, 7), "E, h:m b")}
                      </span>
                    </Button>
                  </div>
                </div>
                <div className="p-2">
                  <Calendar />
                </div>
              </PopoverContent>
            </Popover>
            <TooltipContent>Snooze</TooltipContent>
          </Tooltip>
        </div> */}
        <div className="ml-auto flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                disabled={!mail}
                onClick={() => handleReply()}
              >
                <Reply className="h-4 w-4" />
                <span className="sr-only">Reply</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reply</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                disabled={!mail}
                onClick={() => handleReplyAll()}
              >
                <ReplyAll className="h-4 w-4" />
                <span className="sr-only">Reply all</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reply all</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                disabled={!mail}
                onClick={() => handleForward()}
              >
                <Forward className="h-4 w-4" />
                <span className="sr-only">Forward</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Forward</TooltipContent>
          </Tooltip>
        </div>
        <Separator orientation="vertical" className="mx-2 h-6" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" disabled={!mail}>
              <MoreVertical className="h-4 w-4" />
              <span className="sr-only">More</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Mark as unread</DropdownMenuItem>
            <DropdownMenuItem>Star thread</DropdownMenuItem>
            <DropdownMenuItem>Add label</DropdownMenuItem>
            <DropdownMenuItem>Mute thread</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Separator />
      {activeThread.id !== "default" ? (
        <Thread thread={activeThread} />
      ) : (
        <div className="text-muted-foreground p-8 text-center">
          No message selected
        </div>
      )}
    </div>
  );
}
