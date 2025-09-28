import { Router } from "express";
import {
    categoryAnalyticsController,
    spendingPatternController,
    summaryAnalyticsController,
} from "../controllers/analytics.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

const analyticsRoutes = Router();

// Apply auth middleware to all analytics routes
analyticsRoutes.use(authMiddleware);

analyticsRoutes.get("/summary", summaryAnalyticsController);
analyticsRoutes.get("/category", categoryAnalyticsController);
analyticsRoutes.get("/spending-pattern", spendingPatternController);
// Aliases for frontend compatibility
analyticsRoutes.get("/chart", spendingPatternController);
analyticsRoutes.get("/expense-breakdown", categoryAnalyticsController);

export default analyticsRoutes;
