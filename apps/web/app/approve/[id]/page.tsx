/**
 * Hosted approval page (app.wzrd.tech/approve/<decision>) — the Link-style
 * payment approval sheet the agent deep-links to the owner via iMessage.
 * The server renders only a shell; the client component authenticates with
 * the signed `k` token (or the owner's session cookie) against
 * /api/approvals/<id>, which returns the value-free view and resolves
 * through the same rails as the Needs-you queue.
 */
import type { Metadata } from "next";
import { ApproveClient } from "./approve-client";

export const metadata: Metadata = {
  title: "Approve payment — air",
  description: "Review and approve your agent's payment request.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ApprovePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ApproveClient decisionId={id} />;
}
