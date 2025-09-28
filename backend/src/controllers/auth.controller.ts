import { Request, Response } from "express";
import { HTTPSTATUS } from "../config/http.config";
import { asyncHandler } from "../middlewares/asyncHandler.middlerware";
import { loginService, registerService } from "../services/auth.service";
import { loginSchema, registerSchema } from "../validators/auth.validator";

export const registerController = asyncHandler(
  async (req: Request, res: Response) => {
    const body = registerSchema.parse(req.body);

    const result = await registerService(body);

    return res.status(HTTPSTATUS.CREATED).json({
      message: "User registered successfully",
      data: result,
    });
  }
);

export const loginController = asyncHandler(
  async (req: Request, res: Response) => {
    const body = loginSchema.parse({
      ...req.body,
    });
    const { user, reportSetting } = await loginService(body);

    return res.status(HTTPSTATUS.OK).json({
      message: "User logged in successfully",
      user,
      reportSetting,
    });
  }
);
