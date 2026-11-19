import type {
  AuthorizedContacts,
  ContactInformation,
  ContactMethod,
  UserProfile,
} from '../types/nearme';

export const CONTACT_METHODS: ContactMethod[] = [
  'instagram',
  'telegram',
  'whatsapp',
  'website',
  'email',
  'mobile',
];

export const INTEREST_OPTIONS = [
  'travel',
  'music',
  'photography',
  'cinema',
  'cooking',
  'fitness',
  'art',
  'technology',
  'books',
  'coffee',
  'hiking',
  'languages',
] as const;

export const HOBBY_OPTIONS = [
  'cycling',
  'yoga',
  'sketching',
  'gaming',
  'gardening',
  'dancing',
  'podcasts',
  'swimming',
  'volunteering',
  'astronomy',
] as const;

export const SUPPORTED_PROFILE_LANGUAGES = [
  'Persian',
  'English',
  'Turkish',
  'Arabic',
  'Mandarin',
  'Cantonese',
  'French',
  'German',
  'Spanish',
  'Italian',
] as const;

export function calculateAge(birthDateISO: string, referenceDate: Date = new Date()): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDateISO)) {
    return 0;
  }
  const [yStr, mStr, dStr] = birthDateISO.split('-');
  const year = Number(yStr);
  const month = Number(mStr);
  const day = Number(dStr);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) {
    return 0;
  }
  const birth = new Date(Date.UTC(year, month - 1, day));
  if (
    birth.getUTCFullYear() !== year ||
    birth.getUTCMonth() !== month - 1 ||
    birth.getUTCDate() !== day
  ) {
    return 0;
  }

  let age = referenceDate.getUTCFullYear() - year;
  const monthDiff = referenceDate.getUTCMonth() + 1 - month;
  if (monthDiff < 0 || (monthDiff === 0 && referenceDate.getUTCDate() < day)) {
    age--;
  }
  return age;
}

export function isAdult18Plus(birthDateISO: string, referenceDate: Date = new Date()): boolean {
  const age = calculateAge(birthDateISO, referenceDate);
  return age >= 18 && age <= 120;
}

export interface ContactValidationResult {
  valid: boolean;
  normalized: string;
  externalUrl: string | null;
  errorKey?: string;
}

const UNSAFE_SCHEME_REGEX = /^(javascript|data|vbscript|file|blob):/i;

export function sanitizeText(input: string, maxLength = 300): string {
  return input
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLength);
}

export function sanitizeAndValidateContact(
  method: ContactMethod,
  rawInput: string
): ContactValidationResult {
  const cleaned = sanitizeText(rawInput, 300);
  if (!cleaned) {
    return { valid: false, normalized: '', externalUrl: null, errorKey: 'errors.contactEmpty' };
  }

  if (UNSAFE_SCHEME_REGEX.test(cleaned)) {
    return { valid: false, normalized: '', externalUrl: null, errorKey: 'errors.unsafeUrl' };
  }

  switch (method) {
    case 'instagram': {
      let username = cleaned;
      const urlMatch = cleaned.match(/^https?:\/\/(?:www\.)?instagram\.com\/([a-zA-Z0-9._]{1,30})\/?(?:\?.*)?$/i);
      if (urlMatch) {
        username = urlMatch[1];
      } else {
        if (/^https?:\/\//i.test(cleaned)) {
          return { valid: false, normalized: '', externalUrl: null, errorKey: 'errors.invalidInstagram' };
        }
        username = cleaned.replace(/^@+/, '');
      }
      if (!/^[a-zA-Z0-9._]{1,30}$/.test(username) || username.includes('..')) {
        return { valid: false, normalized: '', externalUrl: null, errorKey: 'errors.invalidInstagram' };
      }
      return {
        valid: true,
        normalized: `@${username}`,
        externalUrl: `https://instagram.com/${username}`,
      };
    }

    case 'telegram': {
      let username = cleaned;
      const urlMatch = cleaned.match(/^https?:\/\/(?:t\.me|telegram\.me)\/([a-zA-Z][a-zA-Z0-9_]{3,31})\/?$/i);
      if (urlMatch) {
        username = urlMatch[1];
      } else {
        if (/^https?:\/\//i.test(cleaned)) {
          return { valid: false, normalized: '', externalUrl: null, errorKey: 'errors.invalidTelegram' };
        }
        username = cleaned.replace(/^@+/, '');
      }
      if (!/^[a-zA-Z][a-zA-Z0-9_]{3,31}$/.test(username)) {
        return { valid: false, normalized: '', externalUrl: null, errorKey: 'errors.invalidTelegram' };
      }
      return {
        valid: true,
        normalized: `https://t.me/${username}`,
        externalUrl: `https://t.me/${username}`,
      };
    }

    case 'whatsapp': {
      let digits = cleaned;
      const waMatch = cleaned.match(/^https?:\/\/wa\.me\/(\d{7,15})\/?$/i);
      if (waMatch) {
        digits = waMatch[1];
      } else {
        if (/^https?:\/\//i.test(cleaned)) {
          return { valid: false, normalized: '', externalUrl: null, errorKey: 'errors.invalidWhatsapp' };
        }
        digits = cleaned.replace(/[\s\-().]/g, '').replace(/^\+/, '');
      }
      if (!/^\d{7,15}$/.test(digits)) {
        return { valid: false, normalized: '', externalUrl: null, errorKey: 'errors.invalidWhatsapp' };
      }
      return {
        valid: true,
        normalized: `+${digits}`,
        externalUrl: `https://wa.me/${digits}`,
      };
    }

    case 'website': {
      const candidate = /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;
      let parsed: URL;
      try {
        parsed = new URL(candidate);
      } catch {
        return { valid: false, normalized: '', externalUrl: null, errorKey: 'errors.invalidWebsite' };
      }
      if (parsed.protocol !== 'https:') {
        return { valid: false, normalized: '', externalUrl: null, errorKey: 'errors.httpsRequired' };
      }
      const host = parsed.hostname.toLowerCase();
      if (
        !host.includes('.') ||
        host === 'localhost' ||
        /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)
      ) {
        return { valid: false, normalized: '', externalUrl: null, errorKey: 'errors.invalidWebsite' };
      }
      return {
        valid: true,
        normalized: parsed.toString(),
        externalUrl: parsed.toString(),
      };
    }

    case 'email': {
      const lower = cleaned.toLowerCase();
      const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
      if (!emailRegex.test(lower) || lower.length > 200) {
        return { valid: false, normalized: '', externalUrl: null, errorKey: 'errors.invalidEmail' };
      }
      return {
        valid: true,
        normalized: lower,
        externalUrl: `mailto:${lower}`,
      };
    }

    case 'mobile': {
      const compact = cleaned.replace(/[\s\-().]/g, '');
      const e164 = compact.startsWith('+') ? compact : `+${compact}`;
      if (!/^\+\d{7,15}$/.test(e164)) {
        return { valid: false, normalized: '', externalUrl: null, errorKey: 'errors.invalidMobile' };
      }
      return {
        valid: true,
        normalized: e164,
        externalUrl: `tel:${e164}`,
      };
    }
  }
}

