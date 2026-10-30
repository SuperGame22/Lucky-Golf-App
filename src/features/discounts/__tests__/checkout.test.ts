import { describe, it, expect } from 'vitest';
import { checkoutLink } from '../checkout';

describe('checkoutLink', () => {
  it('falls back to the Lucky Golf store when no store URL is configured', () => {
    expect(checkoutLink('SPINZ10', undefined)).toBe('https://www.luckygolf.com/discount/SPINZ10');
    expect(checkoutLink('SPINZ10', '  ')).toBe('https://www.luckygolf.com/discount/SPINZ10');
  });
  it('uses the configured store URL, without a trailing slash', () => {
    expect(checkoutLink('SPINZ10', 'https://shop.example.com/')).toBe('https://shop.example.com/discount/SPINZ10');
  });
  it('encodes the code', () => {
    expect(checkoutLink('A B/1', 'https://shop.example.com')).toBe('https://shop.example.com/discount/A%20B%2F1');
  });
});
