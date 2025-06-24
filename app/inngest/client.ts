// File: app/inngest/client.ts

import {Inngest, EventSchemas} from "inngest";
import type {AppEvents} from "./types"; // Import our event type map

// Create a schema instance from our event type map.
// This is the standard way to provide strong types to the client.
const schemas = new EventSchemas().fromRecord<AppEvents>();

// Pass the schemas into the constructor.
// The client is now fully typed.
export const inngest = new Inngest({
  id: "quickscribe",
  schemas,
});
