// Choices for the "country of residence" field at sign-up. Only ALLOWED_COUNTRIES are
// eligible; the others exist so people outside the US can answer honestly and see why
// they can't join. "ZZ" is the ISO 3166 code reserved for an unknown country.
export const COUNTRY_OPTIONS: readonly { code: string; name: string }[] = [
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "MX", name: "Mexico" },
  { code: "GB", name: "United Kingdom" },
  { code: "ZZ", name: "Another country" },
];
