/**
 * Who runs the prize draw, for the official rules. Placeholders until the human provides the
 * sponsor's details (backlog T39); the rules page shows a "Draft" banner while any remains.
 */
export const SPONSOR = {
  name: "[Sponsor name]",
  address: "[Sponsor mailing address]",
  email: "[Sponsor contact email]",
} as const;

export type Sponsor = { name: string; address: string; email: string };
