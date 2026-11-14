import { ValidationError } from '../../application/search-errors';
import type { Country, Currency } from '../../domain/country.type';

function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return isObject(value) && !Array.isArray(value);
}

function getOptionalText(rawText: unknown): string | null {
  return typeof rawText === 'string' && rawText.trim().length > 0
    ? rawText.trim()
    : null;
}

function getOptionalNumber(rawNumber: unknown): number | null {
  return typeof rawNumber === 'number' &&
    Number.isFinite(rawNumber) &&
    rawNumber >= 0
    ? rawNumber
    : null;
}

function getSafeUrl(rawUrl: unknown): string | null {
  const urlText: string | null = getOptionalText(rawUrl);

  if (urlText === null) {
    return null;
  }

  try {
    const parsedUrl: URL = new URL(urlText);

    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:'
      ? parsedUrl.href
      : null;
  } catch {
    return null;
  }
}

function getFlagEmoji(flagText: string | null): string | null {
  return flagText !== null &&
    /^(?:\p{Regional_Indicator}{2}|🏳️|🏴)$/u.test(flagText)
    ? flagText
    : null;
}

function parseList<ParsedItem>(
  rawItems: unknown,
  parseItem: (rawItem: unknown) => ParsedItem | null,
): ParsedItem[] {
  if (!Array.isArray(rawItems)) {
    return [];
  }

  return rawItems.flatMap((rawItem: unknown): ParsedItem[] => {
    const parsedItem: ParsedItem | null = parseItem(rawItem);

    return parsedItem === null ? [] : [parsedItem];
  });
}

function getCurrency(rawCurrency: unknown): Currency | null {
  if (!isRecord(rawCurrency)) {
    return null;
  }

  const currencyName: string | null = getOptionalText(rawCurrency['name']);

  return currencyName === null
    ? null
    : {
        name: currencyName,
        code: getOptionalText(rawCurrency['code']),
        symbol: getOptionalText(rawCurrency['symbol']),
      };
}

function getCountryDescription(
  countryName: string,
  countryRegion: string | null,
  countryCapital: string | null,
): string {
  return `${countryName}${countryRegion === null ? '' : ` is in ${countryRegion}`}.${countryCapital === null ? '' : ` Capital: ${countryCapital}.`}`;
}

function getLanguageName(rawLanguage: unknown): string | null {
  return isRecord(rawLanguage) ? getOptionalText(rawLanguage['name']) : null;
}

export function mapCountryResponse(rawCountry: unknown): Country {
  if (!isRecord(rawCountry)) {
    throw new ValidationError();
  }

  const countryName: string | null = getOptionalText(rawCountry['name']);

  if (countryName === null) {
    throw new ValidationError('A country name is required.');
  }

  const rawCountryFlags: unknown = rawCountry['flags'];
  const flagText: string | null = getOptionalText(rawCountry['flag']);
  const flagImageUrl: string | null =
    (isRecord(rawCountryFlags)
      ? (getSafeUrl(rawCountryFlags['svg']) ??
        getSafeUrl(rawCountryFlags['png']))
      : null) ?? getSafeUrl(flagText);
  const countryCapital: string | null = getOptionalText(rawCountry['capital']);
  const countryRegion: string | null = getOptionalText(rawCountry['region']);

  return {
    id:
      getOptionalText(rawCountry['alpha3Code']) ??
      getOptionalText(rawCountry['alpha2Code']) ??
      countryName,
    name: countryName,
    flagUrl: flagImageUrl,
    flagEmoji: getFlagEmoji(flagText),
    capital: countryCapital,
    region: countryRegion,
    population: getOptionalNumber(rawCountry['population']),
    area: getOptionalNumber(rawCountry['area']),
    languages: parseList(rawCountry['languages'], getLanguageName),
    currencies: parseList(rawCountry['currencies'], getCurrency),
    borders: parseList(rawCountry['borders'], getOptionalText),
    description: getCountryDescription(
      countryName,
      countryRegion,
      countryCapital,
    ),
  };
}
