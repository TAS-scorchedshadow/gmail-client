"use client";

import { api } from "~/trpc/react";
import MailPage from "./mail/mail-page";
import { Button } from "~/components/ui/button";

export default function EmailTest() {
  return <MailPage />;
}
