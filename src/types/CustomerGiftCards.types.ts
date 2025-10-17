// Types for: src/pages/customer/CustomerGiftCards.tsx

export interface CustomerGiftCardsCard {
  id: string;
  code: string;
  amount: number;
  balance: number;
  status: 'active' | 'used' | 'expired';
  purchasedDate: string;
  expiryDate: string;
  recipientEmail?: string;
  senderName: string;
  message?: string;
}
