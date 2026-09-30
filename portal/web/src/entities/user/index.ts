/**
 * Public API of the `user` entity — the signed-in caller as the BFF reports
 * them: the user-context query and the helpers that present it. Signing out is
 * an action on the user, so it is a feature (`logout`), not this slice's.
 */
export type { UserContext } from "@/shared/api";
export { userKeys, userQueries } from "./api/userQueries";
export { initialsOf } from "./lib/initialsOf";
