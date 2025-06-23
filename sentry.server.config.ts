// File: sentry.server.config.ts
// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

// CORRECTED: Import the correct function name `getDefaultIntegrations`.
import {getDefaultIntegrations} from "@sentry/nextjs";

Sentry.init({
  dsn: "https://44824dfa7af5c4e29e6cdf047b024a40@o4509538486648832.ingest.us.sentry.io/4509538559524864",

  // Define how likely traces are sampled.
  tracesSampleRate: 1,

  // Setting this option to true will print useful information to the console.
  debug: false,

  // --- THE FIX ---
  // We are now calling the function `getDefaultIntegrations()` and providing
  // an explicit type for the 'integration' parameter in the filter callback.
  integrations: getDefaultIntegrations({
    // You can pass options to the default integrations here if needed
  }).filter(
    // By typing `integration`, we satisfy the 'noImplicitAny' rule.
    (integration: {name: string}) => integration.name !== "Redis"
  ),
});
