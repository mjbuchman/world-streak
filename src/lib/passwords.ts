// Shared by the sign-up form (checked before sending) and the server (checked again). Kept in
// its own module so the browser bundle does not pull in the server-side sign-up logic.
export const PASSWORD_MISMATCH = "The passwords don't match.";

/** Must equal `minimum_password_length` in supabase/config.toml (a test checks it). */
export const MIN_PASSWORD_LENGTH = 8;
/** Supabase hashes with bcrypt, which reads at most 72 characters. */
export const MAX_PASSWORD_LENGTH = 72;
