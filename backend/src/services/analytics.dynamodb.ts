import { differenceInDays, subDays } from "date-fns";
import { DateRangePreset } from "../enums/date-range.enum";
import TransactionModel, {
    TransactionTypeEnum,
} from "../models/transaction.dynamodb";
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

  // Get transactions for the date range
  const transactions = await TransactionModel.findByUserId(userId, {
    startDate: from?.toISOString(),
    endDate: to?.toISOString(),
  });

  // Calculate current period analytics
  const currentPeriod = {
    totalIncome: 0,
    totalExpenses: 0,
    netIncome: 0,
    transactionCount: 0,
  };

  transactions.forEach(transaction => {
    currentPeriod.transactionCount++;
    if (transaction.type === TransactionTypeEnum.INCOME) {
      currentPeriod.totalIncome += Math.abs(transaction.amount);
    } else {
      currentPeriod.totalExpenses += Math.abs(transaction.amount);
    }
  });

  currentPeriod.netIncome = currentPeriod.totalIncome - currentPeriod.totalExpenses;

  // Calculate previous period for comparison
  let previousPeriod = {
    totalIncome: 0,
    totalExpenses: 0,
    netIncome: 0,
    transactionCount: 0,
  };

  if (from && to) {
    const periodLength = differenceInDays(to, from);
    const previousFrom = subDays(from, periodLength + 1);
    const previousTo = subDays(from, 1);

    const previousTransactions = await TransactionModel.findByUserId(userId, {
      startDate: previousFrom.toISOString(),
      endDate: previousTo.toISOString(),
    });

    previousTransactions.forEach(transaction => {
      previousPeriod.transactionCount++;
      if (transaction.type === TransactionTypeEnum.INCOME) {
        previousPeriod.totalIncome += Math.abs(transaction.amount);
      } else {
        previousPeriod.totalExpenses += Math.abs(transaction.amount);
      }
    });

    previousPeriod.netIncome = previousPeriod.totalIncome - previousPeriod.totalExpenses;
  }

  // Calculate percentage changes
  const incomeChange = previousPeriod.totalIncome > 0 
    ? ((currentPeriod.totalIncome - previousPeriod.totalIncome) / previousPeriod.totalIncome) * 100
    : 0;

  const expenseChange = previousPeriod.totalExpenses > 0
    ? ((currentPeriod.totalExpenses - previousPeriod.totalExpenses) / previousPeriod.totalExpenses) * 100
    : 0;

  const netIncomeChange = previousPeriod.netIncome !== 0
    ? ((currentPeriod.netIncome - previousPeriod.netIncome) / Math.abs(previousPeriod.netIncome)) * 100
    : 0;

  const transactionCountChange = previousPeriod.transactionCount > 0
    ? ((currentPeriod.transactionCount - previousPeriod.transactionCount) / previousPeriod.transactionCount) * 100
    : 0;

  return {
    currentPeriod: {
      totalIncome: convertToDollarUnit(currentPeriod.totalIncome),
      totalExpenses: convertToDollarUnit(currentPeriod.totalExpenses),
      netIncome: convertToDollarUnit(currentPeriod.netIncome),
      transactionCount: currentPeriod.transactionCount,
    },
    previousPeriod: {
      totalIncome: convertToDollarUnit(previousPeriod.totalIncome),
      totalExpenses: convertToDollarUnit(previousPeriod.totalExpenses),
      netIncome: convertToDollarUnit(previousPeriod.netIncome),
      transactionCount: previousPeriod.transactionCount,
    },
    changes: {
      incomeChange: Number(incomeChange.toFixed(2)),
      expenseChange: Number(expenseChange.toFixed(2)),
      netIncomeChange: Number(netIncomeChange.toFixed(2)),
      transactionCountChange: Number(transactionCountChange.toFixed(2)),
    },
    range: {
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

  const transactions = await TransactionModel.findByUserId(userId, {
    startDate: from?.toISOString(),
    endDate: to?.toISOString(),
  });

  // Group by category
  const categoryData: Record<string, { income: number; expenses: number; count: number }> = {};

  transactions.forEach(transaction => {
    if (!categoryData[transaction.category]) {
      categoryData[transaction.category] = { income: 0, expenses: 0, count: 0 };
    }

    categoryData[transaction.category].count++;
    if (transaction.type === TransactionTypeEnum.INCOME) {
      categoryData[transaction.category].income += Math.abs(transaction.amount);
    } else {
      categoryData[transaction.category].expenses += Math.abs(transaction.amount);
    }
  });

  // Convert to array and format
  const categories = Object.entries(categoryData).map(([category, data]) => ({
    category,
    income: convertToDollarUnit(data.income),
    expenses: convertToDollarUnit(data.expenses),
    netIncome: convertToDollarUnit(data.income - data.expenses),
    transactionCount: data.count,
    percentage: 0, // Will be calculated below
  }));

  // Calculate total for percentage calculation
  const totalExpenses = categories.reduce((sum, cat) => sum + cat.expenses, 0);
  const totalIncome = categories.reduce((sum, cat) => sum + cat.income, 0);

  // Add percentages
  categories.forEach(category => {
    if (category.expenses > 0) {
      category.percentage = Number(((category.expenses / totalExpenses) * 100).toFixed(2));
    }
  });

  // Sort by expenses (descending)
  categories.sort((a, b) => b.expenses - a.expenses);

  return {
    categories,
    summary: {
      totalIncome: convertToDollarUnit(totalIncome),
      totalExpenses: convertToDollarUnit(totalExpenses),
      totalTransactions: transactions.length,
    },
    range: {
      from: from?.toISOString(),
      to: to?.toISOString(),
    },
  };
};

export const trendAnalyticsService = async (
  userId: string,
  dateRangePreset?: DateRangePreset,
  customFrom?: Date,
  customTo?: Date
) => {
  const range = getDateRange(dateRangePreset, customFrom, customTo);
  const { from, to } = range;

  if (!from || !to) {
    throw new Error("Date range is required for trend analysis");
  }

  const transactions = await TransactionModel.findByUserId(userId, {
    startDate: from.toISOString(),
    endDate: to.toISOString(),
  });

  // Group by date
  const dailyData: Record<string, { income: number; expenses: number; count: number }> = {};

  transactions.forEach(transaction => {
    const date = new Date(transaction.date).toISOString().split('T')[0];
    
    if (!dailyData[date]) {
      dailyData[date] = { income: 0, expenses: 0, count: 0 };
    }

    dailyData[date].count++;
    if (transaction.type === TransactionTypeEnum.INCOME) {
      dailyData[date].income += Math.abs(transaction.amount);
    } else {
      dailyData[date].expenses += Math.abs(transaction.amount);
    }
  });

  // Convert to array and fill missing dates
  const trendData = [];
  const currentDate = new Date(from);
  const endDate = new Date(to);

  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0];
    const data = dailyData[dateStr] || { income: 0, expenses: 0, count: 0 };
    
    trendData.push({
      date: dateStr,
      income: convertToDollarUnit(data.income),
      expenses: convertToDollarUnit(data.expenses),
      netIncome: convertToDollarUnit(data.income - data.expenses),
      transactionCount: data.count,
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Calculate trends
  const firstPeriod = trendData.slice(0, Math.floor(trendData.length / 2));
  const secondPeriod = trendData.slice(Math.floor(trendData.length / 2));

  const firstPeriodAvg = {
    income: firstPeriod.reduce((sum, day) => sum + day.income, 0) / firstPeriod.length,
    expenses: firstPeriod.reduce((sum, day) => sum + day.expenses, 0) / firstPeriod.length,
  };

  const secondPeriodAvg = {
    income: secondPeriod.reduce((sum, day) => sum + day.income, 0) / secondPeriod.length,
    expenses: secondPeriod.reduce((sum, day) => sum + day.expenses, 0) / secondPeriod.length,
  };

  const incomeTrend = firstPeriodAvg.income > 0 
    ? ((secondPeriodAvg.income - firstPeriodAvg.income) / firstPeriodAvg.income) * 100
    : 0;

  const expenseTrend = firstPeriodAvg.expenses > 0
    ? ((secondPeriodAvg.expenses - firstPeriodAvg.expenses) / firstPeriodAvg.expenses) * 100
    : 0;

  return {
    trendData,
    trends: {
      incomeTrend: Number(incomeTrend.toFixed(2)),
      expenseTrend: Number(expenseTrend.toFixed(2)),
    },
    summary: {
      totalIncome: convertToDollarUnit(trendData.reduce((sum, day) => sum + day.income, 0)),
      totalExpenses: convertToDollarUnit(trendData.reduce((sum, day) => sum + day.expenses, 0)),
      totalTransactions: trendData.reduce((sum, day) => sum + day.transactionCount, 0),
    },
    range: {
      from: from.toISOString(),
      to: to.toISOString(),
    },
  };
};
