import type { AxiosInstance } from "axios";

// Compartido por MyBidsPage y VehicleDetailPage: ambos ofrecen el botón
// "Pagar ahora" para una puja ganadora y deben iniciar el checkout igual.
export async function startCheckout(api: AxiosInstance, bidId: string): Promise<void> {
  const { data } = await api.post("/api/payments/create-checkout-session", { bidId });
  window.location.href = data.url;
}
