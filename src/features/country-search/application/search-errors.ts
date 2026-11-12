export class ValidationError extends Error {
  public constructor(
    message: string = 'The country service returned an invalid response.',
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}
