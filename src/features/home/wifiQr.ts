import type { WifiData } from "./wifi";

function escape(s: string): string {
  return s.replace(/([\\;,":])/g, "\\$1");
}

export function wifiQrPayload(d: WifiData): string {
  if (d.security === "nopass") {
    return `WIFI:T:nopass;S:${escape(d.ssid)};H:${d.hidden ? "true" : "false"};;`;
  }
  return `WIFI:T:${d.security};S:${escape(d.ssid)};P:${escape(d.password)};H:${d.hidden ? "true" : "false"};;`;
}
