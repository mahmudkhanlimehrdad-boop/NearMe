export const GMAIL_SCOPES = [
  'https://mail.google.com/',
  'https://www.googleapis.com/auth/gmail.addons.current.action.compose',
  'https://www.googleapis.com/auth/gmail.addons.current.message.action',
  'https://www.googleapis.com/auth/gmail.addons.current.message.metadata',
  'https://www.googleapis.com/auth/gmail.addons.current.message.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.insert',
  'https://www.googleapis.com/auth/gmail.labels',
  'https://www.googleapis.com/auth/gmail.metadata',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.settings.basic',
  'https://www.googleapis.com/auth/gmail.settings.sharing',
] as const;

export interface GmailHeader {
  name?: string;
  value?: string;
}

export interface GmailMessagePart {
  mimeType?: string;
  body?: {
    data?: string;
    size?: number;
  };
  parts?: GmailMessagePart[];
}

export interface GmailApiMessage {
  id: string;
  threadId?: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: {
    headers?: GmailHeader[];
    mimeType?: string;
    body?: {
      data?: string;
      size?: number;
    };
    parts?: GmailMessagePart[];
  };
}

export interface GmailMessageSummary {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  snippet: string;
  isUnread: boolean;
  labelIds: string[];
  bodyText: string;
}

export interface GmailComposeDraft {
  to: string;
  subject: string;
  body: string;
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function encodeBase64UrlUtf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeBase64UrlUtf8(encoded: string): string {
  if (!encoded) return '';
  const padded = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const mod = padded.length % 4;
  const fullBase64 = mod === 0 ? padded : padded + '='.repeat(4 - mod);
  const bytes = base64ToBytes(fullBase64);
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

function encodeMimeHeaderValue(value: string): string {
  const cleaned = value.replace(/[\r\n]+/g, ' ').trim();
  if (/^[\x20-\x7E]*$/.test(cleaned)) {
    return cleaned;
  }
  const bytes = new TextEncoder().encode(cleaned);
  return `=?UTF-8?B?${bytesToBase64(bytes)}?=`;
}

export function encodeRawEmail(draft: GmailComposeDraft): string {
  const to = draft.to.replace(/[\r\n]+/g, '').trim();
  const subject = encodeMimeHeaderValue(draft.subject);
  const body = draft.body.replace(/\r?\n/g, '\r\n');

  const rawMime = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    body,
  ].join('\r\n');

  return encodeBase64UrlUtf8(rawMime);
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractPartBody(part?: GmailMessagePart): { plain?: string; html?: string } {
  if (!part) return {};
  if (part.mimeType === 'text/plain' && part.body?.data) {
    return { plain: decodeBase64UrlUtf8(part.body.data) };
  }
  if (part.mimeType === 'text/html' && part.body?.data) {
    return { html: decodeBase64UrlUtf8(part.body.data) };
  }
  let plain: string | undefined;
  let html: string | undefined;
  if (Array.isArray(part.parts)) {
    for (const child of part.parts) {
      const res = extractPartBody(child);
      if (!plain && res.plain) plain = res.plain;
      if (!html && res.html) html = res.html;
    }
  }
  return { plain, html };
}

export function extractMessageMetadata(msg: GmailApiMessage): GmailMessageSummary {
  const headers = msg.payload?.headers || [];
  const getHeader = (name: string) =>
    headers.find((h) => (h.name || '').toLowerCase() === name.toLowerCase())?.value || '';

  const labelIds = Array.isArray(msg.labelIds) ? msg.labelIds : [];
  const extracted = extractPartBody(msg.payload);
  let bodyText = extracted.plain || (extracted.html ? stripHtmlTags(extracted.html) : '');
  if (!bodyText && msg.payload?.body?.data) {
    bodyText = decodeBase64UrlUtf8(msg.payload.body.data);
  }
  if (!bodyText && msg.snippet) {
    bodyText = msg.snippet;
  }

  return {
    id: msg.id,
    threadId: msg.threadId || msg.id,
    subject: getHeader('Subject') || '(No subject)',
    from: getHeader('From') || 'Unknown sender',
    to: getHeader('To') || '',
    date: getHeader('Date') || '',
    snippet: msg.snippet || '',
    isUnread: labelIds.includes('UNREAD'),
    labelIds,
    bodyText,
  };
}

export function validateComposeDraft(draft: GmailComposeDraft): { valid: boolean; reason?: string } {
  const to = draft.to.trim();
  const subject = draft.subject.trim();
  const body = draft.body.trim();
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return { valid: false, reason: 'invalidEmail' };
  }
  if (!subject) {
    return { valid: false, reason: 'missingSubject' };
  }
  if (!body) {
    return { valid: false, reason: 'missingBody' };
  }
  return { valid: true };
}
