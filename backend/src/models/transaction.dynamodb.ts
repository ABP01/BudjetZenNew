import { dynamoDB, TABLE_NAMES } from "../config/dynamodb.config";
import { DynamoDBItem, DynamoDBService } from "../utils/dynamodb";
import { convertToCents, convertToDollarUnit } from "../utils/format-currency";

export enum TransactionStatusEnum {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

export enum RecurringIntervalEnum {
  DAILY = "DAILY",
  WEEKLY = "WEEKLY",
  MONTHLY = "MONTHLY",
  YEARLY = "YEARLY",
}

export enum TransactionTypeEnum {
  INCOME = "INCOME",
  EXPENSE = "EXPENSE",
}

export enum PaymentMethodEnum {
  CARD = "CARD",
  BANK_TRANSFER = "BANK_TRANSFER",
  MOBILE_PAYMENT = "MOBILE_PAYMENT",
  AUTO_DEBIT = "AUTO_DEBIT",
  CASH = "CASH",
  OTHER = "OTHER",
}

export interface TransactionDocument extends DynamoDBItem {
  PK: string; // USER#{userId}
  SK: string; // TRANSACTION#{transactionId}
  GSI1PK: string; // USER#{userId}#TYPE#{type}
  GSI1SK: string; // DATE#{date}#TRANSACTION#{transactionId}
  GSI2PK: string; // USER#{userId}#CATEGORY#{category}
  GSI2SK: string; // DATE#{date}#TRANSACTION#{transactionId}
  userId: string;
  type: keyof typeof TransactionTypeEnum;
  title: string;
  amount: number;
  category: string;
  receiptUrl?: string;
  recurringInterval?: keyof typeof RecurringIntervalEnum;
  nextRecurringDate?: string;
  lastProcessed?: string;
  isRecurring: boolean;
  description?: string;
  date: string; // ISO string
  status: keyof typeof TransactionStatusEnum;
  paymentMethod: keyof typeof PaymentMethodEnum;
}

export class TransactionModel {
  private static dbService = new DynamoDBService(dynamoDB, TABLE_NAMES.TRANSACTIONS);

  // Create transaction
  static async create(transactionData: {
    userId: string;
    type: keyof typeof TransactionTypeEnum;
    title: string;
    amount: number;
    category: string;
    receiptUrl?: string;
    recurringInterval?: keyof typeof RecurringIntervalEnum;
    nextRecurringDate?: string;
    lastProcessed?: string;
    isRecurring?: boolean;
    description?: string;
    date?: string;
    status?: keyof typeof TransactionStatusEnum;
    paymentMethod?: keyof typeof PaymentMethodEnum;
  }): Promise<TransactionDocument> {
    const transactionId = this.dbService.generateId();
    const now = new Date().toISOString();
    const date = transactionData.date || now;
    
    // Convert amount to cents for storage
    const amountInCents = convertToCents(transactionData.amount);
    
    const transaction: Partial<TransactionDocument> = {
      PK: `USER#${transactionData.userId}`,
      SK: `TRANSACTION#${transactionId}`,
      GSI1PK: `USER#${transactionData.userId}#TYPE#${transactionData.type}`,
      GSI1SK: `DATE#${date}#TRANSACTION#${transactionId}`,
      GSI2PK: `USER#${transactionData.userId}#CATEGORY#${transactionData.category}`,
      GSI2SK: `DATE#${date}#TRANSACTION#${transactionId}`,
      userId: transactionData.userId,
      type: transactionData.type,
      title: transactionData.title,
      amount: amountInCents,
      category: transactionData.category,
      receiptUrl: transactionData.receiptUrl,
      recurringInterval: transactionData.recurringInterval,
      nextRecurringDate: transactionData.nextRecurringDate,
      lastProcessed: transactionData.lastProcessed,
      isRecurring: transactionData.isRecurring || false,
      description: transactionData.description,
      date: date,
      status: transactionData.status || TransactionStatusEnum.COMPLETED,
      paymentMethod: transactionData.paymentMethod || PaymentMethodEnum.CASH,
    };

    const createdTransaction = await this.dbService.create(transaction);
    return this.addGetters(createdTransaction);
  }

  // Find by ID
  static async findById(transactionId: string, userId: string): Promise<TransactionDocument | null> {
    const transaction = await this.dbService.getById(`USER#${userId}`, `TRANSACTION#${transactionId}`);
    return transaction ? this.addGetters(transaction) : null;
  }

  // Find all transactions for a user
  static async findByUserId(
    userId: string,
    options: {
      type?: keyof typeof TransactionTypeEnum;
      category?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
      lastKey?: any;
    } = {}
  ): Promise<{ items: TransactionDocument[]; lastKey?: any }> {
    let items: TransactionDocument[] = [];

    if (options.type) {
      // Query by type using GSI1
      const gsi1Items = await this.dbService.queryByGSI(
        "GSI1",
        `USER#${userId}#TYPE#${options.type}`
      );
      items = gsi1Items.map(item => this.addGetters(item));
    } else if (options.category) {
      // Query by category using GSI2
      const gsi2Items = await this.dbService.queryByGSI(
        "GSI2", 
        `USER#${userId}#CATEGORY#${options.category}`
      );
      items = gsi2Items.map(item => this.addGetters(item));
    } else {
      // Query all transactions for user
      items = await this.dbService.queryByPK(`USER#${userId}`);
      items = items.filter(item => item.SK.startsWith("TRANSACTION#"));
      items = items.map(item => this.addGetters(item));
    }

    // Apply date filters
    if (options.startDate || options.endDate) {
      items = items.filter(item => {
        const itemDate = new Date(item.date);
        if (options.startDate && itemDate < new Date(options.startDate)) return false;
        if (options.endDate && itemDate > new Date(options.endDate)) return false;
        return true;
      });
    }

    // Sort by date (newest first)
    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Apply limit
    if (options.limit) {
      items = items.slice(0, options.limit);
    }

    return { items, lastKey: undefined }; // Simplified pagination
  }

