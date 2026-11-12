export class HttpError extends Error {
  public readonly status: number;

  public constructor(status: number) {
    super(`Country API request failed with HTTP status ${status}.`);

    this.status = status;
    this.name = 'HttpError';
  }
}

// TODO: Add other countries.dev endpoints here when the feature needs them.
export const countriesDevelopmentApi: {
  searchByName: (query: string, signal: AbortSignal) => Promise<unknown[]>;
} = {
  async searchByName(query: string, signal: AbortSignal): Promise<unknown[]> {
    const encodedQuery: string = encodeURIComponent(query);
    const response: Response = await fetch(
      `https://countries.dev/name/${encodedQuery}`,
      { signal },
    );

    if (response.status === 404) {
      return [];
    }

    if (!response.ok) {
      throw new HttpError(response.status);
    }

    const responseBody: unknown = await response.json();

    return Array.isArray(responseBody)
      ? responseBody.map((item: unknown): unknown => item)
      : [];
  },
};
