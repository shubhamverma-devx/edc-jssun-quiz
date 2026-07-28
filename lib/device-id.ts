const STORAGE_KEY = "edc-quiz-device-id";

/**
 * Client-only. Returns a stable per-device UUID so a fresher who loses
 * network can rejoin the same participant row instead of creating a
 * duplicate (participants has a unique constraint on session_id + device_id).
 */
export function getOrCreateDeviceId(): string {
  let deviceId = localStorage.getItem(STORAGE_KEY);
  if (!deviceId) {
    deviceId = generateUuid();
    localStorage.setItem(STORAGE_KEY, deviceId);
  }
  return deviceId;
}

// crypto.randomUUID only exists in secure contexts (https / localhost).
// During LAN-IP testing on real phones the page is http, so fall back to
// building a v4 UUID from getRandomValues, which works everywhere.
function generateUuid(): string {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex
    .slice(6, 8)
    .join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}
