import { google } from "googleapis";

const gmail = google.gmail({
  version: "v1",
  auth: process.env.AUTH_GOOGLE_SECRET,
});

export default gmail;
