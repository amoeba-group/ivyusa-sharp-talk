import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../global/decorator/public.decorator';
import { CardNoteRequest } from './dto/request/card-note.request';
import { CardNoteService } from './card-note.service';

/** Widget-facing (public; session-token identified). Shares the `chat` prefix with ChatController. */
@ApiTags('Chat')
@Controller('chat')
export class CardNoteController {
  constructor(private readonly service: CardNoteService) {}

  @Post('card-note')
  @Public()
  @HttpCode(HttpStatus.OK)
  // Each note may be a model call: a shopper tapping is fine, a script is not.
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'AI line next to a payment / delivery / stock card (IVY PRD v1 C-02); text null = keep the fixed line' })
  async note(@Body() body: CardNoteRequest) {
    return this.service.note(body);
  }
}
