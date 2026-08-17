"use client";

/**
 * Optional fund widget (goal.md M15, C21): rendered only when the publishable
 * NEXT_PUBLIC_THIRDWEB_CLIENT_ID is configured. The widget talks to thirdweb's
 * public endpoints with the client ID only — no secret, no send/sign surface.
 * Loaded via next/dynamic so the main route doesn't pay for thirdweb/react
 * unless the user opens Fund.
 */
import { useMemo } from "react";
import { createThirdwebClient, defineChain } from "thirdweb";
import { BuyWidget, ThirdwebProvider } from "thirdweb/react";

export default function FundWidget({
  clientId,
  chainId,
  address,
}: {
  clientId: string;
  chainId: number;
  address: string;
}) {
  const client = useMemo(
    () => createThirdwebClient({ clientId }),
    [clientId]
  );
  return (
    <ThirdwebProvider>
      <BuyWidget
        client={client}
        chain={defineChain(chainId)}
        receiverAddress={address as `0x${string}`}
        title="Fund your wallet"
        paymentMethods={["card", "crypto"]}
      />
    </ThirdwebProvider>
  );
}
