export interface CostItem {
  id?: number;
  deviceId: string;
  category: 'hardware' | 'supplies' | 'electricity' | 'water' | 'other';
  name: string;
  quantity: number;
  unitName: string;
  unitPrice: number;
  totalPrice: number;
  purchaseDate: string;
  supplier?: string;
  notes?: string;
}

export interface CostCategoryConfig {
  hardware: { name: string; unit: string; icon: string; color: string; };
  supplies: { name: string; unit: string; icon: string; color: string; };
  electricity: { name: string; unit: string; icon: string; color: string; };
  water: { name: string; unit: string; icon: string; color: string; };
  other: { name: string; unit: string; icon: string; color: string; };
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
