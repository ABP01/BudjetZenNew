import { Router } from "express";
import {
    categoryAnalyticsController,
    spendingPatternController,
    summaryAnalyticsController,
} from "../controllers/analytics.controller";

const analyticsRoutes = Router();

analyticsRoutes.get("/summary", summaryAnalyticsController);
analyticsRoutes.get("/category", categoryAnalyticsController);
analyticsRoutes.get("/spending-pattern", spendingPatternController);

export default analyticsRoutes;
