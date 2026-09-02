/** Base error for both mail providers so callers can branch on status alone. */
export class MailApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "MailApiError";
    this.status = status;
  }
}
