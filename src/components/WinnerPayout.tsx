"use client";

import { useActionState } from "react";
import { markPaidAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/Button";
import type { EditState } from "@/lib/adminEdit";
import styles from "./AdminDayList.module.css";

export type WinnerPayoutData = { cycle: number; email: string; verified: boolean; deadline: string; paidOn: string | null };

/**
 * A drawn cycle's winner (T125): email, whether it is verified (required before payout), the
 * payout deadline, and "Mark paid" until the prize is paid.
 */
export function WinnerPayout({ winner }: { winner: WinnerPayoutData }) {
  const [state, formAction, pending] = useActionState<EditState | null, FormData>(markPaidAction, null);
  return (
    <div>
      <p className={styles.locked}>
        {winner.email} · {winner.verified ? "Email verified" : "Email not verified: verify before paying"}
      </p>
      <p className={styles.locked}>{winner.paidOn ? `Paid on ${winner.paidOn}.` : `Pay by ${winner.deadline}.`}</p>
      {!winner.paidOn && (
        <form action={formAction} className={styles.save}>
          <input type="hidden" name="cycle" value={winner.cycle} />
          <Button type="submit" variant="secondary" loading={pending} aria-label={`Mark cycle ${winner.cycle} paid`}>
            Mark paid
          </Button>
        </form>
      )}
      {state && (
        <p role="status" className={state.ok ? styles.saved : styles.refused}>
          {state.message}
        </p>
      )}
    </div>
  );
}
