// Standard reference for email validation: https://tools.ietf.org/html/rfc5322

import type { DBAddress } from "~/server/types";

const RFC5322 =
  /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9]))\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/;

export function validateEmail(email: string) {
  return RFC5322.test(email);
}

export function forwardedMessageHeader(
  from: DBAddress,
  date: Date,
  subject: string,
  to: DBAddress,
) {
  return `
  ---------- Forwarded message ---------
  From: ${from.name} <${from.email}>
  Date: ${date.toUTCString()}
  Subject: ${subject}
  To: ${to.name} <${to.email}>`;
}

export function forwardedMessageHTML(
  from: DBAddress,
  date: Date,
  subject: string,
  to: DBAddress,
  body: string,
) {
  console.log(body);
  return `
  <br>
  <br>
  <p>---------- Forwarded message ---------</p>
  <p>From: ${from.name} <${from.email}> </p>
  <p>Date: ${date.toUTCString()} </p>
  <p>Subject: ${subject} </p>
  <p>To: ${to.name} <${to.email}> </p>
  ${body}
  `;
}

export function replyMessageHTML(
  from: DBAddress,
  date: Date,
  subject: string,
  to: DBAddress,
  body: string,
) {
  console.log(body);
  return `
  <br>
  <br>
  <p>---------- Replying To ---------</p>
  <p>From: ${from.name} <${from.email}> </p>
  <p>Date: ${date.toUTCString()} </p>
  <p>Subject: ${subject} </p>
  <p>To: ${to.name} <${to.email}> </p>
  ${body}
  `;
}
export default validateEmail;
