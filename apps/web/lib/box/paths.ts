/**
 * The Box-local paths the control plane will read on an owner's behalf:
 * under /home/user only, a conservative character set, no traversal. The
 * Box is the untrusted side (C16), so the check runs before any command.
 */
export const BOX_PATH_RE = /^\/home\/user\/[A-Za-z0-9._/ -]{1,512}$/;

export function isBoxPath(path: string): boolean {
  return BOX_PATH_RE.test(path) && !path.includes("..");
}
