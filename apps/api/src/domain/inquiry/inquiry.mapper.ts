import { maskEmail } from '@sharptalk/types';
import { Inquiry } from './entity/inquiry.entity';

const id = (v: number | null | undefined): string | null => (v == null ? null : String(v));

/** How much of the message the console list shows before "Open". */
export const INQUIRY_PREVIEW_CHARS = 120;

export interface InquiryView {
  id: string;
  /** 'inquiry' | 'feedback' (IVY PRD v1 C-01). */
  kind: string;
  orderId: string | null;
  status: string;
  createdAt: Date;
}

/**
 * The console list (ivy-docs T11 D4). The address comes masked, the message
 * shortened: the full text is one audited read away (`toAdminDetail`), the
 * same split as callback contacts (PLN-261026 D6).
 */
export interface AdminInquiryView extends InquiryView {
  /** The attached order's number, when the form named one of the shopper's orders (E-01). */
  orderNumber: string | null;
  conversationId: string | null;
  customerId: string | null;
  contactName: string | null;
  contactEmailMasked: string | null;
  messagePreview: string | null;
  language: string | null;
}

export interface AdminInquiryDetail extends AdminInquiryView {
  contactEmail: string | null;
  message: string | null;
}

/** Entity -> response mapping for inquiries. */
export class InquiryMapper {
  static toView(inquiry: Inquiry): InquiryView {
    return {
      id: String(inquiry.id),
      kind: inquiry.kind ?? 'inquiry',
      orderId: id(inquiry.orderId),
      status: inquiry.status,
      createdAt: inquiry.createdAt,
    };
  }

  static toViewList(inquiries: Inquiry[]): InquiryView[] {
    return inquiries.map((i) => this.toView(i));
  }

  static toAdminView(inquiry: Inquiry, orderNumber: string | null = null): AdminInquiryView {
    const message = inquiry.message ?? null;
    return {
      ...this.toView(inquiry),
      orderNumber,
      conversationId: id(inquiry.conversationId),
      customerId: id(inquiry.customerId),
      contactName: inquiry.contactName ?? null,
      contactEmailMasked: inquiry.contactEmail ? maskEmail(inquiry.contactEmail) : null,
      messagePreview:
        message == null
          ? null
          : message.length > INQUIRY_PREVIEW_CHARS
            ? `${message.slice(0, INQUIRY_PREVIEW_CHARS).trimEnd()}…`
            : message,
      language: inquiry.language ?? null,
    };
  }

  static toAdminViewList(inquiries: Inquiry[], orderNumbers: Map<string, string> = new Map()): AdminInquiryView[] {
    return inquiries.map((i) => this.toAdminView(i, i.orderId != null ? orderNumbers.get(String(i.orderId)) ?? null : null));
  }

  static toAdminDetail(inquiry: Inquiry, orderNumber: string | null = null): AdminInquiryDetail {
    return {
      ...this.toAdminView(inquiry, orderNumber),
      contactEmail: inquiry.contactEmail ?? null,
      message: inquiry.message ?? null,
    };
  }
}
