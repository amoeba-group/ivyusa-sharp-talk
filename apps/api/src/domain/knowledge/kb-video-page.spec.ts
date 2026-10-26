import { isVideoFileUrl, renderVideoPage } from './kb-video-page';

/**
 * FIX-261026: Chrome downloads a `video/quicktime` tab instead of showing it,
 * so a video file gets a player page; a video page (YouTube) is still a redirect.
 */
describe('KB video page', () => {
  const NOTION_MOV =
    'https://prod-files-secure.s3.us-west-2.amazonaws.com/ws/f/Screen_Recording_2022-12-28_at_10.17.06.mov?X-Amz-Signature=ab&x-id=GetObject';

  it('treats a file URL as a video by its path, ignoring the query', () => {
    expect(isVideoFileUrl(NOTION_MOV)).toBe(true);
    expect(isVideoFileUrl('https://cdn.example/a/clip.MP4')).toBe(true);
    expect(isVideoFileUrl('https://cdn.example/a/clip.webm')).toBe(true);
  });

  it('sends video pages and odd input to a redirect', () => {
    expect(isVideoFileUrl('https://youtu.be/abc')).toBe(false);
    expect(isVideoFileUrl('https://www.youtube.com/watch?v=abc&f=x.mp4')).toBe(false);
    expect(isVideoFileUrl('not a url')).toBe(false);
  });

  it('plays the file in a <video> with a download fallback, URL attribute-escaped', () => {
    const html = renderVideoPage(NOTION_MOV);
    const escaped = NOTION_MOV.replace(/&/g, '&amp;');
    expect(html).toContain(`<video src="${escaped}" controls`);
    expect(html).toContain('playsinline');
    expect(html).toContain(`<a href="${escaped}" download`);
    expect(html).toContain('name="referrer" content="no-referrer"');
  });

  it('cannot be broken out of the attribute', () => {
    const html = renderVideoPage('https://x.example/a.mp4?q="><script>alert(1)</script>');
    expect(html).not.toContain('"><script>alert(1)');
    expect(html).toContain('&quot;&gt;&lt;script&gt;');
  });
});
