"use client";

import { LogOutIcon } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import * as React from "react";
import { Button } from "~/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Separator } from "~/components/ui/separator";
import { cn } from "~/lib/utils";

interface AccountSwitcherProps {
  isCollapsed: boolean;
}

export function AccountSwitcher({ isCollapsed }: AccountSwitcherProps) {
  const user = useSession().data?.user;

  return isCollapsed ? (
    <Popover>
      <PopoverTrigger
        className={cn(
          "bg-secondary flex cursor-pointer items-center gap-2 rounded-md [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0 [&>span]:line-clamp-1 [&>span]:flex [&>span]:w-full [&>span]:items-center [&>span]:gap-1 [&>span]:truncate",
          isCollapsed &&
            "flex h-9 w-9 shrink-0 items-center justify-center p-0 [&>span]:w-auto [&>svg]:hidden",
        )}
        aria-label="Select account"
      >
        {user?.name
          ? user?.name
              .split(" ")
              .map((chunk) => chunk[0])
              .join("")
          : "AC"}
      </PopoverTrigger>
      <PopoverContent className="flex flex-col gap-2 text-sm">
        <p className="mb-2">{user?.email}</p>
        <Separator />
        <p>Dylan Huynh</p>
        <Link href={"/api/auth/signout"} className="cursor-pointer">
          <Button size={"sm"} className="w-full">
            Sign out <LogOutIcon />
          </Button>
        </Link>
      </PopoverContent>
    </Popover>
  ) : (
    <div className="flex w-full items-center justify-between">
      <p className="pl-1">{user?.email}</p>
      <Link href={"/api/auth/signout"} className="cursor-pointer">
        <Button className="cursor-pointer text-xs">
          <p>Sign Out</p>
          <LogOutIcon />
        </Button>
      </Link>
    </div>
  );
}
