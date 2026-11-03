export type ConfessionStatus = "PENDING" | "PUBLISHED" | "REJECTED";
export type CommentStatus = "VISIBLE" | "HIDDEN";
export type ReportStatus = "OPEN" | "RESOLVED" | "DISMISSED";
export type ReactionType = "like";
/** Role ladder: owner > admin > moderator > user. */
export type UserRole = "user" | "moderator" | "admin" | "owner";

export interface Confession {
  id: string;
  message: string;
  category: CategoryId;
  /** Hanya ada di data privat (staff/server); tidak pernah di data publik. */
  authorUid?: string;
  createdAt: number;
  status: ConfessionStatus;
  likesCount: number;
  commentsCount: number;
}

export interface ConfessionComment {
  id: string;
  confessionId: string;
  authorUid?: string;
  message: string;
  createdAt: number;
  status: CommentStatus;
}

export interface Reaction {
  id: string;
  confessionId: string;
  userUid: string;
  type: ReactionType;
  createdAt: number;
}

export interface Report {
  id: string;
  confessionId: string;
  reporterUid: string;
  reason: ReportReason;
  detail?: string;
  createdAt: number;
  status: ReportStatus;
}

export interface AppUser {
  uid: string;
  role: UserRole;
  createdAt: number;
  isBlocked: boolean;
}

export interface AppSettings {
  websiteName: string;
  maintenanceMode: boolean;
  announcement: string;
  allowComments: boolean;
  allowConfessions: boolean;
  maxConfessionLength: number;
  dailySubmissionLimit: number;
}

export type CategoryId =
  | "love"
  | "curhat"
  | "school"
  | "friendship"
  | "life"
  | "random";

export type ReportReason =
  | "bullying"
  | "harassment"
  | "slander"
  | "threat"
  | "privacy"
  | "inappropriate";

export type FeedFilter = "all" | "latest" | "popular" | "random";
