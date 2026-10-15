import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/server/auth";

/** Better Auth endpoints: /api/auth/sign-in/email, /sign-up/email, /sign-out, /get-session, ... */
export const { GET, POST } = toNextJsHandler(auth);
