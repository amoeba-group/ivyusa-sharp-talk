/**
 * The page a "Watch video" link opens (FIX-261026).
 *
 * Redirecting a new tab straight at the file only works when the browser will
 * render that MIME type as a document. Most of the videos are macOS screen
 * recordings that Notion serves as `video/quicktime`, and Chrome/Edge do not
 * render that type in a tab — they turn the navigation into a download and
 * leave the tab blank. The same bytes play fine inside a `<video>` element
 * (H.264 in a MOV container), so a file gets a small player page instead.
 */

/** Paths that are a video file — anything else (YouTube, Vimeo pages) is a page to send the tab to. */
const VIDEO_FILE_PATH = /\.(mov|mp4|m4v|webm|ogv)$/i;

export function isVideoFileUrl(url: string): boolean {
  try {
    return VIDEO_FILE_PATH.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

export function renderVideoPage(url: string): string {
  const src = escapeHtml(url);
  return (
    '<!doctype html><html><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="referrer" content="no-referrer"><title>Video</title>' +
    '<style>html,body{margin:0;height:100%;background:#000;color:#e5e7eb;font-family:system-ui,sans-serif}' +
    'body{display:flex;flex-direction:column}video{flex:1;min-height:0;width:100%;background:#000}' +
    'p{margin:0;padding:.75rem 1rem;font-size:.875rem;text-align:center}a{color:#93c5fd}' +
    '#err{display:none}</style></head><body>' +
    `<video src="${src}" controls autoplay playsinline preload="metadata"></video>` +
    '<p id="err">This video cannot be played in this browser.</p>' +
    `<p><a href="${src}" download rel="noreferrer">Download video</a></p>` +
    '<script>document.querySelector("video").addEventListener("error",function(){' +
    'document.getElementById("err").style.display="block"})</script>' +
    '</body></html>'
  );
}
