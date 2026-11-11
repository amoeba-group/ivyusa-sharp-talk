/**
 * Test data taken from the Figma "TalkTalk" design (file fviVlvtkuHYU0Agre1daTr, page 23:2).
 * Shapes follow packages/types/src/api/widget.types.ts. Fields marked PROPOSED do not exist in
 * the API yet — they are the contract the matching task (ivy-docs/TASKS.md) must implement.
 *
 * Times are relative to "now" so grouping (Today / Yesterday) and relative labels
 * ("Just now", "10mins ago") stay true whenever the suite runs.
 */

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
export const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

/**
 * A time on YESTERDAY's calendar date, whenever the suite runs. Exactly 24 hours
 * back always is (outside a DST changeover day); "26 hours ago" was not — from
 * 00:00 to 02:00 New York time (05:00–07:00 UTC, midday in Vietnam) it is two
 * days back, and the Yesterday's group TC-02-02 asserts disappeared.
 */
export const yesterday = () => ago(DAY);

export const CUSTOMER = {
  fullName: 'Kiho Lee',
  firstName: 'Kiho',
  email: 'hykim4@ivyent.com',
};

/** Order ids are strings in the API (bigint). */
export const ORDERS = {
  confirmed: { id: '39891', orderNumber: 'IVY-39891' },
  inTransit: { id: '39641', orderNumber: 'IVY-39641' },
  delivered: { id: '39880', orderNumber: 'IVY-39880' },
  reviewable: { id: '39875', orderNumber: 'IVY-39875' },
};

export function orderList() {
  return [
    {
      id: ORDERS.confirmed.id, orderNumber: 'IVY-39891', statusInternal: 'paid', statusUi: 'Confirmed',
      total: 55, currency: 'USD', createdAt: ago(20_000), orderedAt: ago(20_000),
      itemCount: 3, firstItemTitle: 'Hydrating Face Mask (10pcs)',
    },
    {
      id: ORDERS.inTransit.id, orderNumber: 'IVY-39641', statusInternal: 'shipping', statusUi: 'In Transit',
      total: 32, currency: 'USD', createdAt: ago(10 * MIN), orderedAt: ago(10 * MIN),
      itemCount: 1, firstItemTitle: 'Vitamin C Serum Set',
    },
    {
      id: ORDERS.delivered.id, orderNumber: 'IVY-39880', statusInternal: 'delivered', statusUi: 'Delivered',
      total: 41.5, currency: 'USD', createdAt: yesterday(), orderedAt: yesterday(),
      itemCount: 3, firstItemTitle: 'Hydrating Face Mask 10pcs',
    },
    {
      id: ORDERS.reviewable.id, orderNumber: 'IVY-39875', statusInternal: 'delivered', statusUi: 'Delivered',
      total: 55, currency: 'USD', createdAt: ago(4 * DAY), orderedAt: ago(4 * DAY),
      itemCount: 1, firstItemTitle: 'Rose Hip Facial Oil 30ml',
    },
  ];
}

/** Order Detail — Figma 1154:116 / 1007:250. */
export function orderDetail(id: string) {
  const base = orderList().find((o) => o.id === id) ?? orderList()[0];
  return {
    ...base,
    subtotal: 55,
    discountTotal: 4.99,
    shippingTotal: 0,
    itemQty: 3,
    contactName: 'Hyein Kim',
    contactEmail: 'hykim4@ivyent.com',
    items: [
      { id: 'li-1', title: 'Hydrating Face Mask (10pcs)', optionText: null, qty: 1, price: 4.99, imageUrl: null },
      { id: 'li-2', title: 'Ultra Mini Portable Fan, Powerful Pocket-Sized Handheld Fan', optionText: 'Burgundy / 6-8', qty: 1, price: 4.99, imageUrl: null },
      { id: 'li-3', title: 'Ultra Mini Portable Fan, Powerful Pocket-Sized Handheld Fan', optionText: 'Burgundy / 6-8', qty: 1, price: 4.99, imageUrl: null },
    ],
    // PROPOSED (T04): addresses + phone are not in OrderDetailResponse yet.
    billingAddress: null,
    shippingAddress: {
      name: 'Hyein Kim',
      address1: '25 HARBOR PARK DR',
      address2: null,
      city: 'PORT WASHINGTON',
      province: 'New York',
      zip: '11050-4605',
      country: 'United States',
      phone: '123123123',
    },
  };
}

export const DELIVERY_STEPS = ['Preparing', 'Processing', 'In Transit', 'Delivered'];

export function tracking(id: string) {
  const delivered = id === ORDERS.delivered.id || id === ORDERS.reviewable.id;
  return {
    status: delivered ? 'delivered' : 'in_transit',
    carrier: 'UPS',
    trackingNumber: delivered ? '1Z999AA10000000001' : '1Z999AA10123456784',
    trackingUrl: `https://www.ups.com/track?tracknum=${delivered ? '1Z999AA10000000001' : '1Z999AA10123456784'}`,
    stepIndex: delivered ? 3 : 2,
    steps: DELIVERY_STEPS,
  };
}

