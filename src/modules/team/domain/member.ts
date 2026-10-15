import type { AvatarColor } from "@/shared/domain/avatar-colors";

export interface Member {
  id: number;
  name: string;
  email: string;
  /** Job title shown in the shell. */
  role: string;
  /** Login linked to this person, or null for teammates tracked without an account. */
  userId: string | null;
  /** Avatar colour picked in Settings > Profile (null: derived from the name). */
  avatarColor?: AvatarColor | null;
}

export const MEMBER_NAME_MAX_LENGTH = 80;
export const JOB_TITLE_MAX_LENGTH = 60;
