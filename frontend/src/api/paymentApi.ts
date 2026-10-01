import { apiClient } from './client';
import { publicApiClient } from './saokeApi';

export interface PaymentSettingsDTO {
  enabled: boolean;
  bankName: string;
  bankBin: string;
  accountNumber: string;
  accountName: string;
}

export interface PublicPaymentQRDTO {
  month: string;
  memberName: string;
  memberCode: string;
  amount: number;
  currency: string;
  bankName: string;
  bankBin: string;
  accountNumber: string;
  accountName: string;
  transferContent: string;
  qr: {
    format: string;
    url: string;
  };
}

// Protected Admin API
export const getAdminPaymentSettings = async (): Promise<PaymentSettingsDTO> => {
  const res = await apiClient.get<{ success: boolean; data: PaymentSettingsDTO }>('/admin/payment-settings');
  return res.data.data;
};

export const updateAdminPaymentSettings = async (
  params: Partial<PaymentSettingsDTO>
): Promise<PaymentSettingsDTO> => {
  const res = await apiClient.put<{ success: boolean; data: PaymentSettingsDTO }>('/admin/payment-settings', params);
  return res.data.data;
};

// Public API (No Auth)
export const getPublicPaymentInfo = async (): Promise<PaymentSettingsDTO> => {
  const res = await publicApiClient.get<{ success: boolean; data: PaymentSettingsDTO }>('/public/payment-info');
  return res.data.data;
};

export const getPublicPaymentQR = async (month: string, paymentReference: string): Promise<PublicPaymentQRDTO> => {
  const res = await publicApiClient.get<{ success: boolean; data: PublicPaymentQRDTO }>(
    `/public/payment/qr?month=${encodeURIComponent(month)}&paymentReference=${encodeURIComponent(paymentReference)}&memberId=${encodeURIComponent(paymentReference)}`
  );
  return res.data.data;
};

export const notifyPublicPayment = async (paymentReference: string): Promise<{ notified: boolean; message: string }> => {
  // STRICT: Body sent to server contains ONLY paymentReference!
  const res = await publicApiClient.post<{ success: boolean; data: { notified: boolean; message: string } }>(
    '/public/payment/notify',
    { paymentReference }
  );
  return res.data.data;
};
