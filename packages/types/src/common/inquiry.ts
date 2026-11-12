/**
 * Contact form rules (ivy-docs T11, SCR-IVY-13, PLN-261112-IVY-T11 D2/D3).
 *
 * ONE source for the widget form and the API: the widget shows the problem
 * under the field before anything is sent, and the API refuses the same input
 * with the same verdict, so a shopper never gets past one only to be refused
 * by the other.
 *
 * Browser bundles deep-import this file (a value import from `@sharptalk/types`
 * fails the widget build — CJS `export *`).
 */

export const INQUIRY_NAME_MAX = 100;
export const INQUIRY_EMAIL_MAX = 254;
export const INQUIRY_MESSAGE_MAX = 2000;

/** Same address shape the callback card accepts (PLN-261026). */
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;

export function isEmailAddress(value: unknown): boolean {
  const v = String(value ?? '').trim();
  return v.length <= INQUIRY_EMAIL_MAX && EMAIL_RE.test(v);
}

export type InquiryField = 'name' | 'email' | 'message';
export type InquiryProblem = 'required' | 'invalid' | 'tooLong';

export interface InquiryInput {
  name: string;
  email: string;
  message: string;
}

/** What is wrong with each field; `{}` = ready to send. */
export function inquiryProblems(input: Partial<InquiryInput>): Partial<Record<InquiryField, InquiryProblem>> {
  const out: Partial<Record<InquiryField, InquiryProblem>> = {};
  const name = String(input.name ?? '').trim();
  const email = String(input.email ?? '').trim();
  const message = String(input.message ?? '').trim();
  if (!name) out.name = 'required';
  else if (name.length > INQUIRY_NAME_MAX) out.name = 'tooLong';
  if (!email) out.email = 'required';
  else if (!isEmailAddress(email)) out.email = 'invalid';
  if (!message) out.message = 'required';
  else if (message.length > INQUIRY_MESSAGE_MAX) out.message = 'tooLong';
  return out;
}

/** Trimmed, with the address lower-cased — what gets stored. */
export function normalizeInquiry(input: InquiryInput): InquiryInput {
  return {
    // A name goes into a mail subject: no line breaks.
    name: input.name.replace(/[\r\n]+/g, ' ').trim(),
    email: input.email.trim().toLowerCase(),
    message: input.message.trim(),
  };
}

/**
 * The tenant's Contact Support channels as the widget shows them (D1, BUG-010).
 * Only what the tenant filled in appears. With nothing filled in, the live chat
 * card stays so the button never answers with an empty list.
 */
export type ContactChannel =
  | { kind: 'email'; address: string }
  | { kind: 'phone'; number: string }
  | { kind: 'chat' };

export function contactChannels(copy: {
  supportEmail?: string | null;
  supportPhone?: string | null;
  contactLiveChat?: boolean | null;
} | null | undefined): ContactChannel[] {
  const out: ContactChannel[] = [];
  const email = copy?.supportEmail?.trim();
  const phone = copy?.supportPhone?.trim();
  if (email && isEmailAddress(email)) out.push({ kind: 'email', address: email });
  if (phone) out.push({ kind: 'phone', number: phone });
  if (copy?.contactLiveChat || out.length === 0) out.push({ kind: 'chat' });
  return out;
}

/** Digits and a leading + — what a `tel:` link dials. */
export function telHref(phone: string): string {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/[^\d]/g, '');
  return `tel:${trimmed.startsWith('+') ? '+' : ''}${digits}`;
}

/** A phone number a tenant may show: digits with the usual separators. */
export const SUPPORT_PHONE_RE = /^\+?[\d\s().-]{4,32}$/;
