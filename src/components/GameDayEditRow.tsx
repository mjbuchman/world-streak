"use client";

import { useActionState } from "react";
import { saveGameDayAction } from "@/app/admin/actions";
import { CHALLENGE_TYPES, type ChallengeType } from "@/challenges/shared/types";
import { TextInput } from "@/components/form/Field";
import formStyles from "@/components/form/form.module.css";
import { SubmitButton } from "@/components/form/FormParts";
import { CHALLENGE_NAMES } from "@/config/challenges";
import type { AdminGame } from "@/lib/admin";
import type { EditState } from "@/lib/adminEdit";
import styles from "./AdminDayList.module.css";

export type EditableDay = {
  gameDate: string;
  label: string;
  games: AdminGame[];
  thresholdPercent: number;
  started: boolean;
};

/**
 * One open day in the admin table, with its lineup and values editable. The inputs sit in their
 * own cells and join the row's form through the `form` attribute, since a form cannot span cells.
 * Once somebody has started the day its games are locked, and once a game has an attempt its
 * pass target is too (the database refuses a change), so they are shown as text and sent unchanged.
 */
export function GameDayEditRow({ day }: { day: EditableDay }) {
  const [state, formAction, pending] = useActionState<EditState | null, FormData>(saveGameDayAction, null);
  const formId = `edit-${day.gameDate}`;
  // The inputs are uncontrolled, so a save that changes the stored values (a new game takes its
  // default target) remounts them with the values the server now has.
  const savedValues = day.games.map((game) => `${game.challengeType}:${game.passTarget}`).join("|");
  return (
    <tr>
      <th scope="row">{day.label}</th>
      <td>
        <ol className={styles.games}>
          {day.games.map((game) => (
            <li key={`${game.position}:${savedValues}`} className={styles.game}>
              <GamePicker formId={formId} label={day.label} game={game} locked={day.started} />
              <TargetInput formId={formId} label={day.label} game={game} />
            </li>
          ))}
        </ol>
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

type GameProps = { formId: string; label: string; game: AdminGame };

function GamePicker({ formId, label, game, locked }: GameProps & { locked: boolean }) {
  const name = `game${game.position}`;
  if (locked) {
    return (
      <>
        {CHALLENGE_NAMES[game.challengeType]}
        <input type="hidden" form={formId} name={name} value={game.challengeType} />
      </>
    );
  }
  return (
    <select
      form={formId}
      name={name}
      className={formStyles.input}
      defaultValue={game.challengeType}
      aria-label={`Game ${game.position} for ${label}`}
    >
      {CHALLENGE_TYPES.map((type: ChallengeType) => (
        <option key={type} value={type}>
          {CHALLENGE_NAMES[type]}
        </option>
      ))}
    </select>
  );
}

function TargetInput({ formId, label, game }: GameProps) {
  const name = `target${game.position}`;
  if (game.started) {
    return (
      <>
        <span>Target {game.passTarget}</span>
        <input type="hidden" form={formId} name={name} value={game.passTarget} />
        <span className={styles.locked}>Locked: players have started this game.</span>
      </>
    );
  }
  return (
    <TextInput
      form={formId}
      name={name}
      type="number"
      inputMode="decimal"
      step="any"
      min={0}
      required
      defaultValue={game.passTarget}
      aria-label={`Pass target for game ${game.position} on ${label}`}
    />
  );
}
