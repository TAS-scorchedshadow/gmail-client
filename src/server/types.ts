import { z } from "zod";

export type DBAddress = {
  name: string;
  email: string;
};

export type DBMessage = {
  id: string;
  emailRawId: string;
  s3Link: string;
  headers: { key: string; line: string }[];
  subject: string;
  snippet: string;
  text: string;
  date: Date;
  to: DBAddress[];
  from: DBAddress[];
  cc: DBAddress[];
  bcc: DBAddress[];
  replyTo?: DBAddress[];
  inReplyTo?: string;
  priority?: string;
  threadId: string;
};

export type DBThread = {
  id: string;
  messages: DBMessage[];
};

export const emailZodType = z.object({
  to: z.union([z.string().email(), z.array(z.string().email())]),
  cc: z.union([z.string().email(), z.array(z.string().email())]).optional(),
  bcc: z.union([z.string().email(), z.array(z.string().email())]).optional(),
  inReplyTo: z.string().optional(),
  subject: z.string().min(1, "Subject cannot be empty"),
  text: z.string().optional(),
  html: z.string().optional(),
});
