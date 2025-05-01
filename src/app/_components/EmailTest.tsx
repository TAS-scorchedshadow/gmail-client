"use client";

import { api } from "~/trpc/react";
import MailPage from "./mail/mail-page";

export default function EmailTest() {
  // const data = api.email.getEmails.useQuery();
  const { data } = api.email.getAllThreads.useQuery();
  console.log(data);
  return (
    <div>
      <MailPage />
    </div>
  );
}
