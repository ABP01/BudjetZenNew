import { createUserContent } from "@google/genai";
import { format } from "date-fns";
import { genAI, genAIModel } from "../config/google-ai.config";
import ReportSettingModel from "../models/report-setting.sql";
import ReportModel from "../models/report.sql";
import TransactionModel, {
  TransactionTypeEnum,
} from "../models/transaction.sql";
import { NotFoundException } from "../utils/app-error";
import { convertToDollarUnit } from "../utils/format-currency";
import { calulateNextReportDate } from "../utils/helper";
import { reportInsightPrompt } from "../utils/prompt";
import { UpdateReportSettingType } from "../validators/report.validator";

export const getAllReportsService = async (
  userId: string,
  pagination: {
    pageSize: number;
    pageNumber: number;
  }
) => {
  const { pageSize, pageNumber } = pagination;
  const offset = (pageNumber - 1) * pageSize;

  const reports = await ReportModel.findByUserId(userId, {
    limit: pageSize,
  });

  const totalCount = await ReportModel.countByStatus(userId, "SENT");
  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    reports,
    pagination: {
      pageSize,
      pageNumber,
      totalCount,
      totalPages,
      skip: offset,
    },
  };
};

export const updateReportSettingService = async (
  userId: string,
  body: UpdateReportSettingType
) => {
  const { isEnabled } = body;
  let nextReportDate: string | undefined = undefined;

  const existingReportSetting = await ReportSettingModel.findByUserId(userId);
  if (!existingReportSetting)
    throw new NotFoundException("Report setting not found");

  if (isEnabled) {
    const currentNextReportDate = existingReportSetting.nextReportDate;
    const now = new Date();
    if (!currentNextReportDate || new Date(currentNextReportDate) <= now) {
      nextReportDate = calulateNextReportDate(
        existingReportSetting.lastSentDate ? new Date(existingReportSetting.lastSentDate) : undefined
      ).toISOString();
    } else {
      nextReportDate = currentNextReportDate;
    }
  }

  console.log(nextReportDate, "nextReportDate");

  await ReportSettingModel.updateByUserId(userId, {
    ...body,
    nextReportDate,
  });
};

export const generateReportService = async (
  userId: string,
  fromDate: Date,
  toDate: Date
) => {
  // Get transactions for the date range
  const transactions = await TransactionModel.findByUserId(userId, {
    startDate: fromDate.toISOString(),
    endDate: toDate.toISOString(),
  });

  if (transactions.items.length === 0) return null;

  // Calculate summary
  let totalIncome = 0;
  let totalExpenses = 0;
  const categoryTotals: { [key: string]: number } = {};

  transactions.items.forEach(transaction => {
    const amount = transaction.amount;

    if (transaction.type === TransactionTypeEnum.INCOME) {
      totalIncome += amount;
    } else {
      totalExpenses += amount;
      
      // Track category totals for expenses
      if (!categoryTotals[transaction.category]) {
        categoryTotals[transaction.category] = 0;
      }
      categoryTotals[transaction.category] += amount;
    }
  });

  const byCategory = Object.entries(categoryTotals)
    .map(([category, total]) => ({
      category,
      amount: convertToDollarUnit(total),
      percentage: totalExpenses > 0 ? Math.round((total / totalExpenses) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
    .reduce((acc, { category, amount, percentage }) => {
      acc[category] = { amount, percentage };
      return acc;
    }, {} as Record<string, { amount: number; percentage: number }>);

  const availableBalance = totalIncome - totalExpenses;
  const savingsRate = calculateSavingRate(totalIncome, totalExpenses);

  const periodLabel = `${format(fromDate, "MMMM d")} - ${format(toDate, "d, yyyy")}`;

  const insights = await generateInsightsAI({
    totalIncome,
    totalExpenses,
    availableBalance,
    savingsRate,
    categories: byCategory,
    periodLabel: periodLabel,
  });

  return {
    period: periodLabel,
    summary: {
      income: convertToDollarUnit(totalIncome),
      expenses: convertToDollarUnit(totalExpenses),
      balance: convertToDollarUnit(availableBalance),
      savingsRate: Number(savingsRate.toFixed(1)),
      topCategories: Object.entries(byCategory)?.map(([name, cat]: any) => ({
        name,
        amount: cat.amount,
        percent: cat.percentage,
      })),
    },
    insights,
  };
};

async function generateInsightsAI({
  totalIncome,
  totalExpenses,
  availableBalance,
  savingsRate,
  categories,
  periodLabel,
}: {
  totalIncome: number;
  totalExpenses: number;
  availableBalance: number;
  savingsRate: number;
  categories: Record<string, { amount: number; percentage: number }>;
  periodLabel: string;
}) {
  try {
    const prompt = reportInsightPrompt({
      totalIncome: convertToDollarUnit(totalIncome),
      totalExpenses: convertToDollarUnit(totalExpenses),
      availableBalance: convertToDollarUnit(availableBalance),
      savingsRate: Number(savingsRate.toFixed(1)),
      categories,
      periodLabel,
    });

    const result = await genAI.models.generateContent({
      model: genAIModel,
      contents: [createUserContent([prompt])],
      config: {
        responseMimeType: "application/json",
      },
    });

    const response = result.text;
    const cleanedText = response?.replace(/```(?:json)?\n?/g, "").trim();

    if (!cleanedText) return [];

    const data = JSON.parse(cleanedText);
    return data;
  } catch (error) {
    return [];
  }
}

function calculateSavingRate(totalIncome: number, totalExpenses: number) {
  if (totalIncome <= 0) return 0;
  const savingRate = ((totalIncome - totalExpenses) / totalIncome) * 100;
  return parseFloat(savingRate.toFixed(2));
}
