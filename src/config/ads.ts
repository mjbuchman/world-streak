/**
 * Ads (T44). The design wants AdSense from launch but no ads on Vercel Hobby during the soft
 * launch (non-commercial only), so ads stay off unless both values are set (T45 wires the real
 * publisher ID). Read on the server, at request time.
 */
export type AdsSettings = {
  /** Real AdSense units and script. */
  live: boolean;
  client: string | null;
  /** Grey boxes where the ads will go, for layout work; never in production. */
  placeholder: boolean;
};

export function adsSettings(): AdsSettings {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT || null;
  const live = process.env.NEXT_PUBLIC_ADS_ENABLED === "true" && client !== null;
  const placeholder = !live && process.env.NEXT_PUBLIC_ADS_PLACEHOLDER === "true" && process.env.NODE_ENV !== "production";
  return { live, client: live ? client : null, placeholder };
}
