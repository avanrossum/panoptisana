import { describe, it, expect } from 'vitest';
import { isPrivateHostname, isSafeUrl } from './url-validation';

describe('isPrivateHostname', () => {
  it('blocks localhost', () => {
    expect(isPrivateHostname('localhost')).toBe(true);
    expect(isPrivateHostname('LOCALHOST')).toBe(true);
    expect(isPrivateHostname('localhost.localdomain')).toBe(true);
  });

  it('blocks 127.x.x.x loopback', () => {
    expect(isPrivateHostname('127.0.0.1')).toBe(true);
    expect(isPrivateHostname('127.255.255.255')).toBe(true);
  });

  it('blocks 10.x.x.x private', () => {
    expect(isPrivateHostname('10.0.0.1')).toBe(true);
    expect(isPrivateHostname('10.255.255.255')).toBe(true);
  });

  it('blocks 172.16-31.x.x private', () => {
    expect(isPrivateHostname('172.16.0.1')).toBe(true);
    expect(isPrivateHostname('172.31.255.255')).toBe(true);
    // 172.15.x and 172.32.x are public
    expect(isPrivateHostname('172.15.0.1')).toBe(false);
    expect(isPrivateHostname('172.32.0.1')).toBe(false);
  });

  it('blocks 192.168.x.x private', () => {
    expect(isPrivateHostname('192.168.0.1')).toBe(true);
    expect(isPrivateHostname('192.168.255.255')).toBe(true);
  });

  it('blocks 169.254.x.x link-local (AWS metadata)', () => {
    expect(isPrivateHostname('169.254.169.254')).toBe(true);
    expect(isPrivateHostname('169.254.0.1')).toBe(true);
  });

  it('blocks 0.0.0.0/8', () => {
    expect(isPrivateHostname('0.0.0.0')).toBe(true);
  });

  it('blocks IPv6 loopback and private', () => {
    expect(isPrivateHostname('::1')).toBe(true);
    expect(isPrivateHostname('[::1]')).toBe(true);
    expect(isPrivateHostname('fe80::1')).toBe(true);
    expect(isPrivateHostname('fc00::1')).toBe(true);
    expect(isPrivateHostname('fd00::1')).toBe(true);
    expect(isPrivateHostname('::')).toBe(true);
  });

  it('blocks .local/.internal/.localhost TLDs', () => {
    expect(isPrivateHostname('myserver.local')).toBe(true);
    expect(isPrivateHostname('db.internal')).toBe(true);
    expect(isPrivateHostname('app.localhost')).toBe(true);
  });

  it('allows public hostnames', () => {
    expect(isPrivateHostname('google.com')).toBe(false);
    expect(isPrivateHostname('app.asana.com')).toBe(false);
    expect(isPrivateHostname('8.8.8.8')).toBe(false);
    expect(isPrivateHostname('203.0.113.1')).toBe(false);
  });
});

describe('isSafeUrl', () => {
  it('allows public http/https URLs', () => {
    expect(isSafeUrl('https://google.com')).toBe(true);
    expect(isSafeUrl('http://example.com/path')).toBe(true);
    expect(isSafeUrl('https://app.asana.com/0/123/456')).toBe(true);
  });

  it('blocks private IPs in URLs', () => {
    expect(isSafeUrl('http://127.0.0.1:8080')).toBe(false);
    expect(isSafeUrl('http://169.254.169.254/latest/meta-data/')).toBe(false);
    expect(isSafeUrl('http://10.0.0.1/admin')).toBe(false);
    expect(isSafeUrl('http://192.168.1.1/')).toBe(false);
    expect(isSafeUrl('http://localhost:3000')).toBe(false);
  });

  it('blocks non-http protocols', () => {
    expect(isSafeUrl('file:///etc/passwd')).toBe(false);
    expect(isSafeUrl('ftp://internal.server')).toBe(false);
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
  });

  it('returns false for invalid URLs', () => {
    expect(isSafeUrl('')).toBe(false);
    expect(isSafeUrl('not-a-url')).toBe(false);
  });
});
