// app/inngest/client.ts

import {Inngest, EventSchemas} from "inngest";
import type {AppEvents} from "./types";

const schemas = new EventSchemas().fromRecord<AppEvents>();

export const inngest = new Inngest({
  id: "quickscribe",
  schemas,
});
