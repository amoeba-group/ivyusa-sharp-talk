import {
  contactChannels,
  INQUIRY_MESSAGE_MAX,
  inquiryProblems,
  isEmailAddress,
  normalizeInquiry,
  telHref,
} from './inquiry';

describe('inquiryProblems (ivy-docs T11 D2)', () => {
  it('passes a complete inquiry', () => {
    expect(inquiryProblems({ name: 'test', email: 'hykim4@ivyent.com', message: 'dfdfdf' })).toEqual({});
  });

  it('flags every empty field, spaces included', () => {
    expect(inquiryProblems({ name: '  ', email: '', message: '\n' })).toEqual({
      name: 'required',
      email: 'required',
      message: 'required',
    });
  });

  it('flags a malformed address and an over-long message', () => {
    expect(
      inquiryProblems({ name: 'a', email: 'not-an-email', message: 'x'.repeat(INQUIRY_MESSAGE_MAX + 1) }),
    ).toEqual({ email: 'invalid', message: 'tooLong' });
  });
});

describe('isEmailAddress', () => {
  it('accepts ordinary addresses and rejects the rest', () => {
    expect(isEmailAddress('hello@ivyusa.com')).toBe(true);
    expect(isEmailAddress(' Hello@IvyUSA.com ')).toBe(true);
    expect(isEmailAddress('hello@ivyusa')).toBe(false);
    expect(isEmailAddress('two words@ivyusa.com')).toBe(false);
    expect(isEmailAddress(null)).toBe(false);
  });
});

describe('normalizeInquiry', () => {
  it('trims, lower-cases the address and keeps the name on one line', () => {
    expect(normalizeInquiry({ name: ' Mia\r\nK ', email: ' Mia@Example.COM ', message: ' hi \n' })).toEqual({
      name: 'Mia K',
      email: 'mia@example.com',
      message: 'hi',
    });
  });
});

describe('contactChannels (T11 D1, BUG-010)', () => {
  it('shows only what the tenant filled in', () => {
    expect(contactChannels({ supportEmail: 'hello@ivyusa.com' })).toEqual([{ kind: 'email', address: 'hello@ivyusa.com' }]);
    expect(contactChannels({ supportEmail: 'hello@ivyusa.com', supportPhone: '+1 800 555 0100', contactLiveChat: true })).toEqual([
      { kind: 'email', address: 'hello@ivyusa.com' },
      { kind: 'phone', number: '+1 800 555 0100' },
      { kind: 'chat' },
    ]);
  });

  it('falls back to the live chat card when nothing is configured', () => {
    expect(contactChannels(null)).toEqual([{ kind: 'chat' }]);
    expect(contactChannels({ supportEmail: '  ', supportPhone: '' })).toEqual([{ kind: 'chat' }]);
    expect(contactChannels({ supportEmail: 'broken' })).toEqual([{ kind: 'chat' }]);
  });
});

describe('telHref', () => {
  it('dials digits and keeps a leading plus', () => {
    expect(telHref('+1 (800) 555-0100')).toBe('tel:+18005550100');
    expect(telHref('1588-0000')).toBe('tel:15880000');
  });
});
