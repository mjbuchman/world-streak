import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { adsSettings } from "@/config/ads";
import { AdSenseScript, AdSlot } from "./AdSlot";

afterEach(() => {
  vi.unstubAllEnvs();
});

const env = (values: Record<string, string>) => {
  for (const name of ["NEXT_PUBLIC_ADS_ENABLED", "NEXT_PUBLIC_ADSENSE_CLIENT", "NEXT_PUBLIC_ADS_PLACEHOLDER"]) vi.stubEnv(name, values[name] ?? "");
};
const html = (node: React.ReactNode) => renderToStaticMarkup(<>{node}</>);

describe("adsSettings", () => {
  it("is off by default, and on only with the flag and a client id", () => {
    env({});
    expect(adsSettings()).toEqual({ live: false, client: null, placeholder: false });
    env({ NEXT_PUBLIC_ADS_ENABLED: "true" });
    expect(adsSettings().live).toBe(false);
    env({ NEXT_PUBLIC_ADSENSE_CLIENT: "ca-pub-123" });
    expect(adsSettings().live).toBe(false);
    env({ NEXT_PUBLIC_ADS_ENABLED: "true", NEXT_PUBLIC_ADSENSE_CLIENT: "ca-pub-123" });
    expect(adsSettings()).toEqual({ live: true, client: "ca-pub-123", placeholder: false });
  });

  it("shows placeholders only outside production", () => {
    env({ NEXT_PUBLIC_ADS_PLACEHOLDER: "true" });
    vi.stubEnv("NODE_ENV", "development");
    expect(adsSettings().placeholder).toBe(true);
    vi.stubEnv("NODE_ENV", "production");
    expect(adsSettings().placeholder).toBe(false);
  });
});

describe("AdSlot", () => {
  it("renders nothing while ads are off", () => {
    env({});
    expect(html(<AdSlot name="home" />)).toBe("");
  });

  it("renders a labelled grey box of fixed size as a development placeholder", () => {
    env({ NEXT_PUBLIC_ADS_PLACEHOLDER: "true" });
    vi.stubEnv("NODE_ENV", "development");
    const markup = html(<AdSlot name="home" />);
    expect(markup).toContain('data-ad-slot="home"');
    expect(markup).toContain("Ad placeholder");
    expect(markup).toContain('data-ad-placeholder=""');
  });

  it("renders an AdSense unit for the client when ads are live", () => {
    env({ NEXT_PUBLIC_ADS_ENABLED: "true", NEXT_PUBLIC_ADSENSE_CLIENT: "ca-pub-123" });
    const markup = html(<AdSlot name="history" />);
    expect(markup).toContain('data-ad-slot="history"');
    expect(markup).toContain('class="adsbygoogle"');
    expect(markup).toContain('data-ad-client="ca-pub-123"');
    expect(markup).not.toContain("Ad placeholder");
  });

  it("shows the real unit, not the placeholder, when both are set", () => {
    env({ NEXT_PUBLIC_ADS_ENABLED: "true", NEXT_PUBLIC_ADSENSE_CLIENT: "ca-pub-123", NEXT_PUBLIC_ADS_PLACEHOLDER: "true" });
    vi.stubEnv("NODE_ENV", "development");
    const markup = html(<AdSlot name="home" />);
    expect(markup).toContain('class="adsbygoogle"');
    expect(markup).not.toContain("Ad placeholder");
  });
});

describe("AdSenseScript", () => {
  it("loads nothing while ads are off, even with a placeholder", () => {
    env({ NEXT_PUBLIC_ADS_PLACEHOLDER: "true", NEXT_PUBLIC_ADSENSE_CLIENT: "ca-pub-123" });
    expect(AdSenseScript()).toBeNull();
  });

  it("loads the AdSense script for the client when ads are live", () => {
    env({ NEXT_PUBLIC_ADS_ENABLED: "true", NEXT_PUBLIC_ADSENSE_CLIENT: "ca-pub-123" });
    const script = AdSenseScript();
    expect(script?.props).toMatchObject({
      src: "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-123",
      async: true,
      crossOrigin: "anonymous",
    });
  });
});
