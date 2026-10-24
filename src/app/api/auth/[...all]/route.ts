import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

// Email verification links, password-reset links and the Better Auth HTTP API.
export const { GET, POST } = toNextJsHandler(auth);
