"use client";
import { useEffect } from "react";
import { captureAttribution } from "@/lib/site/attribution";

/** Remembers where the visitor came from (first touch) for the signup funnel. Renders nothing. */
export function AttributionCapture() {
  useEffect(() => captureAttribution(), []);
  return null;
}
