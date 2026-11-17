"use client";

import { useActionState } from "react";
import { localToolAction } from "@/app/admin/actions";
import { TextInput } from "@/components/form/Field";
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
type LocalToolsProps = {
  days: ToolDay[];
  challenges: ToolChallenge[];
  /** The day before today, the usual one to close. */
  yesterday: string;
  maxPlayers: number;
};

export function LocalTools({ days, challenges, yesterday, maxPlayers }: LocalToolsProps) {
  const [state, formAction, pending] = useActionState<ToolState | null, FormData>(localToolAction, null);
  return (
    <div className={styles.tools}>
      <p className={styles.note}>For play-testing on this computer only. They never run against a real project.</p>

      <form action={formAction} className={styles.tool} aria-label="Set a day's lineup">
        <input type="hidden" name="tool" value="set-lineup" />
        <DaySelect id="lineup-day" days={days} />
        {[1, 2, 3].map((position) => (
          <div key={position} className={formStyles.field}>
            <label htmlFor={`lineup-game${position}`} className={formStyles.label}>
              Game {position}
            </label>
            <select
              id={`lineup-game${position}`}
              name={`game${position}`}
              className={formStyles.input}
              defaultValue={challenges[position - 1]?.type}
            >
              {challenges.map((challenge) => (
                <option key={challenge.type} value={challenge.type}>
                  {challenge.name}
                </option>
              ))}
            </select>
          </div>
        ))}
        <p className={styles.what}>Each game gets its usual pass target. Only for a day nobody has started.</p>
        <Button type="submit" variant="secondary" loading={pending}>
          Set lineup
        </Button>
      </form>

      <form action={formAction} className={styles.tool} aria-label="Clear my day">
        <input type="hidden" name="tool" value="clear-my-day" />
        <p className={styles.what}>Delete your own games and result today, so you can play the day again.</p>
        <Button type="submit" variant="secondary" loading={pending}>
          Clear my day
        </Button>
      </form>

      <form action={formAction} className={styles.tool} aria-label="Reset a day">
        <input type="hidden" name="tool" value="reset-day" />
        <DaySelect id="reset-day" days={days} />
        <p className={styles.what}>Delete everyone&apos;s attempts that day and put it back on the lineup rule.</p>
        <Button type="submit" variant="secondary" loading={pending}>
          Reset day
        </Button>
      </form>

      <form action={formAction} className={styles.tool} aria-label="Restore the pool">
        <input type="hidden" name="tool" value="restore-pool" />
        <p className={styles.what}>Put the daily pool back to every game.</p>
        <Button type="submit" variant="secondary" loading={pending}>
          Restore the pool
        </Button>
      </form>

      <form action={formAction} className={styles.tool} aria-label="Seed fake players">
        <input type="hidden" name="tool" value="seed" />
        <DaySelect id="seed-day" days={days} />
        <div className={formStyles.field}>
          <label htmlFor="seed-players" className={formStyles.label}>
            Players
          </label>
          <TextInput id="seed-players" name="players" type="number" inputMode="numeric" min={1} max={maxPlayers} step={1} defaultValue={50} required />
        </div>
        <div className={formStyles.field}>
          <label htmlFor="seed-pass" className={formStyles.label}>
            Passing (%)
          </label>
          <TextInput id="seed-pass" name="passPercent" type="number" inputMode="decimal" min={0} max={100} step="any" defaultValue={70} required />
        </div>
        <p className={styles.what}>Fake accounts with finished attempts, so the meter moves. A large batch takes a minute.</p>
        <Button type="submit" variant="secondary" loading={pending}>
          Seed players
        </Button>
      </form>

      <form action={formAction} className={styles.tool} aria-label="Close a day">
        <input type="hidden" name="tool" value="close-day" />
        <div className={formStyles.field}>
          <label htmlFor="close-day" className={formStyles.label}>
            Day
          </label>
          <TextInput id="close-day" name="gameDate" type="date" defaultValue={yesterday} required />
        </div>
        <p className={styles.what}>Close a day past its deadline now, as the nightly job would, and see the streak.</p>
        <Button type="submit" variant="secondary" loading={pending}>
          Close day
        </Button>
      </form>

      <form action={formAction} className={styles.tool} aria-label="Remove fake players">
        <input type="hidden" name="tool" value="remove-fake-players" />
        <p className={styles.what}>Delete every seeded player and their attempts; open days are recounted.</p>
        <Button type="submit" variant="secondary" loading={pending}>
          Remove fake players
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
