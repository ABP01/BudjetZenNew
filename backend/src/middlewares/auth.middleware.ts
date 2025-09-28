import { NextFunction, Request, Response } from "express";
import { UnauthorizedException } from "../utils/app-error";

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // For development purposes, we'll use a simple approach
    // In production, you would verify JWT tokens here
    
    const userId = req.headers['x-user-id'] as string;
    
    if (!userId) {
      // For development, use a default user ID
      // In production, this should throw an UnauthorizedException
      req.userId = "default-user-id";
    } else {
      req.userId = userId;
    }
    
    console.log(`Auth middleware: Setting userId to ${req.userId}`);
    next();
  } catch (error) {
    next(new UnauthorizedException("Authentication required"));
  }
};
