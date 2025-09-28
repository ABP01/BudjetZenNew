import { Request, Response } from "express";
import { HTTPSTATUS } from "../config/http.config";
import { asyncHandler } from "../middlewares/asyncHandler.middlerware";
import {
    findByIdUserService,
    updateUserService,
} from "../services/user.service";
import { updateUserSchema } from "../validators/user.validator";

export const getCurrentUserController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.params.userId || req.body.userId;
    if (!userId) throw new Error("User ID is required");

    const user = await findByIdUserService(userId);
    return res.status(HTTPSTATUS.OK).json({
      message: "User fetched successfully",
      user,
    });
  }
);

export const updateUserController = asyncHandler(
  async (req: Request, res: Response) => {
    const body = updateUserSchema.parse(req.body);
    const userId = req.params.userId || req.body.userId;
    if (!userId) throw new Error("User ID is required");
    const profilePic = req.file;

    const user = await updateUserService(userId, body, profilePic);

    return res.status(HTTPSTATUS.OK).json({
      message: "User profile updated successfully",
      data: user,
    });
  }
);
