import Script from "next/script";
import { adsSettings } from "@/config/ads";
import styles from "./AdSlot.module.css";

/**
 * One ad slot (T44), outside the challenge only: never on practice pages or during a run. It
 * keeps a fixed height whatever it shows, so nothing shifts when an ad loads. Renders nothing
 * while ads are off.
 */
export function AdSlot({ name }: { name: string }) {
  const { live, client, placeholder } = adsSettings();
  if (live && client) {
    return (
      <div className={styles.slot} data-ad-slot={name}>
        <ins className="adsbygoogle" style={{ display: "block", height: "100%" }} data-ad-client={client} data-ad-format="auto" />
        <Script id={`ad-${name}`}>{"(window.adsbygoogle = window.adsbygoogle || []).push({});"}</Script>
      </div>
    );
  }
  if (placeholder) {
    return (
      <div className={`${styles.slot} ${styles.placeholder}`} data-ad-slot={name} data-ad-placeholder="">
        Ad placeholder
      </div>
    );
  }
  return null;
}

/** The AdSense script, once per page, only while ads are live. */
export function AdSenseScript() {
  const { live, client } = adsSettings();
  if (!live || !client) return null;
  return (
    <Script
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`}
      async
      crossOrigin="anonymous"
      strategy="afterInteractive"
    />
  );
}
