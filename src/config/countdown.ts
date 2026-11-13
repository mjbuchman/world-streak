/** The 3-2-1 before every run (T119, T138): each number shows this long... */
export const COUNTDOWN_STEP_MS = 800;
export const COUNTDOWN_FROM = 3;
/** ...so the whole countdown, before a run's own clock starts, lasts this long. */
export const RUN_COUNTDOWN_MS = COUNTDOWN_FROM * COUNTDOWN_STEP_MS;
