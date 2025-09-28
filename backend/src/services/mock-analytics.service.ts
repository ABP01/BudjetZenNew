import { DateRangePreset } from "../enums/date-range.enum";
import { convertToDollarUnit } from "../utils/format-currency";

export const mockSummaryAnalyticsService = async (
  userId: string,
  dateRangePreset?: DateRangePreset,
  customFrom?: Date,
  customTo?: Date
) => {
  // Return mock data for development
  return {
    availableBalance: convertToDollarUnit(2500.00),
    totalIncome: convertToDollarUnit(5000.00),
    totalExpenses: convertToDollarUnit(2500.00),
    percentageChange: {
      balance: 12.5,
      income: 8.3,
      expenses: -5.2
    },
    savingRate: {
      percentage: 50.0,
      expenseRatio: 0.5
    }
  };
};

export const mockCategoryAnalyticsService = async (
  userId: string,
  dateRangePreset?: DateRangePreset,
  customFrom?: Date,
  customTo?: Date
) => {
  // Return mock data for development
  return [
    { category: "Food & Dining", amount: convertToDollarUnit(800.00), percentage: 32.0 },
    { category: "Transportation", amount: convertToDollarUnit(400.00), percentage: 16.0 },
    { category: "Shopping", amount: convertToDollarUnit(600.00), percentage: 24.0 },
    { category: "Entertainment", amount: convertToDollarUnit(300.00), percentage: 12.0 },
    { category: "Utilities", amount: convertToDollarUnit(400.00), percentage: 16.0 }
  ];
};

export const mockSpendingPatternAnalyticsService = async (
  userId: string,
  dateRangePreset?: DateRangePreset,
  customFrom?: Date,
  customTo?: Date
) => {
  // Return mock data for development
  return {
    chartData: [
      { date: "2024-01-01", income: convertToDollarUnit(2000.00), expenses: convertToDollarUnit(1200.00) },
      { date: "2024-01-02", income: convertToDollarUnit(0), expenses: convertToDollarUnit(800.00) },
      { date: "2024-01-03", income: convertToDollarUnit(1500.00), expenses: convertToDollarUnit(600.00) },
      { date: "2024-01-04", income: convertToDollarUnit(0), expenses: convertToDollarUnit(900.00) },
      { date: "2024-01-05", income: convertToDollarUnit(1000.00), expenses: convertToDollarUnit(700.00) }
    ],
    summary: {
      totalIncome: convertToDollarUnit(4500.00),
      totalExpenses: convertToDollarUnit(4200.00),
      netIncome: convertToDollarUnit(300.00)
    }
  };
};
