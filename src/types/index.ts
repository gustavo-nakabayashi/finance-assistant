/**
 * Represents a tax to be paid
 */
export interface Tax {
  id: string;
  description: string;
  dueDate: Date;
  amount: number;
  barCode: string;
  documentType: string;
  paymentUrl?: string; // URL to the payment page
  pixCode?: string; // PIX code extracted from the payment page
}

