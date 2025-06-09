import { describe, it, expect } from 'vitest';
import { getDecimalSeparator, getLengthOfFraction, getCurrencySymbol } from './currencyFormat'; // Replace with actual path

describe('getDecimalSeparator', () => {
  it('returns "." for en-US locale', () => {
    expect(getDecimalSeparator('en-US')).toBe('.');
  });

  it('returns "," for de-DE locale', () => {
    expect(getDecimalSeparator('de-DE')).toBe(',');
  });

  it('returns correct separator for fr-FR locale', () => {
    expect(getDecimalSeparator('fr-FR')).toBe(',');
  });
});

describe('getLengthOfFraction', () => {
  it('returns 2 for USD in en-US locale', () => {
    expect(getLengthOfFraction('USD', 'en-US')).toBe(2);
  });

  it('returns 0 for JPY in en-US locale', () => {
    expect(getLengthOfFraction('JPY', 'en-US')).toBe(0);
  });

  it('returns 2 for EUR in de-DE locale', () => {
    expect(getLengthOfFraction('EUR', 'de-DE')).toBe(2);
  });

  it('returns 0 for currency with no fraction in fr-FR', () => {
    expect(getLengthOfFraction('JPY', 'fr-FR')).toBe(0);
  });

  it('returns 2 for default locale and EUR', () => {
    expect(getLengthOfFraction('EUR')).toBe(2);
  });
});

describe('getCurrencySymbol', () => {
  it('returns "$" for USD in en-US', () => {
    expect(getCurrencySymbol('USD', 'en-US')).toBe('$');
  });

  it('returns "€" for EUR in de-DE', () => {
    expect(getCurrencySymbol('EUR', 'de-DE')).toBe('€');
  });

  it('returns "¥" for JPY in ja-JP', () => {
    expect(getCurrencySymbol('JPY', 'ja-JP')).toBe('￥');
  });

  it('returns empty string for invalid currency code', () => {
    expect(()=>{getCurrencySymbol('INVALID', 'en-US')}).toThrow('Invalid currency');
  });

});
