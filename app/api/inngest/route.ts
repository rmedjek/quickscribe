/* eslint-disable @typescript-eslint/no-explicit-any */
// File: app/api/inngest/route.ts

import {serve} from "inngest/next";
// We will create this file in the next step.
// import { inngest, aFunction, anotherFunction } from '@/app/inngest';

// For now, let's create a placeholder `inngest` object.
import {Inngest} from "inngest";
export const inngest = new Inngest({id: "quickscribe"});

// We will add our functions to this array later.
const functions: any[] = [];

// The `serve` function exposes our Inngest functions as a Next.js API route.
export const {GET, POST, PUT} = serve({
  client: inngest,
  functions,
});
