export type DBAddress = {
  name: string;
  email?: string;
};

export type DBMessage = {
  id: string;
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
  snippet: string;
};
