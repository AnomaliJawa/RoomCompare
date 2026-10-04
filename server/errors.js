/** A refusal the app can show: `message` for a banner, `errors` mapping fields to what to fix. */
export class ApiError extends Error {
  constructor(status, message, errors = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }
}

/** The email already has an account. */
export class Conflict extends Error {}
