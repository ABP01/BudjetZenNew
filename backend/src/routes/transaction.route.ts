import { Router } from "express";
import { upload } from "../config/cloudinary.config";
import {
    bulkDeleteTransactionController,
    bulkTransactionController,
    createTransactionController,
    deleteTransactionController,
    duplicateTransactionController,
    getAllTransactionController,
    getTransactionByIdController,
    scanReceiptController,
    updateTransactionController,
} from "../controllers/transaction.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

const transactionRoutes = Router();

// Apply auth middleware to all transaction routes
transactionRoutes.use(authMiddleware);

transactionRoutes.post("/create", createTransactionController);

transactionRoutes.post(
  "/scan-receipt",
  upload.single("receipt"),
  scanReceiptController
);

transactionRoutes.post("/bulk-transaction", bulkTransactionController);

transactionRoutes.put("/duplicate/:id", duplicateTransactionController);
transactionRoutes.put("/update/:id", updateTransactionController);

transactionRoutes.get("/all", getAllTransactionController);
transactionRoutes.delete("/delete/:id", deleteTransactionController);
transactionRoutes.delete("/bulk-delete", bulkDeleteTransactionController);
transactionRoutes.get("/:id", getTransactionByIdController);

export default transactionRoutes;
