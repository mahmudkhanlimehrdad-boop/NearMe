export type LanguageCode = 'fa' | 'en' | 'tr' | 'ar' | 'zh-CN' | 'zh-TW';

export type Gender = 'woman' | 'man' | 'nonbinary' | 'other';
export type PreferredGender = 'woman' | 'man' | 'nonbinary' | 'everyone';
export type RelationshipGoal = 'serious' | 'casual' | 'friendship' | 'networking' | 'undecided';
export type VisibilityLevel = 'public' | 'matches' | 'private';
export type ContactMethod = 'instagram' | 'telegram' | 'whatsapp' | 'website' | 'email' | 'mobile';
export type ModerationStatus = 'approved' | 'pending' | 'rejected' | 'flagged';
export type AccountStatus = 'active' | 'suspended' | 'banned' | 'deleted';
export type MembershipTier = 'free' | 'vip';
export type SubscriptionPlan = 'none' | 'monthly' | 'quarterly' | 'annual';

export interface UserAccount {
  uid: string;
  role: 'user' | 'moderator' | 'admin';
  accountStatus: AccountStatus;
  membershipTier: MembershipTier;
  emailVerified: boolean;
  phoneVerified: boolean;
  selfieVerificationStatus: 'none' | 'pending' | 'verified' | 'rejected';
  ageConfirmed18Plus: boolean;
  birthDate: string;
  onboardingCompleted: boolean;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  birthDate: string;
  age: number;
  gender: Gender;
  preferredGender: PreferredGender;
  country: string;
  city: string;
  biography: string;
  occupation?: string;
  interests: string[];
  hobbies: string[];
  languages: string[];
  relationshipGoals: RelationshipGoal;
  mainPhotoUrl?: string;
  mainPhotoVisibility?: VisibilityLevel;
  verificationStatus: 'unverified' | 'pending' | 'verified';
  profileVisibility: 'public' | 'hidden';
  accountStatus: AccountStatus;
  isOnline?: boolean;
  lastActiveAt?: unknown;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface ProfilePhoto {
  photoId: string;
  uid: string;
  storagePath: string;
  thumbnailPath?: string;
  url: string;
  thumbnailUrl?: string;
  isMain: boolean;
  sortOrder: number;
  visibility: VisibilityLevel;
  moderationStatus: ModerationStatus;
  cropX?: number;
  cropY?: number;
  zoom?: number;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface ContactField {
  value: string;
  visibility: VisibilityLevel;
  enabled: boolean;
  updatedAt: unknown;
}

export interface ContactInformation {
  uid: string;
  instagram: ContactField;
  telegram: ContactField;
  whatsapp: ContactField;
  website: ContactField;
  email: ContactField;
  mobile: ContactField;
  updatedAt: unknown;
}

export type AuthorizedContacts = Partial<Record<ContactMethod, string>>;

export interface UserPreferences {
  uid: string;
  minimumAge: number;
  maximumAge: number;
  preferredGender: PreferredGender;
  preferredCountry?: string;
  preferredCity?: string;
  preferredLanguages?: string[];
  preferredInterests?: string[];
  relationshipGoals?: string;
  searchRadiusKm: number;
  nearbyEnabled: boolean;
  updatedAt: unknown;
}

export interface AccountSettings {
  uid: string;
  preferredLanguage: LanguageCode;
  theme: 'dark' | 'light';
  notifications: {
    matches: boolean;
    messages: boolean;
    likes: boolean;
    verification: boolean;
    subscriptions: boolean;
    security: boolean;
    browserPush: boolean;
  };
  fcmToken?: string;
  consentGdpr: boolean;
  updatedAt: unknown;
}

export interface UserLocation {
  uid: string;
  geohash: string;
  approxLat: number;
  approxLng: number;
  nearbyEnabled: boolean;
  expiresAt: unknown;
  updatedAt: unknown;
}

export interface LikeRecord {
  likeId: string;
  fromUid: string;
  toUid: string;
  type: 'like' | 'superlike' | 'pass';
  createdAt: unknown;
}

export interface MatchRecord {
  matchId: string;
  userA: string;
  userB: string;
  status: 'active' | 'unmatched';
  createdAt: unknown;
  updatedAt: unknown;
}

export interface Conversation {
  conversationId: string;
  matchId: string;
  userA: string;
  userB: string;
  lastMessagePreview?: string;
  lastSenderUid?: string;
  unreadA?: number;
  unreadB?: number;
  typingA?: boolean;
  typingB?: boolean;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface ChatMessage {
  messageId: string;
  conversationId: string;
  senderUid: string;
  recipientUid: string;
  text?: string;
  imageUrl?: string;
  read: boolean;
  createdAt: unknown;
}

export interface NotificationItem {
  notificationId: string;
  recipientUid: string;
  actorUid?: string;
  type: 'match' | 'message' | 'like' | 'verification' | 'subscription' | 'security';
  title: string;
  body: string;
  read: boolean;
  link?: string;
  createdAt: unknown;
}

export interface SubscriptionRecord {
  uid: string;
  tier: MembershipTier;
  plan: SubscriptionPlan;
  status: 'active' | 'canceled' | 'expired' | 'incomplete';
  provider?: string;
  currentPeriodEnd?: unknown;
  updatedAt: unknown;
}

export interface PaymentRecord {
  paymentId: string;
  uid: string;
  plan: 'monthly' | 'quarterly' | 'annual';
  amountCents: number;
  currency: string;
  status: 'pending' | 'verified' | 'failed' | 'refunded';
  createdAt: unknown;
}

export interface ReportRecord {
  reportId: string;
  reporterUid: string;
  targetUid: string;
  targetType: 'profile' | 'photo' | 'message' | 'privacy';
  targetId?: string;
  reason: string;
  details?: string;
  status: 'open' | 'reviewing' | 'resolved' | 'dismissed';
  resolutionNote?: string;
  reviewedBy?: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface BlockedUser {
  blockId: string;
  blockerUid: string;
  blockedUid: string;
  createdAt: unknown;
}

export interface AdminSettings {
  enabledLanguages: LanguageCode[];
  maxRadiusKm: number;
  defaultDailyLikesFree: number;
  defaultDailyLikesVip: number;
  maintenanceMode: boolean;
  updatedBy?: string;
  updatedAt: unknown;
}

export interface AuditLog {
  logId: string;
  actorUid: string;
  action: string;
  targetUid?: string;
  details: string;
  createdAt: unknown;
}

export interface CompatibilityResult {
  score: number;
  reasons: Array<{ key: string; items?: string[] }>;
}

export interface NearbyCandidate {
  profile: UserProfile;
  distanceKm: number;
  compatibility: CompatibilityResult;
}
