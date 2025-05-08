"use client";

import * as React from "react";
import {
  AlertCircle,
  Archive,
  ArchiveX,
  File,
  Inbox,
  LogOutIcon,
  MessagesSquare,
  Search,
  Send,
  ShoppingCart,
  Trash2,
  Users2,
} from "lucide-react";
import { TooltipProvider } from "~/components/ui/tooltip";
import { Separator } from "~/components/ui/separator";
import { Nav } from "./Nav";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "~/components/ui/resizable";
import { cn } from "~/lib/utils";
import { MailDisplay } from "./MailDisplay";
import { MailList } from "./MailList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Input } from "~/components/ui/input";
import type { Mail } from "./data";
import { ThreadProvider } from "../../providers/ThreadContext";
import type { Session } from "next-auth";
import { Button } from "~/components/ui/button";
import Link from "next/link";
import MailSendDialog from "./dialog/MailDialog";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { emailZodType } from "~/server/types";
import { SendModalProvider } from "~/app/providers/SendContext";

interface MailProps {
  mails: Mail[];
  user: Session["user"];
  defaultLayout: number[] | undefined;
  defaultCollapsed?: boolean;
  navCollapsedSize: number;
}

export function Mail({
  defaultLayout = [20, 32, 48],
  defaultCollapsed = false,
  navCollapsedSize,
  user,
}: MailProps) {
  const form = useForm<z.infer<typeof emailZodType>>({
    resolver: zodResolver(emailZodType),
    defaultValues: {
      to: [],
      cc: [],
      bcc: [],
      subject: "",
      text: "",
    },
  });

  const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed);

  const [search, setSearch] = React.useState("");

  return (
    <ThreadProvider>
      <SendModalProvider>
        <FormProvider {...form}>
          <TooltipProvider delayDuration={0}>
            <ResizablePanelGroup
              direction="horizontal"
              onLayout={(sizes: number[]) => {
                document.cookie = `react-resizable-panels:layout:mail=${JSON.stringify(
                  sizes,
                )}`;
              }}
              className="min-h-screen"
            >
              <ResizablePanel
                defaultSize={defaultLayout[0]}
                collapsedSize={navCollapsedSize}
                collapsible={true}
                minSize={15}
                maxSize={20}
                onCollapse={() => {
                  setIsCollapsed(true);
                  document.cookie = `react-resizable-panels:collapsed=${JSON.stringify(
                    true,
                  )}`;
                }}
                onResize={() => {
                  setIsCollapsed(false);
                  document.cookie = `react-resizable-panels:collapsed=${JSON.stringify(
                    false,
                  )}`;
                }}
                className={cn(
                  isCollapsed &&
                    "min-w-[50px] transition-all duration-300 ease-in-out",
                )}
              >
                <div
                  className={cn(
                    "flex h-[52px] items-center justify-between text-xs",
                    isCollapsed ? "h-[52px]" : "px-2",
                  )}
                >
                  {user.email}
                  <Link href={"/api/auth/signout"} className="cursor-pointer">
                    <Button className="cursor-pointer">
                      <p>Sign Out</p>
                      <LogOutIcon />
                    </Button>
                  </Link>
                  {/* <AccountSwitcher isCollapsed={isCollapsed} accounts={accounts} /> */}
                </div>
                <Separator />
                <div
                  className={cn(
                    "flex h-[52px] items-center justify-between text-xs",
                    isCollapsed ? "h-[52px]" : "px-2",
                  )}
                >
                  <MailSendDialog />
                </div>
                <Nav
                  isCollapsed={isCollapsed}
                  links={[
                    {
                      title: "Inbox",
                      label: "128",
                      icon: Inbox,
                      variant: "default",
                    },
                    {
                      title: "Drafts",
                      label: "9",
                      icon: File,
                      variant: "ghost",
                    },
                    {
                      title: "Sent",
                      label: "",
                      icon: Send,
                      variant: "ghost",
                    },
                    {
                      title: "Junk",
                      label: "23",
                      icon: ArchiveX,
                      variant: "ghost",
                    },
                    {
                      title: "Trash",
                      label: "",
                      icon: Trash2,
                      variant: "ghost",
                    },
                    {
                      title: "Archive",
                      label: "",
                      icon: Archive,
                      variant: "ghost",
                    },
                  ]}
                />
                <Separator />
                <Nav
                  isCollapsed={isCollapsed}
                  links={[
                    {
                      title: "Social",
                      label: "972",
                      icon: Users2,
                      variant: "ghost",
                    },
                    {
                      title: "Updates",
                      label: "342",
                      icon: AlertCircle,
                      variant: "ghost",
                    },
                    {
                      title: "Forums",
                      label: "128",
                      icon: MessagesSquare,
                      variant: "ghost",
                    },
                    {
                      title: "Shopping",
                      label: "8",
                      icon: ShoppingCart,
                      variant: "ghost",
                    },
                    {
                      title: "Promotions",
                      label: "21",
                      icon: Archive,
                      variant: "ghost",
                    },
                  ]}
                />
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel
                defaultSize={defaultLayout[1]}
                minSize={20}
                className="flex flex-col"
              >
                <Tabs defaultValue="all">
                  <div className="flex items-center px-4 py-2">
                    <h1 className="text-xl font-bold">Inbox</h1>
                    <TabsList className="ml-auto">
                      <TabsTrigger
                        value="all"
                        className="text-zinc-600 dark:text-zinc-200"
                      >
                        All mail
                      </TabsTrigger>
                      <TabsTrigger
                        value="unread"
                        className="text-zinc-600 dark:text-zinc-200"
                      >
                        Unread
                      </TabsTrigger>
                    </TabsList>
                  </div>
                  <Separator />
                  <div className="flex h-full flex-col">
                    <div className="bg-background/95 supports-[backdrop-filter]:bg-background/60 p-4 backdrop-blur">
                      <form>
                        <div className="relative">
                          <Search className="text-muted-foreground absolute top-2.5 left-2 h-4 w-4" />
                          <Input
                            placeholder="Search"
                            className="pl-8"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                          />
                        </div>
                      </form>
                    </div>
                    <TabsContent value="all" className="m-0">
                      <MailList search={search} />
                    </TabsContent>
                    <TabsContent value="unread" className="m-0">
                      <MailList
                        // items={mails.filter((item) => !item.read)}
                        search={search}
                      />
                    </TabsContent>
                  </div>
                </Tabs>
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={defaultLayout[2]} minSize={30}>
                <MailDisplay />
              </ResizablePanel>
            </ResizablePanelGroup>
          </TooltipProvider>
        </FormProvider>
      </SendModalProvider>
    </ThreadProvider>
  );
}
