import { describe, expect, it } from 'vitest';
import vercelJson from '../../vercel.json?raw';

interface Rewrite { source: string; destination: string }
const config = JSON.parse(vercelJson) as { rewrites: Rewrite[]; installCommand: string };

// Minimal path-to-regexp subset, enough for the sources we write: `:name(regex)` and `(.*)`
const toRegExp = (source: string): RegExp =>
  new RegExp('^' + source.replace(/:\w+\(/g, '(') + '$');

const firstMatch = (path: string): Rewrite | undefined =>
  config.rewrites.find((rewrite) => toRegExp(rewrite.source).test(path));

const isProxied = (path: string): boolean => {
  const hit = firstMatch(path);
  return !!hit && /^https:\/\//.test(hit.destination);
};

describe('vercel.json tab rewrites', () => {
  it('proxies the exact URLs tabsApi builds', () => {
    expect(isProxied('/api/tabs/songs')).toBe(true);
    expect(isProxied('/api/tabs/meta/123')).toBe(true);
    expect(isProxied('/cdn/tabs/123/456/abcDEF_1/0.json')).toBe(true);
    expect(isProxied('/cdn2/tabs/123/456/abcDEF_1/2.json')).toBe(true);
  });

  it('does not forward anything else to the provider', () => {
    for (const path of [
      '/api/tabs/admin', '/api/tabs/meta/abc', '/api/tabs/meta/1/extra', '/api/tabs',
      '/cdn/tabs/1/2/img/3.png', '/cdn/tabs/x/2/img/3.json', '/cdn2/tabs/anything', '/cdn/tabs/../x'
    ]) {
      expect(isProxied(path), path).toBe(false);
    }
  });

  it('keeps api, cdn and static prefixes out of the SPA fallback', () => {
    for (const path of ['/api/tabs/admin', '/cdn/tabs/x', '/cdn2/tabs/x', '/.well-known/nada', '/assets/x.js']) {
      expect(firstMatch(path), path).toBeUndefined();
    }
    expect(firstMatch('/algum-lugar')?.destination).toBe('/index.html');
  });

  it('installs with npm ci', () => {
    expect(config.installCommand).toBe('npm ci');
  });
});
