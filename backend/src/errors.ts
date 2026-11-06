/*
 * BillKit — Every bill, in your pocket.
 * © 2026 Shaik Gouse Kareem. All rights reserved.
 */

/** An error whose message is safe to return to the client. */
export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what = 'Resource') => new HttpError(404, 'not_found', `${what} not found.`);
export const unauthorized = () => new HttpError(401, 'unauthorized', 'Please sign in to continue.');
export const forbidden = () => new HttpError(403, 'forbidden', 'You do not have permission to do that.');
