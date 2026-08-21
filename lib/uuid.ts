import { randomUUID } from "crypto";

function fallbackId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function generateUuid(): string {
  try {
    return randomUUID() ?? fallbackId();
  } catch {
    return fallbackId();
  }
}