  // Find recurring transactions
  static async findRecurringTransactions(
    userId: string,
    beforeDate?: string
  ): Promise<TransactionDocument[]> {
    const allTransactions = await this.dbService.queryByPK(`USER#${userId}`);
    const recurringTransactions = allTransactions
      .filter(item => 
        item.SK.startsWith("TRANSACTION#") && 
        item.isRecurring === true &&
        (!beforeDate || new Date(item.nextRecurringDate || item.date) <= new Date(beforeDate))
      )
      .map(item => this.addGetters(item));

    return recurringTransactions;
  }

  // Update transaction
  static async updateById(
    transactionId: string,
    userId: string,
    updates: Partial<{
      type: keyof typeof TransactionTypeEnum;
      title: string;
      amount: number;
      category: string;
      receiptUrl: string;
      recurringInterval: keyof typeof RecurringIntervalEnum;
      nextRecurringDate: string;
      lastProcessed: string;
      isRecurring: boolean;
      description: string;
      date: string;
      status: keyof typeof TransactionStatusEnum;
      paymentMethod: keyof typeof PaymentMethodEnum;
    }>
  ): Promise<TransactionDocument | null> {
    // Convert amount to cents if provided
    if (updates.amount !== undefined) {
      updates.amount = convertToCents(updates.amount);
    }

    // Update GSI keys if type, category, or date changes
    const currentTransaction = await this.findById(transactionId, userId);
    if (!currentTransaction) return null;

    const updateData: any = { ...updates };
    
    if (updates.type || updates.date) {
      const newType = updates.type || currentTransaction.type;
      const newDate = updates.date || currentTransaction.date;
      updateData.GSI1PK = `USER#${userId}#TYPE#${newType}`;
      updateData.GSI1SK = `DATE#${newDate}#TRANSACTION#${transactionId}`;
    }

    if (updates.category || updates.date) {
      const newCategory = updates.category || currentTransaction.category;
      const newDate = updates.date || currentTransaction.date;
      updateData.GSI2PK = `USER#${userId}#CATEGORY#${newCategory}`;
      updateData.GSI2SK = `DATE#${newDate}#TRANSACTION#${transactionId}`;
    }

    const updatedTransaction = await this.dbService.update(
      `USER#${userId}`,
      `TRANSACTION#${transactionId}`,
      updateData
    );

    return this.addGetters(updatedTransaction);
  }

  // Delete transaction
  static async deleteById(transactionId: string, userId: string): Promise<void> {
    await this.dbService.delete(`USER#${userId}`, `TRANSACTION#${transactionId}`);
  }

  // Bulk delete transactions
  static async bulkDelete(transactionIds: string[], userId: string): Promise<void> {
    const deletePromises = transactionIds.map(id => 
      this.deleteById(id, userId)
    );
    await Promise.all(deletePromises);
  }

  // Bulk create transactions
  static async bulkCreate(transactions: Array<{
    userId: string;
    type: keyof typeof TransactionTypeEnum;
    title: string;
    amount: number;
    category: string;
    receiptUrl?: string;
    recurringInterval?: keyof typeof RecurringIntervalEnum;
    nextRecurringDate?: string;
    lastProcessed?: string;
    isRecurring?: boolean;
    description?: string;
    date?: string;
    status?: keyof typeof TransactionStatusEnum;
    paymentMethod?: keyof typeof PaymentMethodEnum;
  }>): Promise<TransactionDocument[]> {
    const now = new Date().toISOString();
    
    const transactionItems = transactions.map(transactionData => {
      const transactionId = this.dbService.generateId();
      const date = transactionData.date || now;
      const amountInCents = convertToCents(transactionData.amount);
      
      return {
        PK: `USER#${transactionData.userId}`,
        SK: `TRANSACTION#${transactionId}`,
        GSI1PK: `USER#${transactionData.userId}#TYPE#${transactionData.type}`,
        GSI1SK: `DATE#${date}#TRANSACTION#${transactionId}`,
        GSI2PK: `USER#${transactionData.userId}#CATEGORY#${transactionData.category}`,
        GSI2SK: `DATE#${date}#TRANSACTION#${transactionId}`,
        userId: transactionData.userId,
        type: transactionData.type,
        title: transactionData.title,
        amount: amountInCents,
        category: transactionData.category,
        receiptUrl: transactionData.receiptUrl,
        recurringInterval: transactionData.recurringInterval,
        nextRecurringDate: transactionData.nextRecurringDate,
        lastProcessed: transactionData.lastProcessed,
        isRecurring: transactionData.isRecurring || false,
        description: transactionData.description,
        date: date,
        status: transactionData.status || TransactionStatusEnum.COMPLETED,
        paymentMethod: transactionData.paymentMethod || PaymentMethodEnum.CASH,
        createdAt: now,
        updatedAt: now,
      };
    });

    await this.dbService.batchWrite(transactionItems);
    return transactionItems.map(item => this.addGetters(item));
  }

  // Add getters for amount conversion
  private static addGetters(transaction: DynamoDBItem): TransactionDocument {
    const transactionDoc = transaction as TransactionDocument;
    
    // Override amount getter to convert from cents to dollars
    Object.defineProperty(transactionDoc, 'amount', {
      get: function() {
        return convertToDollarUnit(this.amount);
      },
      enumerable: true,
      configurable: true
    });

    return transactionDoc;
  }

  // Extract transaction ID from SK
  static extractTransactionId(SK: string): string {
    return SK.replace("TRANSACTION#", "");
  }
}

export default TransactionModel;
