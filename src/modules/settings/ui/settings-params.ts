import { firstParam, type SearchParamsRecord } from "../../customers/application/list-params";
import { EMAIL_KINDS, EMAIL_STATUSES, type EmailKind, type EmailStatus } from "../../mail/domain/email";

export const SETTINGS_TABS = ["workspace", "members", "profile", "notifications", "email"] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];

export const SETTINGS_TAB_LABELS: Record<SettingsTab, { label: string; icon: string }> = {
  workspace: { label: "Workspace", icon: "domain" },
  members: { label: "Members", icon: "group" },
  profile: { label: "Profile", icon: "person" },
  notifications: { label: "Notifications", icon: "notifications" },
  email: { label: "Email", icon: "mail" },
};

export interface SettingsParams {
  tab: SettingsTab;
  outbox: { kind?: EmailKind; status?: EmailStatus; page: number };
  /** Outbox entry opened in the detail panel. */
  emailId: number | null;
}

const positiveInt = (value: string | undefined) => (value && /^\d{1,9}$/.test(value) && Number(value) > 0 ? Number(value) : null);

/** URL state of /settings: `?tab=` plus the Email tab's outbox filters (`kind`, `status`, `page`, `email`). */
export function parseSettingsParams(params: SearchParamsRecord): SettingsParams {
  const tab = firstParam(params.tab);
  const kind = firstParam(params.kind);
  const status = firstParam(params.status);
  const outbox: SettingsParams["outbox"] = { page: positiveInt(firstParam(params.page)) ?? 1 };
  if (EMAIL_KINDS.includes(kind as EmailKind)) outbox.kind = kind as EmailKind;
  if (EMAIL_STATUSES.includes(status as EmailStatus)) outbox.status = status as EmailStatus;
  return {
    tab: SETTINGS_TABS.includes(tab as SettingsTab) ? (tab as SettingsTab) : "workspace",
    outbox,
    emailId: positiveInt(firstParam(params.email)),
  };
}
