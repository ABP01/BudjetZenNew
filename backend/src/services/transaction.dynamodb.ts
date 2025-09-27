import { createPartFromBase64, createUserContent } from "@google/genai";
import axios from "axios";
import { genAI, genAIModel } from "../config/google-ai.config";
import TransactionModel, {
    TransactionTypeEnum,
} from "../models/transaction.dynamodb";
import { BadRequestException, NotFoundException } from "../utils/app-error";
import { calculateNextOccurrence } from "../utils/helper";
import { receiptPrompt } from "../utils/prompt";
import {
    CreateTransactionType,
    UpdateTransactionType,
} from "../validators/transaction.validator";

export const createTransactionService = async (
  body: CreateTransactionType,
  userId: string
) => {
  let nextRecurringDate: string | undefined;
  const currentDate = new Date();

  if (body.isRecurring && body.recurringInterval) {
    const calulatedDate = calculateNextOccurrence(
      body.date,
      body.recurringInterval
    );

    nextRecurringDate =
      calulatedDate < currentDate
        ? calculateNextOccurrence(currentDate, body.recurringInterval).toISOString()
        : calulatedDate.toISOString();
  }

  const transaction = await TransactionModel.create({
    ...body,
    userId,
    category: body.category,
    amount: Number(body.amount),
    isRecurring: body.isRecurring || false,
    recurringInterval: body.recurringInterval || undefined,
    nextRecurringDate,
    lastProcessed: null,
    date: body.date.toISOString(),
  });

  return transaction;
};

export const getAllTransactionService = async (
  userId: string,
  filters: {
    keyword?: string;
    type?: keyof typeof TransactionTypeEnum;
    recurringStatus?: "RECURRING" | "NON_RECURRING";
  },
  pagination: {
    pageSize: number;
    pageNumber: number;
  }
) => {
  const { pageSize, pageNumber } = pagination;
  const offset = (pageNumber - 1) * pageSize;

  let transactions = await TransactionModel.findByUserId(userId, {
    type: filters.type,
    limit: pageSize * 2, // Get more to filter
  });

  // Apply filters
  if (filters.keyword) {
    transactions = transactions.filter(transaction =>
      transaction.title.toLowerCase().includes(filters.keyword!.toLowerCase()) ||
      transaction.description?.toLowerCase().includes(filters.keyword!.toLowerCase()) ||
      transaction.category.toLowerCase().includes(filters.keyword!.toLowerCase())
    );
  }

  if (filters.recurringStatus) {
    const isRecurring = filters.recurringStatus === "RECURRING";
    transactions = transactions.filter(transaction => transaction.isRecurring === isRecurring);
  }

  // Sort by date (newest first)
  transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Apply pagination
  const paginatedTransactions = transactions.slice(offset, offset + pageSize);
  const totalCount = transactions.length;
  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    transactions: paginatedTransactions,
    pagination: {
      currentPage: pageNumber,
      totalPages,
      totalCount,
      pageSize,
    },
  };
};

export const getTransactionByIdService = async (
  userId: string,
  transactionId: string
) => {
  const transaction = await TransactionModel.findById(transactionId, userId);
  if (!transaction) throw new NotFoundException("Transaction not found");

  return transaction;
};

export const updateTransactionService = async (
  userId: string,
  transactionId: string,
  body: UpdateTransactionType
) => {
  const transaction = await TransactionModel.findById(transactionId, userId);
  if (!transaction) throw new NotFoundException("Transaction not found");

  const updates: any = { ...body };
  
  if (body.date) {
    updates.date = body.date.toISOString();
  }

  if (body.amount !== undefined) {
    updates.amount = Number(body.amount);
  }

  const updatedTransaction = await TransactionModel.updateById(
    transactionId,
    userId,
    updates
  );

  if (!updatedTransaction) throw new NotFoundException("Transaction not found");

  return updatedTransaction;
};

export const deleteTransactionService = async (
  userId: string,
  transactionId: string
) => {
  const transaction = await TransactionModel.findById(transactionId, userId);
  if (!transaction) throw new NotFoundException("Transaction not found");

  await TransactionModel.deleteById(transactionId, userId);
};

export const bulkDeleteTransactionService = async (
  userId: string,
  transactionIds: string[]
) => {
  const results = {
    deletedCount: 0,
    failedCount: 0,
    errors: [] as string[],
  };

  for (const transactionId of transactionIds) {
    try {
      const transaction = await TransactionModel.findById(transactionId, userId);
      if (transaction) {
        await TransactionModel.deleteById(transactionId, userId);
        results.deletedCount++;
      } else {
        results.failedCount++;
        results.errors.push(`Transaction ${transactionId} not found`);
      }
    } catch (error) {
      results.failedCount++;
      results.errors.push(`Failed to delete transaction ${transactionId}: ${error}`);
    }
  }

  return results;
};

export const bulkTransactionService = async (
  userId: string,
  transactions: CreateTransactionType[]
) => {
  const results = {
    createdCount: 0,
    failedCount: 0,
    errors: [] as string[],
  };

  try {
    const transactionData = transactions.map(transaction => ({
      ...transaction,
      userId,
      amount: Number(transaction.amount),
      date: transaction.date.toISOString(),
    }));

    const createdTransactions = await TransactionModel.bulkCreate(transactionData);
    results.createdCount = createdTransactions.length;
  } catch (error) {
    results.failedCount = transactions.length;
    results.errors.push(`Bulk create failed: ${error}`);
  }

  return results;
};

export const duplicateTransactionService = async (
  userId: string,
  transactionId: string
) => {
  const originalTransaction = await TransactionModel.findById(transactionId, userId);
  if (!originalTransaction) throw new NotFoundException("Transaction not found");

  const duplicatedTransaction = await TransactionModel.create({
    userId: originalTransaction.userId,
    type: originalTransaction.type,
    title: `Copy of ${originalTransaction.title}`,
    amount: originalTransaction.amount,
    category: originalTransaction.category,
    receiptUrl: originalTransaction.receiptUrl,
    description: originalTransaction.description,
    date: new Date().toISOString(),
    status: originalTransaction.status,
    paymentMethod: originalTransaction.paymentMethod,
    isRecurring: false, // Duplicated transactions are not recurring
  });

  return duplicatedTransaction;
};

export const scanReceiptService = async (
  file: Express.Multer.File | undefined
) => {
  if (!file) throw new BadRequestException("No file uploaded");

  try {
    if (!file.path) throw new BadRequestException("failed to upload file");

    console.log(file.path);

    const responseData = await axios.get(file.path, {
      responseType: "arraybuffer",
    });
    const base64String = Buffer.from(responseData.data).toString("base64");

    if (!base64String) throw new BadRequestException("Could not process file");

    const result = await genAI.models.generateContent({
      model: genAIModel,
      contents: [
        createUserContent([
          receiptPrompt,
          createPartFromBase64(base64String, file.mimetype),
        ]),
      ],
      config: {
        temperature: 0.1,
        maxOutputTokens: 1000,
      },
    });

    const response = await result.response;
    const text = response.text();

    if (!text) throw new BadRequestException("Could not extract data from receipt");

    try {
      const extractedData = JSON.parse(text);
      return extractedData;
    } catch (parseError) {
      throw new BadRequestException("Could not parse extracted data");
    }
  } catch (error) {
    console.error("Receipt scanning error:", error);
    throw new BadRequestException("Failed to scan receipt");
  }
};