export function getContactExternalUrl(method: ContactMethod, value: string): string | null {
  const res = sanitizeAndValidateContact(method, value);
  return res.valid ? res.externalUrl : null;
}

export interface ContactAccessContext {
  viewerUid: string | null;
  ownerUid: string;
  isMutualMatch: boolean;
  isBlocked: boolean;
}

export function buildAuthorizedContacts(
  contactInfo: ContactInformation | null | undefined,
  context: ContactAccessContext
): AuthorizedContacts {
  if (!contactInfo || !context.viewerUid || context.isBlocked) {
    return {};
  }

  const isOwner = context.viewerUid === context.ownerUid;
  const result: AuthorizedContacts = {};

  for (const method of CONTACT_METHODS) {
    const field = contactInfo[method];
    if (!field || !field.enabled || !field.value) {
      continue;
    }

    if (isOwner) {
      result[method] = field.value;
    } else if (field.visibility === 'public') {
      result[method] = field.value;
    } else if (field.visibility === 'matches' && context.isMutualMatch) {
      result[method] = field.value;
    }
    // visibility === 'private' is NEVER included for non-owners
  }

  return result;
}

export function buildContactGrantsPayload(contactInfo: ContactInformation): {
  publicGrant: Partial<Record<ContactMethod, string>>;
  matchesGrant: Partial<Record<ContactMethod, string>>;
} {
  const publicGrant: Partial<Record<ContactMethod, string>> = {};
  const matchesGrant: Partial<Record<ContactMethod, string>> = {};

  for (const method of CONTACT_METHODS) {
    const field = contactInfo[method];
    if (!field || !field.enabled || !field.value) {
      continue;
    }
    const validated = sanitizeAndValidateContact(method, field.value);
    if (!validated.valid) continue;

    if (field.visibility === 'public') {
      publicGrant[method] = validated.normalized;
      matchesGrant[method] = validated.normalized;
    } else if (field.visibility === 'matches') {
      matchesGrant[method] = validated.normalized;
    }
    // 'private' fields are never written to either grant
  }

  return { publicGrant, matchesGrant };
}

export function calculateProfileCompletion(profile: Partial<UserProfile> | null, photoCount = 0): number {
  if (!profile) return 0;
  const checks = [
    Boolean(profile.displayName && profile.displayName.length >= 2),
    Boolean(profile.birthDate && isAdult18Plus(profile.birthDate)),
    Boolean(profile.gender),
    Boolean(profile.country && profile.city),
    Boolean(profile.biography && profile.biography.trim().length >= 10),
    Boolean(profile.interests && profile.interests.length > 0),
    Boolean(profile.hobbies && profile.hobbies.length > 0),
    Boolean(profile.languages && profile.languages.length > 0),
    Boolean(profile.relationshipGoals),
    Boolean(profile.mainPhotoUrl || photoCount > 0),
  ];
  const passed = checks.filter(Boolean).length;
  return Math.round((passed / checks.length) * 100);
}

export function makePairId(uid1: string, uid2: string): string {
  return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
}

export function createDefaultContactInformation(uid: string, timestamp: unknown): ContactInformation {
  const emptyField = () => ({
    value: '',
    visibility: 'private' as const,
    enabled: false,
    updatedAt: timestamp,
  });

  return {
    uid,
    instagram: emptyField(),
    telegram: emptyField(),
    whatsapp: emptyField(),
    website: emptyField(),
    email: emptyField(),
    mobile: emptyField(),
    updatedAt: timestamp,
  };
}
