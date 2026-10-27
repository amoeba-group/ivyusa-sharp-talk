// Copy the Go2Joy work request and HA spec from docs/guide into the manual
// sources (apps/web/public/manual/go2joy/{doc}.{lang}.md) before build-manual.mjs.
// Adds a one-line lead (date, version, PDF link) under the title, and rewrites
// links Go2Joy cannot open (repository paths, private shared pages).
//   node scripts/go2joy-manual/sync-from-guide.mjs
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const GUIDE = path.join(ROOT, 'docs/guide');
const OUT = path.join(ROOT, 'apps/web/public/manual/go2joy');

const SRC = { 'work-request': 'GUIDE-261023-Go2Joy-Work-Request', 'ha-identify': 'GUIDE-261024-Go2Joy-HA-Identify-v1.4' };
const LEAD = {
  'work-request': {
    ko: '> Go2Joy가 해야 할 작업을 담당별로 정리한 요청서입니다(2026-10-27 · v1.4). HA 개발팀은 맨 앞 체크리스트와 [HA 연동 규격 v1.4](ha-identify.ko.html)를 함께 보십시오. 인쇄·전달용: [PDF](work-request.ko.pdf)',
    en: '> Work request listing what Go2Joy needs to do, by owner (2026-10-27 · v1.4). HA developers: read the checklist at the top together with the [HA integration spec v1.4](ha-identify.en.html). For printing or sending: [PDF](work-request.en.pdf)',
    vi: '> Yêu cầu công việc liệt kê những việc Go2Joy cần làm theo từng bộ phận (2026-10-27 · v1.4). Đội phát triển HA: xem checklist ở đầu tài liệu cùng với [Đặc tả tích hợp HA v1.4](ha-identify.vi.html). Để in hoặc gửi: [PDF](work-request.vi.pdf)',
  },
  'ha-identify': {
    ko: '> Go2Joy HA 개발팀이 구현할 로그인 사용자 연동 규격 v1.4입니다(2026-10-24, 문서 개정 10/27). 맨 앞 체크리스트를 모두 통과하면 완료입니다. 일정·담당은 [작업요청서](work-request.ko.html). 인쇄·전달용: [PDF](ha-identify.ko.pdf)',
    en: '> Sign-in integration spec v1.4 for the Go2Joy HA dev team (2026-10-24, doc revision 10/27). Done means every item in the checklist at the top passes. Schedule and owners: [work request](work-request.en.html). For printing or sending: [PDF](ha-identify.en.pdf)',
    vi: '> Đặc tả tích hợp người dùng đăng nhập v1.4 dành cho đội phát triển HA của Go2Joy (2026-10-24, sửa tài liệu 10/27). Hoàn thành khi mọi mục trong checklist ở đầu tài liệu đều đạt. Lịch trình và người phụ trách: [yêu cầu công việc](work-request.vi.html). Để in hoặc gửi: [PDF](ha-identify.vi.pdf)',
  },
};

for (const doc of Object.keys(SRC)) {
  for (const lang of ['ko', 'en', 'vi']) {
    const file = path.join(GUIDE, `${SRC[doc]}${lang === 'ko' ? '' : `.${lang}`}.md`);
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    if (!lines[0].startsWith('# ')) throw new Error(`no title in ${file}`);
    let rest = lines.slice(1);
    // The work request's own intro blockquote points at repository files; the lead replaces it.
    if (doc === 'work-request') {
      let i = 0;
      while (i < rest.length && (rest[i].trim() === '' || rest[i].startsWith('>'))) i += 1;
      rest = rest.slice(i);
    }
    let body = [lines[0], '', LEAD[doc][lang], '', ...rest].join('\n');
    body = body
      .replace(/\n\| [^|\n]+ \| https:\/\/claude\.ai\/artifact\/[A-Za-z0-9]+ \([^)]*\) \|/g, '')
      .replaceAll('`scripts/go2joy/php/sharptalk_identity.php` · `vectors.php`', '[sharptalk_identity.php](files/sharptalk_identity.php.txt) · [vectors.php](files/vectors.php.txt)')
      .replaceAll('`scripts/go2joy/php/sharptalk_identity.php`', '[sharptalk_identity.php](files/sharptalk_identity.php.txt)');
    fs.writeFileSync(path.join(OUT, `${doc}.${lang}.md`), body);
    console.log('wrote', doc, lang);
  }
}
