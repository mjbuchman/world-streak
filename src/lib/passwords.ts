// Shared by the sign-up form (checked before sending) and the server (checked again). Kept in
// its own module so the browser bundle does not pull in the server-side sign-up logic.
export const PASSWORD_MISMATCH = "The passwords don't match.";
