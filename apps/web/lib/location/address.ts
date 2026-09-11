/**
 * DM participant address from the iMessage chat guid — verbatim port of
 * mayor-coast's participantAddressFromDmChatGuid. The Spectrum iMessage
 * space id IS the chat guid (`iMessage;-;<handle>`); groups and shared-line
 * shapes throw, so callers treat a throw as "no Find My lane here".
 */
export class LocationAddressError extends Error {
  constructor(code: "LOCATION_REQUIRES_DIRECT_MESSAGE" | "LOCATION_PARTICIPANT_UNAVAILABLE") {
    super(code);
    this.name = "LocationAddressError";
  }
}

export function participantAddressFromDmChatGuid(chatGuid: string): string {
  const parts = chatGuid.split(";");
  if (parts.length < 3 || parts.at(-2) !== "-") {
    throw new LocationAddressError("LOCATION_REQUIRES_DIRECT_MESSAGE");
  }
  const address = parts.at(-1)?.trim() ?? "";
  const isPhone = /^\+[1-9]\d{6,14}$/.test(address);
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address);
  if (!isPhone && !isEmail) {
    throw new LocationAddressError("LOCATION_PARTICIPANT_UNAVAILABLE");
  }
  return address;
}
