export function generateUuid(): string {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}
