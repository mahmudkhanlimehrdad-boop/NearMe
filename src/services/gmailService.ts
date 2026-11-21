import {
  encodeRawEmail,
  extractMessageMetadata,
  type GmailApiMessage,
  type GmailComposeDraft,
  type GmailMessageSummary,
} from '../utils/gmail';

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

export class GmailApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'GmailApiError';
    this.status = status;
  }
}

async function gmailFetch<T>(
  accessToken: string,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${GMAIL_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let msg = `Gmail API error (${res.status})`;
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string } };
      if (parsed?.error?.message) {
        msg = parsed.error.message;
      }
    } catch {
      if (text) msg = text;
    }
    throw new GmailApiError(res.status, msg);
  }

  return (await res.json()) as T;
}

export async function listGmailMessages(
  accessToken: string,
  query = '',
  maxResults = 15
): Promise<GmailMessageSummary[]> {
  const params = new URLSearchParams({
    maxResults: String(maxResults),
  });
  if (query.trim()) {
    params.set('q', query.trim());
  }

  const listData = await gmailFetch<{ messages?: { id: string; threadId?: string }[] }>(
    accessToken,
    `/messages?${params.toString()}`
  );

  const ids = (listData.messages || []).slice(0, maxResults);
  if (ids.length === 0) return [];

  const details = await Promise.all(
    ids.map((item) =>
      gmailFetch<GmailApiMessage>(
        accessToken,
        `/messages/${encodeURIComponent(item.id)}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`
      )
    )
  );

  return details.map(extractMessageMetadata);
}

export async function getGmailMessage(
  accessToken: string,
  messageId: string
): Promise<GmailMessageSummary> {
  const msg = await gmailFetch<GmailApiMessage>(
    accessToken,
    `/messages/${encodeURIComponent(messageId)}?format=full`
  );
  return extractMessageMetadata(msg);
}

export async function sendGmailMessage(
  accessToken: string,
  draft: GmailComposeDraft
): Promise<{ id: string; threadId?: string }> {
  const raw = encodeRawEmail(draft);
  return gmailFetch<{ id: string; threadId?: string }>(accessToken, '/messages/send', {
    method: 'POST',
    body: JSON.stringify({ raw }),
  });
}

export async function trashGmailMessage(accessToken: string, messageId: string): Promise<void> {
  await gmailFetch(accessToken, `/messages/${encodeURIComponent(messageId)}/trash`, {
    method: 'POST',
  });
}

export async function markGmailMessageRead(accessToken: string, messageId: string): Promise<void> {
  await gmailFetch(accessToken, `/messages/${encodeURIComponent(messageId)}/modify`, {
    method: 'POST',
    body: JSON.stringify({ removeLabelIds: ['UNREAD'] }),
  });
}
