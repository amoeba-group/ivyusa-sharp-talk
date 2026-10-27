import { maskContact } from '@sharptalk/types';
import { CallbackRequest } from './entity/callback-request.entity';
import { CallbackRequestResponse } from './dto/response/callback.response';

export class CallbackMapper {
  static toResponse(
    row: CallbackRequest,
    names: Map<string, string> = new Map(),
    hotels: Map<string, string | null> = new Map(),
  ): CallbackRequestResponse {
    const handler = row.handledBy != null ? String(row.handledBy) : null;
    return {
      id: String(row.id),
      conversationId: String(row.conversationId),
      channel: row.channel,
      contactSource: row.contactSource,
      contactMasked: maskContact(row.channel, row.contact ?? ''),
      language: row.language ?? null,
      status: row.status,
      handledBy: handler ? { id: handler, name: names.get(handler) ?? `#${handler}` } : null,
      handledAt: row.handledAt ?? null,
      createdAt: row.createdAt,
      hotel: row.sessionId != null ? hotels.get(String(row.sessionId)) ?? null : null,
    };
  }
}
