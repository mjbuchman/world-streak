"use client";

import { useActionState } from "react";
import { reviewFlagAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/Button";
import type { EditState } from "@/lib/adminEdit";
import styles from "./AdminDayList.module.css";

export type FlagRowData = { id: number; email: string; reason: string; flagged: string; day: string; score: string };

/** One open flag in the admin table, with Dismiss and Confirm (T124). */
export function FlagReviewRow({ flag }: { flag: FlagRowData }) {
  const [state, formAction, pending] = useActionState<EditState | null, FormData>(reviewFlagAction, null);
  return (
    <tr>
      <th scope="row">{flag.email}</th>
      <td>{flag.reason}</td>
      <td>{flag.flagged}</td>
      <td>{flag.day}</td>
      <td>{flag.score}</td>
      <td>
        <form action={formAction} className={styles.save}>
          <input type="hidden" name="flagId" value={flag.id} />
          <Button type="submit" name="decision" value="dismissed" variant="secondary" loading={pending} aria-label={`Dismiss ${flag.reason} for ${flag.email}`}>
            Dismiss
          </Button>
          <Button type="submit" name="decision" value="confirmed" loading={pending} aria-label={`Confirm ${flag.reason} for ${flag.email}`}>
            Confirm
          </Button>
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
