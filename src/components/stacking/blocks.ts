/** "1 block", "2 blocks": a block count in words. */
export function blocks(count: number): string {
  return `${count} ${count === 1 ? "block" : "blocks"}`;
}
