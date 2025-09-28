import { Request, Response } from "express";
import { HTTPSTATUS } from "../config/http.config";
import { DateRangePreset } from "../enums/date-range.enum";
import { asyncHandler } from "../middlewares/asyncHandler.middlerware";
import {
  mockCategoryAnalyticsService,
  mockSpendingPatternAnalyticsService,
  mockSummaryAnalyticsService,
} from "../services/mock-analytics.service";

export const summaryAnalyticsController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.userId;
    if (!userId) throw new Error("User ID is required");

    const { preset, from, to } = req.query;

    const filter = {
      dateRangePreset: preset as DateRangePreset,
      customFrom: from ? new Date(from as string) : undefined,
      customTo: to ? new Date(to as string) : undefined,
    };
    const stats = await mockSummaryAnalyticsService(
      userId,
      filter.dateRangePreset,
      filter.customFrom,
      filter.customTo
    );

    return res.status(HTTPSTATUS.OK).json({
      message: "Summary fetched successfully",
      data: stats,
    });
  }
);

export const categoryAnalyticsController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.userId;
    if (!userId) throw new Error("User ID is required");
    
    const { preset, from, to } = req.query;

    const filter = {
      dateRangePreset: preset as DateRangePreset,
      customFrom: from ? new Date(from as string) : undefined,
      customTo: to ? new Date(to as string) : undefined,
    };

    const chartData = await mockCategoryAnalyticsService(
      userId,
      filter.dateRangePreset,
      filter.customFrom,
      filter.customTo
    );

    return res.status(HTTPSTATUS.OK).json({
      message: "Category analytics fetched successfully",
      data: chartData,
    });
  }
);

export const spendingPatternController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.userId;
    if (!userId) throw new Error("User ID is required");
    
    const { preset, from, to } = req.query;

    const filter = {
      dateRangePreset: preset as DateRangePreset,
      customFrom: from ? new Date(from as string) : undefined,
      customTo: to ? new Date(to as string) : undefined,
    };
    const patternData = await mockSpendingPatternAnalyticsService(
      userId,
      filter.dateRangePreset,
      filter.customFrom,
      filter.customTo
    );

    return res.status(HTTPSTATUS.OK).json({
      message: "Spending pattern fetched successfully",
      data: patternData,
    });
  }
);
