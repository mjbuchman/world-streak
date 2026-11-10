import type { ScoreDirection } from "@/challenges/shared/types";

/** Whether a score meets the day's target: at least it when higher is better, at most it otherwise. */
export function passes(score: number, target: number, direction: ScoreDirection): boolean {
  return direction === "higher-better" ? score >= target : score <= target;
}
