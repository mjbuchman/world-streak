"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Surface } from "@/components/ui/Surface";

/**
 * /play when its server lookups fail (the database is unreachable, for example): a calm message
 * and a way to try again, instead of the framework's error screen (T69).
 */
export default function PlayError({ reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function reload() {
    // Fetch the page's server data again, then re-render this segment with it.
    startTransition(() => {
      router.refresh();
      reset();
    });
  }

  return (
    <Surface>
      <p role="alert">Today&apos;s challenge could not be loaded. Your attempt is safe. Please try again.</p>
      <Button loading={pending} onClick={reload}>
        Reload
      </Button>
    </Surface>
  );
}
