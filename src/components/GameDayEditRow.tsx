"use client";

import { useActionState } from "react";
import { saveGameDayAction } from "@/app/admin/actions";
import { TextInput } from "@/components/form/Field";
import { SubmitButton } from "@/components/form/FormParts";
import type { EditState } from "@/lib/adminEdit";
import styles from "./AdminDayList.module.css";

export type EditableDay = { gameDate: string; label: string; challenge: string; passTarget: number; thresholdPercent: number };

/**
 * One open day in the admin table, with its two values editable. The inputs sit in their own
 * cells and join the row's form through the `form` attribute, since a form cannot span cells.
 */
export function GameDayEditRow({ day }: { day: EditableDay }) {
  const [state, formAction, pending] = useActionState<EditState | null, FormData>(saveGameDayAction, null);
  const formId = `edit-${day.gameDate}`;
  return (
    <tr>
      <th scope="row">{day.label}</th>
      <td>{day.challenge}</td>
      <td>
        <TextInput
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
