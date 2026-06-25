/**
 * Unified Notification Model (Az Notification Hub)
 * ------------------------------------------------
 * Every incoming event from any source (Meta, UberFix, Accounting, custom)
 * is normalized into this shape before storage / delivery.
 */

export type NotificationSource =
  | "meta"
  | "uberfix"
  | "accounting"
  | "system"
  | "custom";

export type NotificationCategory =
  | "all"
  | "projects"
  | "announcements"
  | "alerts";

export type NotificationSeverity = "info" | "success" | "warning" | "critical";

export type NotificationChannel = "inapp" | "email" | "push" | "chat" | "sms";

export interface NotificationAction {
  id: string;
  label: string;
  variant?: "primary" | "secondary" | "destructive";
  /** URL to open or internal action key for the consumer app to handle. */
  href?: string;
  actionKey?: string;
}

export interface UnifiedNotification {
  id: string;
  source: NotificationSource;
  category: NotificationCategory;
  severity: NotificationSeverity;
  title: string;
  body: string;
  /** ISO 8601 timestamp */
  createdAt: string;
  read: boolean;
  /** Optional avatar / icon URL */
  avatarUrl?: string;
  /** Subject identity (e.g. user email, account, project name) */
  subject?: string;
  actions?: NotificationAction[];
  /** Raw original payload, for audit/replay (JSON-serializable) */
  raw?: JsonValue;
  /** Channels the system attempted / will attempt to deliver on */
  channels?: NotificationChannel[];
}

export interface ChannelPreferences {
  inapp: boolean;
  email: boolean;
  push: boolean;
  chat: boolean;
  sms: boolean;
}

export interface WorkflowPreference {
  workflowId: string;
  name: string;
  channels: ChannelPreferences;
}

export interface NotificationPreferences {
  global: ChannelPreferences;
  workflows: WorkflowPreference[];
}
