/** Extract a bare address from "Name <a@b.c>" or "a@b.c". */
export function parseAddress(value: string): string {
  const match = /<([^>]+)>/.exec(value);
  return (match?.[1] ?? value).trim().toLowerCase();
}
