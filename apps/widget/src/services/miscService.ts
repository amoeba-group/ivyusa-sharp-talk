import { apiClient } from '../lib/api-client';

export function createReview(
  sessionToken: string,
  orderItemId: string,
  rating: number,
  body: string,
): Promise<unknown> {
  return apiClient.post('/reviews', {
    session_token: sessionToken,
    order_item_id: orderItemId,
    rating,
    body,
  });
}

export function restockSubscribe(
  sessionToken: string,
  productId: string,
): Promise<unknown> {
  return apiClient.post('/restock/subscribe', {
    session_token: sessionToken,
    product_id: productId,
  });
}
