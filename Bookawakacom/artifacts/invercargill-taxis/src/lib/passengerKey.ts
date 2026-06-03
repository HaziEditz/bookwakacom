/** Stable passenger key for wallet, my-rides, and cancel APIs (set during booking). */
export function getPassengerKey(): string | null {
  try {
    return localStorage.getItem("bw_passenger_key");
  } catch {
    return null;
  }
}

export function getOrCreatePassengerKey(): string {
  const existing = getPassengerKey();
  if (existing) return existing;
  const key = `web_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  try {
    localStorage.setItem("bw_passenger_key", key);
  } catch {
    // non-fatal
  }
  return key;
}
