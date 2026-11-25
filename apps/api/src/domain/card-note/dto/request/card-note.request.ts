import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/** The data cards an AI line can sit next to (IVY PRD v1 C-02, PLN-261125-Phase5 §1.2). */
export const CARD_NOTE_KINDS = ['payment', 'delivery', 'stock', 'popular'] as const;
export type CardNoteKind = (typeof CARD_NOTE_KINDS)[number];

export class CardNoteRequest {
  @IsString() session_token: string;

  @IsIn(CARD_NOTE_KINDS as unknown as string[])
  kind: CardNoteKind;

  /** payment / delivery: the order on the card. Checked against the session's customer. */
  @IsOptional() @IsString() @MaxLength(32) order_id?: string;

  /** stock: the product the shopper picked, and the words they searched with. */
  @IsOptional() @IsString() @MaxLength(255) product_handle?: string;
  @IsOptional() @IsString() @MaxLength(80) q?: string;

  /** popular: the Product Help category whose (at most three) products are on screen. */
  @IsOptional() @IsString() @MaxLength(120) category?: string;
}
