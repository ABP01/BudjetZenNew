import cors from "cors";
import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";

import connectDatabase from "./config/database.config";
import { Env } from "./config/env.config";
import { HTTPSTATUS } from "./config/http.config";
import { initializeCrons } from "./cron";
import { asyncHandler } from "./middlewares/asyncHandler.middlerware";
import { errorHandler } from "./middlewares/errorHandler.middleware";
import analyticsRoutes from "./routes/analytics.route";
import authRoutes from "./routes/auth.route";
import reportRoutes from "./routes/report.route";
import transactionRoutes from "./routes/transaction.route";
import userRoutes from "./routes/user.route";

const app = express();
const BASE_PATH = Env.BASE_PATH;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));



app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      const allowedOrigins = [
        Env.FRONTEND_ORIGIN,
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173"
      ];
      
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.get(
  "/",
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    res.status(HTTPSTATUS.OK).json({
      message: "Hello Subcribe to the channel",
    });
  })
);

app.use(`${BASE_PATH}/auth`, authRoutes);
app.use(`${BASE_PATH}/user`, userRoutes);
app.use(`${BASE_PATH}/transaction`, transactionRoutes);
app.use(`${BASE_PATH}/report`, reportRoutes);
app.use(`${BASE_PATH}/analytics`, analyticsRoutes);

app.use(errorHandler);

app.listen(Env.PORT, async () => {
  await connectDatabase();

  if (Env.NODE_ENV === "development") {
    await initializeCrons();
  }

  console.log(`Server is running on port ${Env.PORT} in ${Env.NODE_ENV} mode`);
});
