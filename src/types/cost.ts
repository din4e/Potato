export interface CostItem {
  id?: number;
  deviceId: string;
  category: 'hardware' | 'supplies' | 'electricity' | 'water' | 'other';
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  purchaseDate: string;
  supplier?: string;
  notes?: string;
}

export interface CostSummary {
  totalCost: number;
  categoryBreakdown: Record<string, number>;
  monthlyOperating: number;
  projectedAnnual: number;
}

export interface BudgetConfig {
  monthlyBudget: number;
  alertThreshold: number; // percentage
  alertEmails: string[];
}
