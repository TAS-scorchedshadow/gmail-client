"use client";
import { Mail } from "./Mail";
import type { Session } from "next-auth";

export default function MailPage({ user }: { user: Session["user"] }) {
  // const defaultLayout = "react-resizable-panels:layout:mail";
  // const defaultCollapsed = "react-resizable-panels:collapsed";
  return <Mail user={user} defaultLayout={undefined} navCollapsedSize={0} />;
}
