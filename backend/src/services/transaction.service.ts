import { createPartFromBase64, createUserContent } from "@google/genai";
import axios from "axios";
import { genAI, genAIModel } from "../config/google-ai.config";
import TransactionModel, {
  TransactionTypeEnum,
} from "../models/transaction.sql";
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
    lastProcessed: undefined,
    date: body.date ? (typeof body.date === 'string' ? body.date : body.date.toISOString()) : new Date().toISOString(),
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

  const options: any = {
    limit: pageSize,
    offset: offset,
  };

  // Add filters
  if (filters.type) {
    options.type = filters.type;
  }

  if (filters.recurringStatus) {
    options.isRecurring = filters.recurringStatus === "RECURRING";
  }

  const result = await TransactionModel.findByUserId(userId, options);
  const totalPages = Math.ceil(result.total / pageSize);

  return {
    transations: result.items,
    pagination: {
      pageSize,
      pageNumber,
      totalCount: result.total,
      totalPages,
      skip: offset,
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

export const duplicateTransactionService = async (
  userId: string,
  transactionId: string
) => {
  const transaction = await TransactionModel.findById(transactionId, userId);
  if (!transaction) throw new NotFoundException("Transaction not found");

  const duplicated = await TransactionModel.create({
    userId: transaction.userId,
    type: transaction.type,
    title: `Duplicate - ${transaction.title}`,
    amount: transaction.amount,
    category: transaction.category,
    receiptUrl: transaction.receiptUrl,
    description: transaction.description
      ? `${transaction.description} (Duplicate)`
      : "Duplicated transaction",
    date: transaction.date,
    status: transaction.status,
    paymentMethod: transaction.paymentMethod,
    isRecurring: false,
    recurringInterval: undefined,
    nextRecurringDate: undefined,
  });

  return duplicated;
};

export const updateTransactionService = async (
  userId: string,
  transactionId: string,
  body: UpdateTransactionType
) => {
  const existingTransaction = await TransactionModel.findById(transactionId, userId);
  if (!existingTransaction)
    throw new NotFoundException("Transaction not found");

  const now = new Date();
  const isRecurring = body.isRecurring ?? existingTransaction.isRecurring;

  const date =
    body.date !== undefined ? body.date : existingTransaction.date;

  const recurringInterval =
    body.recurringInterval || existingTransaction.recurringInterval;

  let nextRecurringDate: string | undefined;

  if (isRecurring && recurringInterval) {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const calulatedDate = calculateNextOccurrence(dateObj, recurringInterval);

    nextRecurringDate =
      calulatedDate < now
        ? calculateNextOccurrence(now, recurringInterval).toISOString()
        : calulatedDate.toISOString();
  }

  const updates: any = {};
  if (body.title) updates.title = body.title;
  if (body.description) updates.description = body.description;
  if (body.category) updates.category = body.category;
  if (body.type) updates.type = body.type;
  if (body.paymentMethod) updates.paymentMethod = body.paymentMethod;
  if (body.amount !== undefined) updates.amount = Number(body.amount);
  updates.date = date;
  updates.isRecurring = isRecurring;
  updates.recurringInterval = recurringInterval;
  updates.nextRecurringDate = nextRecurringDate;

  await TransactionModel.updateById(transactionId, userId, updates);

  return;
};

export const deleteTransactionService = async (
  userId: string,
  transactionId: string
) => {
  const existing = await TransactionModel.findById(transactionId, userId);
  if (!existing) throw new NotFoundException("Transaction not found");

  await TransactionModel.deleteById(transactionId, userId);
  return;
};

export const bulkDeleteTransactionService = async (
  userId: string,
  transactionIds: string[]
) => {
  await TransactionModel.bulkDelete(transactionIds, userId);

  return {
    sucess: true,
    deletedCount: transactionIds.length,
  };
};

export const bulkTransactionService = async (
  userId: string,
  transactions: CreateTransactionType[]
) => {
  try {
    const transactionData = transactions.map((tx) => ({
      ...tx,
      userId,
      isRecurring: false,
      nextRecurringDate: undefined,
      recurringInterval: undefined,
      lastProcessed: undefined,
      date: tx.date ? (typeof tx.date === 'string' ? tx.date : tx.date.toISOString()) : new Date().toISOString(),
    }));

    const result = await TransactionModel.bulkCreate(transactionData);

    return {
      insertedCount: result.length,
      success: true,
    };
  } catch (error) {
    throw error;
  }
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
        temperature: 0,
        topP: 1,
        responseMimeType: "application/json",
      },
    });

    const response = result.text;
    const cleanedText = response?.replace(/```(?:json)?\n?/g, "").trim();

    if (!cleanedText)
      return {
        error: "Could not read reciept  content",
      };

    const data = JSON.parse(cleanedText);

    if (!data.amount || !data.date) {
      return { error: "Reciept missing required information" };
    }

    return {
      title: data.title || "Receipt",
      amount: data.amount,
      date: data.date,
      description: data.description,
      category: data.category,
      paymentMethod: data.paymentMethod,
      type: data.type,
      receiptUrl: file.path,
    };
  } catch (error) {
    return { error: "Reciept scanning  service unavailable" };
  }
};
