export class HttpError extends Error {
  public readonly statusCode: number;

  public constructor(statusCode: number) {
    super(`The country service returned HTTP ${statusCode}.`);
    this.name = HttpError.name;
    this.statusCode = statusCode;
  }
}

export class ValidationError extends Error {
  public constructor(
    message: string = 'The country service returned an invalid response.',
  ) {
    super(message);
    this.name = ValidationError.name;
  }
}
