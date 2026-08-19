/**
 * Mini-app cards on iMessage (M7.5). The signed URL is minted inside the
 * `app()` thunk so no live URL is ever stored (C15); cards render live and
 * are edited in place on update.
 */
import { env } from "../env";
import { createSpectrumSender } from "../spectrum/sender";
import { mintToken } from "./tokens";

export function mintSignedLink(
  userId: string,
  appSlug: string,
  resourceId: string
): string {
  // Apps live at mini.wzrd.tech/<slug> (MA0); legacy /mini/<slug> 301s there.
  return `${env.miniappOrigin()}/${appSlug}?t=${mintToken(userId, appSlug, resourceId)}`;
}

export async function sendMiniAppCard(
  spaceId: string,
  phone: string,
  userId: string,
  appSlug: string,
  resourceId: string
): Promise<void> {
  const sender = await createSpectrumSender();
  try {
    await sender.sendApp(spaceId, phone, () =>
      mintSignedLink(userId, appSlug, resourceId)
    );
  } finally {
    // Best-effort: a teardown failure after a successful send must not
    // surface as a delivery failure (callers may retry on error).
    await sender.close().catch(() => undefined);
  }
}
