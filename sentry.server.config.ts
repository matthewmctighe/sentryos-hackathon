import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Set tracesSampleRate to 1.0 to capture 100% of transactions for tracing.
  // Adjust this value in production as necessary.
  tracesSampleRate: 1.0,

  // Enable structured logging
  enableLogs: true,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Enable distributed tracing for external API calls
  tracePropagationTargets: ["localhost", "https://api.gong.io"],
});
