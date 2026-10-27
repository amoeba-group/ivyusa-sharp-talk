import {
  CHAT_CLOSE_DEFAULT_COPY,
  chatCopy,
  maskEmail,
  maskPhone,
  normalizeChatClosePolicy,
  normalizePhone,
} from './chat-close';

describe('normalizeChatClosePolicy', () => {
  it('fills defaults and keeps trimmed copy', () => {
    expect(normalizeChatClosePolicy({ csatPrompt: { KO: '  평가해 주세요 ', VI: '   ' } })).toEqual({
      csatAfterMin: 3,
      closeAfterMin: 3,
      csatPrompt: { KO: '평가해 주세요' },
    });
  });
  it('rejects out-of-range minutes', () => {
    expect(normalizeChatClosePolicy({ csatAfterMin: 0 })).toBeNull();
    expect(normalizeChatClosePolicy({ closeAfterMin: 61 })).toBeNull();
    expect(normalizeChatClosePolicy({ csatAfterMin: 2.5 })).toBeNull();
  });
  it('drops keys that are not language codes', () => {
    expect(normalizeChatClosePolicy({ thanksNotice: { ko: 'x', EN: 'Thanks' } })?.thanksNotice).toEqual({ EN: 'Thanks' });
  });
});

describe('chatCopy', () => {
  it('uses the tenant line for the exact language only', () => {
    expect(chatCopy({ KO: '평가 부탁드려요' }, CHAT_CLOSE_DEFAULT_COPY.csatPrompt, 'KO')).toBe('평가 부탁드려요');
    // A Korean-only tenant line is not served to a Vietnamese shopper.
    expect(chatCopy({ KO: '평가 부탁드려요' }, CHAT_CLOSE_DEFAULT_COPY.csatPrompt, 'VI')).toBe(
      CHAT_CLOSE_DEFAULT_COPY.csatPrompt.VI,
    );
  });
});

describe('masking', () => {
  it('masks email and phone', () => {
    expect(maskEmail('nguyen.a@company.vn')).toBe('ng***@company.vn');
    expect(maskPhone('+84901234521')).toBe('+84 90*****21');
    expect(maskPhone('0901234521')).toBe('090*****21');
  });
});

describe('normalizePhone', () => {
  it('accepts international and national forms', () => {
    expect(normalizePhone('+84 90-123 4521')).toBe('+84901234521');
    expect(normalizePhone('090 123 4521')).toBe('0901234521');
  });
  it('rejects garbage', () => {
    expect(normalizePhone('call me')).toBeNull();
    expect(normalizePhone('12')).toBeNull();
  });
});
