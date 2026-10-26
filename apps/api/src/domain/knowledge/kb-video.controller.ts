import { Controller, Get, Param, ParseIntPipe, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../../global/decorator/public.decorator';
import { KbVideoService } from './kb-video.service';
import { isVideoFileUrl, renderVideoPage } from './kb-video-page';

/**
 * Public "watch video" link (PLN-261006-KB-Video-Links). Opened in a new tab
 * from a chat answer, so it answers with a player page (a video file — FIX-261026),
 * a redirect (a video page such as YouTube) or a short readable error page —
 * never the JSON envelope. The signature in the URL is the authorisation.
 */
@ApiTags('Knowledge')
@Controller('kb-videos')
export class KbVideoController {
  constructor(private readonly videos: KbVideoService) {}

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Play (or redirect to) the video a KB document explains' })
  async play(
    @Param('id', ParseIntPipe) id: number,
    @Query('t') t: string,
    @Query('sig') sig: string,
    @Res() res: Response,
  ): Promise<void> {
    const r = await this.videos.resolve(id, Number(t), String(sig ?? ''));
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    if (r.ok) {
      if (isVideoFileUrl(r.url)) res.status(200).type('html').send(renderVideoPage(r.url));
      else res.redirect(302, r.url);
      return;
    }
    // `broken` (the source no longer has the video) is permanent → 404.
    const status = r.reason === 'unavailable' ? 503 : 404;
    res
      .status(status)
      .type('html')
      .send(
        '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
          '<title>Video</title><body style="font-family:system-ui;padding:2rem;color:#374151">' +
          (status === 503
            ? '<p>This video cannot be played right now. Please try again later.</p>'
            : '<p>This video link is not available.</p>') +
          '</body>',
      );
  }
}
