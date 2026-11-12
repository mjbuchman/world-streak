"use client";

import { useActionState } from "react";
import { drawCycleAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/Button";
import type { EditState } from "@/lib/adminEdit";
import styles from "./AdminDayList.module.css";

/** Draws a cycle's winner (T43). Disabled, with the reason, until the cycle may be drawn. */
export function DrawButton({ cycle, ready, reason }: { cycle: number; ready: boolean; reason: string }) {
  const [state, formAction, pending] = useActionState<EditState | null, FormData>(drawCycleAction, null);
  return (
    <form action={formAction} className={styles.save}>
      <input type="hidden" name="cycle" value={cycle} />
      <Button type="submit" loading={pending} disabled={!ready} aria-label={`Draw cycle ${cycle}`}>
        Draw
      </Button>
      {!ready && <p className={styles.locked}>{reason}</p>}
      {state && (
        <p role="status" className={state.ok ? styles.saved : styles.refused}>
          {state.message}
        </p>
      )}
    </form>
  );
}
