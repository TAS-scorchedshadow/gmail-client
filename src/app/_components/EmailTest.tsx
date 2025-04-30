"use client";

import { api } from "~/trpc/react";

export default function EmailTest() {
  const data = api.email.getEmails.useQuery();
  console.log(data);
  return (
    <div>
      <h1>email test</h1>
    </div>
  );
}
