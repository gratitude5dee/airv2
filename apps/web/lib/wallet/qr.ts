/**
 * Server-generated receive QR (goal.md M15 task 4): a data-URL SVG shipped in
 * the /api/wallet response so no client-side QR library is needed.
 */
import QRCode from "qrcode";

export async function addressQrDataUrl(address: string): Promise<string | null> {
  try {
    const svg = await QRCode.toString(address, {
      type: "svg",
      margin: 1,
      errorCorrectionLevel: "M",
    });
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  } catch {
    return null;
  }
}
