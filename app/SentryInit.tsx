"use client";

import Script from "next/script";

const SENTRY_DSN =
  process.env.NEXT_PUBLIC_SENTRY_DSN ||
  "https://ed92f2ac22f9c183c42c9e6a2c739f27@o4511550230233088.ingest.de.sentry.io/4511550253432912";

export default function SentryInit() {
  if (!SENTRY_DSN) return null;

  return (
    <Script
      src="https://browser.sentry-cdn.com/8.55.0/bundle.tracing.replay.min.js"
      strategy="afterInteractive"
      crossOrigin="anonymous"
      onLoad={() => {
        const win = window as typeof window & {
          Sentry?: any;
          __wereadSentryInited?: boolean;
        };

        if (!win.Sentry || win.__wereadSentryInited) return;
        win.__wereadSentryInited = true;

        win.Sentry.init({
          dsn: SENTRY_DSN,
          environment: window.location.hostname.includes("github.io") ? "production" : "local",
          tracesSampleRate: 0.1,
          replaysSessionSampleRate: 0,
          replaysOnErrorSampleRate: 0.1,
          beforeSend(event: any) {
            const text = JSON.stringify(event);
            if (text.includes("wrk-")) return null;
            return event;
          }
        });
      }}
    />
  );
}