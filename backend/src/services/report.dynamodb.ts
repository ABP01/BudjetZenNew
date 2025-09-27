import { createUserContent } from "@google/genai";
import { format } from "date-fns";
import { genAI, genAIModel } from "../config/google-ai.config";
import ReportSettingModel from "../models/report-setting.dynamodb";
import ReportModel from "../models/report.dynamodb";
import TransactionModel, {
    TransactionTypeEnum,
} from "../models/transaction.dynamodb";
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

  const reports = await ReportModel.findByUserId(userId, { limit: pageSize });
  const totalCount = reports.length;
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
  const reportSetting = await ReportSettingModel.findByUserId(userId);
  if (!reportSetting) throw new NotFoundException("Report setting not found");

  const updates: any = { ...body };

  if (body.isEnabled && body.frequency) {
    updates.nextReportDate = calulateNextReportDate();
  }

  const updatedSetting = await ReportSettingModel.updateByUserId(userId, updates);
  if (!updatedSetting) throw new NotFoundException("Report setting not found");

  return updatedSetting;
};

export const getReportSettingService = async (userId: string) => {
  const reportSetting = await ReportSettingModel.findByUserId(userId);
  if (!reportSetting) throw new NotFoundException("Report setting not found");

  return reportSetting;
};

export const generateReportService = async (userId: string) => {
  const reportSetting = await ReportSettingModel.findByUserId(userId);
  if (!reportSetting) throw new NotFoundException("Report setting not found");

  if (!reportSetting.isEnabled) {
    throw new NotFoundException("Report generation is disabled");
  }

  const now = new Date();
  const currentMonth = format(now, "MMMM yyyy");
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  // Get transactions for current month
  const transactions = await TransactionModel.findByUserId(userId, {
    startDate: startOfMonth.toISOString(),
    endDate: endOfMonth.toISOString(),
  });

  // Calculate analytics
  const totalIncome = transactions
    .filter(t => t.type === TransactionTypeEnum.INCOME)
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = transactions
    .filter(t => t.type === TransactionTypeEnum.EXPENSE)
    .reduce((sum, t) => sum + t.amount, 0);

  const netIncome = totalIncome - totalExpenses;

  // Category breakdown
  const categoryBreakdown = transactions
    .filter(t => t.type === TransactionTypeEnum.EXPENSE)
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);

  // Top categories
  const topCategories = Object.entries(categoryBreakdown)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([category, amount]) => ({
      category,
      amount: convertToDollarUnit(amount),
      percentage: ((amount / totalExpenses) * 100).toFixed(1),
    }));

  // Generate AI insights
  let aiInsights = "";
  try {
    const prompt = reportInsightPrompt.replace(
      "{{month}}",
      currentMonth
    ).replace(
      "{{totalIncome}}",
      convertToDollarUnit(totalIncome).toString()
    ).replace(
      "{{totalExpenses}}",
      convertToDollarUnit(totalExpenses).toString()
    ).replace(
      "{{netIncome}}",
      convertToDollarUnit(netIncome).toString()
    );

    const result = await genAI.models.generateContent({
      model: genAIModel,
      contents: [createUserContent([prompt])],
      config: {
        temperature: 0.7,
        maxOutputTokens: 500,
      },
    });

    const response = await result.response;
    aiInsights = response.text();
  } catch (error) {
    console.error("AI insights generation failed:", error);
    aiInsights = "Unable to generate AI insights at this time.";
  }

  // Create report record
  const report = await ReportModel.create({
    userId,
    period: currentMonth,
    sentDate: now.toISOString(),
    status: "PENDING",
  });

  // Update next report date
  await ReportSettingModel.updateByUserId(userId, {
    nextReportDate: calulateNextReportDate(),
    lastSentDate: now.toISOString(),
  });

  return {
    report,
    analytics: {
      totalIncome: convertToDollarUnit(totalIncome),
      totalExpenses: convertToDollarUnit(totalExpenses),
      netIncome: convertToDollarUnit(netIncome),
      transactionCount: transactions.length,
      topCategories,
    },
    aiInsights,
    period: currentMonth,
  };
};

export const getReportByIdService = async (
  userId: string,
  reportId: string
) => {
  const report = await ReportModel.findById(reportId, userId);
  if (!report) throw new NotFoundException("Report not found");

  return report;
};

export const deleteReportService = async (
  userId: string,
  reportId: string
) => {
  const report = await ReportModel.findById(reportId, userId);
  if (!report) throw new NotFoundException("Report not found");

  await ReportModel.deleteById(reportId, userId);
};
