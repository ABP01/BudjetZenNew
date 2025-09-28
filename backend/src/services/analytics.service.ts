import { differenceInDays, subDays } from "date-fns";
import { DateRangePreset } from "../enums/date-range.enum";
import TransactionModel, {
  TransactionTypeEnum,
} from "../models/transaction.sql";
import { getDateRange } from "../utils/date";
import { convertToDollarUnit } from "../utils/format-currency";

export const summaryAnalyticsService = async (
  userId: string,
  dateRangePreset?: DateRangePreset,
  customFrom?: Date,
  customTo?: Date
) => {
  const range = getDateRange(dateRangePreset, customFrom, customTo);
  const { from, to, value: rangeValue } = range;

  // Get transactions for the current period
  const currentPeriodTransactions = await TransactionModel.findByUserId(userId, {
    startDate: from?.toISOString(),
    endDate: to?.toISOString(),
  });

  // Calculate current period totals
  let currentTotalIncome = 0;
  let currentTotalExpenses = 0;

  currentPeriodTransactions.items.forEach(transaction => {
    if (transaction.type === TransactionTypeEnum.INCOME) {
      currentTotalIncome += transaction.amount;
    } else {
      currentTotalExpenses += transaction.amount;
    }
  });

  const currentNetIncome = currentTotalIncome - currentTotalExpenses;

  // Get previous period for comparison
  let previousTotalIncome = 0;
  let previousTotalExpenses = 0;

  if (from && to) {
    const periodLength = differenceInDays(to, from);
    const previousFrom = subDays(from, periodLength + 1);
    const previousTo = subDays(from, 1);

    const previousPeriodTransactions = await TransactionModel.findByUserId(userId, {
      startDate: previousFrom.toISOString(),
      endDate: previousTo.toISOString(),
    });

    previousPeriodTransactions.items.forEach(transaction => {
      if (transaction.type === TransactionTypeEnum.INCOME) {
        previousTotalIncome += transaction.amount;
      } else {
        previousTotalExpenses += transaction.amount;
      }
    });
  }

  const previousNetIncome = previousTotalIncome - previousTotalExpenses;

  // Calculate percentage changes
  const incomeChange = previousTotalIncome > 0 
    ? ((currentTotalIncome - previousTotalIncome) / previousTotalIncome) * 100 
    : 0;
  
  const expenseChange = previousTotalExpenses > 0 
    ? ((currentTotalExpenses - previousTotalExpenses) / previousTotalExpenses) * 100 
    : 0;
  
  const netIncomeChange = previousNetIncome !== 0 
    ? ((currentNetIncome - previousNetIncome) / Math.abs(previousNetIncome)) * 100 
    : 0;

  return {
    currentPeriod: {
      totalIncome: convertToDollarUnit(currentTotalIncome),
      totalExpenses: convertToDollarUnit(currentTotalExpenses),
      netIncome: convertToDollarUnit(currentNetIncome),
    },
    previousPeriod: {
      totalIncome: convertToDollarUnit(previousTotalIncome),
      totalExpenses: convertToDollarUnit(previousTotalExpenses),
      netIncome: convertToDollarUnit(previousNetIncome),
    },
    changes: {
      incomeChange: Number(incomeChange.toFixed(1)),
      expenseChange: Number(expenseChange.toFixed(1)),
      netIncomeChange: Number(netIncomeChange.toFixed(1)),
    },
    period: {
      from: from?.toISOString(),
      to: to?.toISOString(),
      value: rangeValue,
    },
  };
};

export const categoryAnalyticsService = async (
  userId: string,
  dateRangePreset?: DateRangePreset,
  customFrom?: Date,
  customTo?: Date
) => {
  const range = getDateRange(dateRangePreset, customFrom, customTo);
  const { from, to } = range;

  // Get transactions for the period
  const transactions = await TransactionModel.findByUserId(userId, {
    startDate: from?.toISOString(),
    endDate: to?.toISOString(),
  });

  // Group by category
  const categoryTotals: { [key: string]: { income: number; expenses: number } } = {};

  transactions.items.forEach(transaction => {
    if (!categoryTotals[transaction.category]) {
      categoryTotals[transaction.category] = { income: 0, expenses: 0 };
    }

    if (transaction.type === TransactionTypeEnum.INCOME) {
      categoryTotals[transaction.category].income += transaction.amount;
    } else {
      categoryTotals[transaction.category].expenses += transaction.amount;
    }
  });

  // Convert to array and sort by total expenses
  const categoryData = Object.entries(categoryTotals)
    .map(([category, totals]) => ({
      category,
      income: convertToDollarUnit(totals.income),
      expenses: convertToDollarUnit(totals.expenses),
      net: convertToDollarUnit(totals.income - totals.expenses),
    }))
    .sort((a, b) => b.expenses - a.expenses);

  return categoryData;
};

export const monthlyTrendAnalyticsService = async (
  userId: string,
  year: number
) => {
  // Get monthly statistics using the existing method
  const monthlyStats = await TransactionModel.getMonthlyStatistics(userId, year);
  
  return monthlyStats;
};

export const spendingPatternAnalyticsService = async (
  userId: string,
  dateRangePreset?: DateRangePreset,
  customFrom?: Date,
  customTo?: Date
) => {
  const range = getDateRange(dateRangePreset, customFrom, customTo);
  const { from, to } = range;

  // Get transactions for the period
  const transactions = await TransactionModel.findByUserId(userId, {
    startDate: from?.toISOString(),
    endDate: to?.toISOString(),
  });

  // Analyze spending patterns
  const dailySpending: { [key: string]: number } = {};
  const weeklySpending: { [key: string]: number } = {};
  const categorySpending: { [key: string]: number } = {};

  transactions.items.forEach(transaction => {
    if (transaction.type === TransactionTypeEnum.EXPENSE) {
      const date = new Date(transaction.date);
      const dayKey = date.toISOString().split('T')[0];
      const weekKey = `${date.getFullYear()}-W${Math.ceil(date.getDate() / 7)}`;
      
      dailySpending[dayKey] = (dailySpending[dayKey] || 0) + transaction.amount;
      weeklySpending[weekKey] = (weeklySpending[weekKey] || 0) + transaction.amount;
      categorySpending[transaction.category] = (categorySpending[transaction.category] || 0) + transaction.amount;
    }
  });

  // Calculate averages
  const dailyAverage = Object.values(dailySpending).reduce((sum, amount) => sum + amount, 0) / Object.keys(dailySpending).length || 0;
  const weeklyAverage = Object.values(weeklySpending).reduce((sum, amount) => sum + amount, 0) / Object.keys(weeklySpending).length || 0;

  // Top spending categories
  const topCategories = Object.entries(categorySpending)
    .map(([category, amount]) => ({
      category,
      amount: convertToDollarUnit(amount),
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  return {
    dailyAverage: convertToDollarUnit(dailyAverage),
    weeklyAverage: convertToDollarUnit(weeklyAverage),
    topCategories,
    totalDays: Object.keys(dailySpending).length,
    totalWeeks: Object.keys(weeklySpending).length,
  };
};