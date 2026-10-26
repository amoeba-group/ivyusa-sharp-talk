import { parseRobots } from './robots.util';

describe('parseRobots', () => {
  it('Shopify default: /policies/ is disallowed for every bot (REQ §4 finding)', () => {
    const r = parseRobots('User-agent: *\nDisallow: /admin\nDisallow: /policies/\nDisallow: /*/policies/\n');
    expect(r.isAllowed('/policies/refund-policy')).toBe(false);
    expect(r.isAllowed('/en/policies/refund-policy')).toBe(false);
    expect(r.isAllowed('/pages/returns-refunds')).toBe(true);
  });

  it('a group naming our bot replaces the * group', () => {
    const r = parseRobots('User-agent: *\nDisallow: /\n\nUser-agent: SharpTalkBot\nDisallow: /private\n');
    expect(r.isAllowed('/pages/shipping')).toBe(true);
    expect(r.isAllowed('/private/x')).toBe(false);
  });

  it('a group for another bot whose name merely contains "bot" is not ours', () => {
    const r = parseRobots('User-agent: bot\nDisallow: /\n');
    expect(r.isAllowed('/anything')).toBe(true);
  });

  it('longest match wins; Allow wins ties; $ anchors', () => {
    const r = parseRobots('User-agent: *\nDisallow: /pages\nAllow: /pages/policy\nDisallow: /*.pdf$\n');
    expect(r.isAllowed('/pages/about')).toBe(false);
    expect(r.isAllowed('/pages/policy-returns')).toBe(true);
    expect(r.isAllowed('/files/terms.pdf')).toBe(false);
    expect(r.isAllowed('/files/terms.pdf?v=2')).toBe(true);
  });

  it('empty Disallow and garbage allow everything', () => {
    expect(parseRobots('User-agent: *\nDisallow:\n').isAllowed('/x')).toBe(true);
    expect(parseRobots('<html>not robots</html>').isAllowed('/x')).toBe(true);
  });
});
