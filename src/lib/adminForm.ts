// Shared pieces of the admin forms (T132): the result state, number fields and the Tower's range.
import { z } from "zod";

/** What an admin form's save returns: shown under the form. */
export type EditState = { ok: boolean; message: string };

export const refuse = (message: string): EditState => ({ ok: false, message });

/** A trimmed, required number field, with messages naming the field. */
export const numberField = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .transform(Number)
    .pipe(z.number({ message: `${label} must be a number.` }).finite(`${label} must be a number.`));

/** The Tower's board has 15 rows: a target outside 1-15 would be drawn off the grid (T77). */
export const STACKING_TARGET_RANGE = { min: 1, max: 15 } as const;

export const inTowerRange = (target: number) => target >= STACKING_TARGET_RANGE.min && target <= STACKING_TARGET_RANGE.max;

export const towerRowMessage = (label: string) =>
  `${label} must be a row from ${STACKING_TARGET_RANGE.min} to ${STACKING_TARGET_RANGE.max}.`;