/** Notifications feed — Figma Master Shots 992:526 / 1006:7825 / 1006:5284. */
export function notifications() {
  return [
    {
      id: '501', category: 'payment', title: 'IVY-39891', body: 'Hydrating Face Mask (10pcs) + 2 items',
      statusBadge: 'Confirmed', linkUrl: null, refType: 'order', refId: ORDERS.confirmed.id, channel: 'in_app',
      read: false, readAt: null, createdAt: ago(20_000),
    },
    {
      id: '502', category: 'shipping', title: 'IVY-39641', body: 'Vitamin C Serum Set',
      statusBadge: 'In Transit', linkUrl: null, refType: 'order', refId: ORDERS.inTransit.id, channel: 'in_app',
      read: true, readAt: ago(5 * MIN), createdAt: ago(10 * MIN),
    },
    {
      id: '503', category: 'event', title: 'Your exclusive 10% off coupon has arrived!', body: 'Available today only!',
      statusBadge: null, linkUrl: null, refType: null, refId: null, channel: 'in_app',
      read: false, readAt: null, createdAt: ago(3 * HOUR),
      kind: 'coupon', couponCode: 'IVY10', // PROPOSED (T05)
    },
    {
      id: '504', category: 'event', title: 'Mad Shade', body: 'Buy one Get One 50% OFF today !',
      statusBadge: null, linkUrl: 'https://ivyusa.com/collections/mad-shade', refType: 'campaign', refId: '77', channel: 'in_app',
      read: true, readAt: ago(2 * HOUR), createdAt: ago(3 * HOUR),
      kind: 'event', couponCode: null, // PROPOSED (T05)
    },
    {
      id: '505', category: 'shipping', title: 'IVY-39880', body: 'Hydrating Face Mask 10pcs + 2 items',
      statusBadge: 'Delivered', linkUrl: null, refType: 'order', refId: ORDERS.delivered.id, channel: 'in_app',
      read: true, readAt: ago(DAY), createdAt: yesterday(),
    },
    {
      id: '506', category: 'event', title: 'BACK TO SCHOOL', body: 'Buy one Get One CODE:SCHOOL20',
      statusBadge: null, linkUrl: 'https://ivyusa.com/pages/back-to-school', refType: 'campaign', refId: '78', channel: 'in_app',
      read: true, readAt: ago(DAY), createdAt: ago(DAY + 3 * HOUR),
      kind: 'coupon', couponCode: 'SCHOOL20', // PROPOSED (T05)
    },
    {
      id: '507', category: 'review', title: 'IVY-39875', body: 'Rose Hip Facial Oil 30ml · $55.00',
      statusBadge: 'Review', linkUrl: null, refType: 'order_item', refId: 'li-9', channel: 'in_app',
      read: true, readAt: ago(3 * DAY), createdAt: ago(4 * DAY),
    },
  ];
}

export function reviewItems() {
  return [
    {
      orderItemId: 'li-9', orderId: ORDERS.reviewable.id, orderNumber: 'IVY-39875', title: 'Rose Hip Facial Oil 30ml',
      optionText: null, price: 55, currency: 'USD', imageUrl: null, productUrl: 'https://ivyusa.com/products/rose-hip-facial-oil',
      reviewed: false, orderedAt: ago(4 * DAY),
    },
  ];
}

/** Chat home quick replies — Figma 1008:2291 (KO) with the English copy proposed in SPEC Q-07. */
export const IVY_QUICK_REPLIES = [
  { id: 'payment_check', emoji: '💰', label: 'Payment check', ko: '결제 확인', action: 'message' },
  { id: 'delivery_inquiry', emoji: '🚚', label: 'Delivery inquiry', ko: '배송 문의', action: 'delivery_status' },
  { id: 'stock_inquiry', emoji: '📦', label: 'Stock inquiry', ko: '재고 문의', action: 'message' },
  { id: 'exchange_refund', emoji: '😊', label: 'Exchange & Refund', ko: '교환 및 환불', action: 'cancel_refund' },
  { id: 'product_inquiry', emoji: '✨', label: 'Product inquiry', ko: '제품문의', action: 'product_help' },
  { id: 'feedback', emoji: '💬', label: 'Feedback', ko: '피드백', action: 'message' },
  { id: 'contact_support', emoji: '🤝', label: 'Contact Support', ko: 'Contact Support', action: 'contact_support' },
];

/** Scenario config incl. the flows reached from other entry points (My Orders, Affiliate). */
export function scenarioConfig(opts: { withFlows?: boolean } = {}) {
  const buttons = IVY_QUICK_REPLIES.map(({ id, emoji, label, action }) => ({
    id, label, action, enabled: true,
    emoji, // PROPOSED (T08)
  }));
  if (opts.withFlows) {
    buttons.push(
      { id: 'my_orders', label: 'My Orders', action: 'my_orders', enabled: true, emoji: '📦' },
      { id: 'affiliate', label: 'How to become an Affiliate?', action: 'affiliate', enabled: true, emoji: '💼' },
    );
  }
  return { scenarioButtons: buttons };
}

/** Product Help categories — Figma 993:2207 (mirror ivyusa.com collections). */
export const PRODUCT_CATEGORIES = [
  'Hair', 'Makeup', 'Lashes', 'For Men', 'Fragrance', 'Nails', 'Face & Body', 'Fashion', 'For Kids', 'Wellness', 'K-Beauty',
];

export const SUPPORT_EMAIL = 'help@ivy.com';
