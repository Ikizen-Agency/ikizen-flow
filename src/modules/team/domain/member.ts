export interface Member {
  id: number;
  name: string;
  email: string;
  /** Job title shown in the shell. */
  role: string;
  /** Login linked to this person, or null for teammates tracked without an account. */
  userId: string | null;
}
