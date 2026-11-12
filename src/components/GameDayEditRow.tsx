"use client";

import { useActionState } from "react";
import { saveGameDayAction } from "@/app/admin/actions";
import { CHALLENGE_TYPES } from "@/challenges/shared/types";
import { TextInput } from "@/components/form/Field";
import formStyles from "@/components/form/form.module.css";
import { SubmitButton } from "@/components/form/FormParts";
import { CHALLENGE_NAMES } from "@/config/challenges";
import type { EditState } from "@/lib/adminEdit";
import styles from "./AdminDayList.module.css";

export type EditableDay = {
  gameDate: string;
  label: string;
  challengeType: string;
  challenge: string;
  passTarget: number;
  thresholdPercent: number;
  started: boolean;
};

/**
 * One open day in the admin table, with its values editable. The inputs sit in their own cells
 * and join the row's form through the `form` attribute, since a form cannot span cells. Once
 * somebody has started the day its challenge and pass target are locked (the database refuses a
 * change), so they are shown as text; the target is sent unchanged.
 */
export function GameDayEditRow({ day }: { day: EditableDay }) {
  const [state, formAction, pending] = useActionState<EditState | null, FormData>(saveGameDayAction, null);
  const formId = `edit-${day.gameDate}`;
  // The inputs are uncontrolled, so a save that changes the stored values (a new challenge takes
  // its default target) remounts them with the values the server now has.
  const savedValues = `${day.challengeType}:${day.passTarget}`;
  return (
    <tr>
      <th scope="row">{day.label}</th>
      <td>
        {day.started ? (
          day.challenge
        ) : (
          <select
            key={savedValues}
            form={formId}
            name="challengeType"
            className={formStyles.input}
            defaultValue={day.challengeType}
            aria-label={`Challenge for ${day.label}`}
          >
            {CHALLENGE_TYPES.map((type) => (
              <option key={type} value={type}>
                {CHALLENGE_NAMES[type]}
              </option>
            ))}
          </select>
        )}
      </td>
      <td>
        {day.started ? (
          <>
            {day.passTarget}
            <input type="hidden" form={formId} name="passTarget" value={day.passTarget} />
            <p className={styles.locked}>Locked: players have started this day.</p>
          </>
        ) : (
          <TextInput
            key={savedValues}
            form={formId}
            name="passTarget"
            type="number"
            inputMode="decimal"
            step="any"
            min={0}
            required
            defaultValue={day.passTarget}
            aria-label={`Pass target for ${day.label}`}
          />
        )}
      </td>
      <td>
        <TextInput
          form={formId}
          name="thresholdPercent"
          type="number"
          inputMode="decimal"
          step="any"
          min={0}
          max={100}
          required
          defaultValue={day.thresholdPercent}
          aria-label={`Survival threshold in percent for ${day.label}`}
        />
      </td>
      <td>
        <form id={formId} action={formAction} className={styles.save}>
          <input type="hidden" name="gameDate" value={day.gameDate} />
          <SubmitButton pending={pending} label="Save" />
          {state && (
            <p role="status" className={state.ok ? styles.saved : styles.refused}>
              {state.message}
            </p>
          )}
        </form>
      </td>
    </tr>
  );
}
