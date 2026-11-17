/** Constant-time bearer check; a missing configured token rejects everyone. */
export async function bearerMatches(header: string | null, expected: string | undefined): Promise<boolean> {
  if (!expected || !header?.startsWith("Bearer ")) return false;
  const encoder = new TextEncoder();
  const [given, wanted] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(header.slice(7))),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const a = new Uint8Array(given);
  const b = new Uint8Array(wanted);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

export function instanceName(count: string | undefined, random: () => number = Math.random): string {
  const n = Math.max(1, Math.min(16, Number.parseInt(count ?? "1", 10) || 1));
  return `media-${Math.floor(random() * n)}`;
}
