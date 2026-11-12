"use client";

import { useActionState } from "react";
import { localToolAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/Button";
import formStyles from "@/components/form/form.module.css";
import type { ToolState } from "@/lib/localTools";
import styles from "./LocalTools.module.css";

export type ToolDay = { gameDate: string; label: string };
export type ToolChallenge = { type: string; name: string };

/** A select of the admin page's days, labelled for the tool it belongs to. */
function DaySelect({ id, days }: { id: string; days: ToolDay[] }) {
  return (
    <div className={formStyles.field}>
      <label htmlFor={id} className={formStyles.label}>
        Day
      </label>
      <select id={id} name="gameDate" className={formStyles.input} defaultValue={days[0]?.gameDate}>
        {days.map((day) => (
          <option key={day.gameDate} value={day.gameDate}>
            {day.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * The play-testing shortcuts on /admin (T116), shown only with the local Supabase. Every tool is
 * its own small form posting to one action; the latest reply shows under them.
 */
export function LocalTools({ days, challenges }: { days: ToolDay[]; challenges: ToolChallenge[] }) {
  const [state, formAction, pending] = useActionState<ToolState | null, FormData>(localToolAction, null);
  return (
    <div className={styles.tools}>
      <p className={styles.note}>For play-testing on this computer only. They never run against a real project.</p>

      <form action={formAction} className={styles.tool} aria-label="Set a day's challenge">
        <input type="hidden" name="tool" value="set-challenge" />
        <DaySelect id="challenge-day" days={days} />
        <div className={formStyles.field}>
          <label htmlFor="challenge-type" className={formStyles.label}>
            Challenge
          </label>
          <select id="challenge-type" name="challenge" className={formStyles.input} defaultValue={challenges[0]?.type}>
            {challenges.map((challenge) => (
              <option key={challenge.type} value={challenge.type}>
                {challenge.name}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="secondary" loading={pending}>
          Set challenge
        </Button>
      </form>

      <form action={formAction} className={styles.tool} aria-label="Clear my attempt today">
        <input type="hidden" name="tool" value="clear-my-attempt" />
        <p className={styles.what}>Delete your own attempt today, so you can play again.</p>
        <Button type="submit" variant="secondary" loading={pending}>
          Clear my attempt today
        </Button>
      </form>

      <form action={formAction} className={styles.tool} aria-label="Reset a day">
        <input type="hidden" name="tool" value="reset-day" />
        <DaySelect id="reset-day" days={days} />
        <p className={styles.what}>Delete everyone&apos;s attempts that day and put it back on the rotation.</p>
        <Button type="submit" variant="secondary" loading={pending}>
          Reset day
        </Button>
      </form>

      <form action={formAction} className={styles.tool} aria-label="Restore the rotation">
        <input type="hidden" name="tool" value="restore-rotation" />
        <p className={styles.what}>Put the daily rotation back to every challenge in turn (the end-to-end tests pin it while they run).</p>
        <Button type="submit" variant="secondary" loading={pending}>
          Restore the rotation
        </Button>
      </form>

      {state && (
        <p role="status" className={state.ok ? styles.done : styles.refused}>
          {state.message}
        </p>
      )}
    </div>
  );
}
