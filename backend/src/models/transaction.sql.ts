import { SQLItem, SQLService } from "../utils/azure-sql";
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

export interface TransactionDocument extends SQLItem {
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
  private static sqlService = new SQLService("transactions");

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
    const transactionId = this.sqlService.generateId();
    const now = new Date().toISOString();
    const date = transactionData.date || now;
    
    // Convert amount to cents for storage
    const amountInCents = convertToCents(transactionData.amount);
    
    const transaction: Partial<TransactionDocument> = {
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

    const createdTransaction = await this.sqlService.create(transaction);
    return this.addGetters(createdTransaction);
  }

  // Find by ID
  static async findById(transactionId: string, userId: string): Promise<TransactionDocument | null> {
    const transaction = await this.sqlService.getById(transactionId, userId);
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
      offset?: number;
    } = {}
  ): Promise<{ items: TransactionDocument[]; total: number }> {
    const filters: { field: string; operator: string; value: any }[] = [];

    // Add filters
    if (options.type) {
      filters.push({ field: "type", operator: "=", value: options.type });
    }

    if (options.category) {
      filters.push({ field: "category", operator: "=", value: options.category });
    }

    if (options.startDate) {
      filters.push({ field: "date", operator: ">=", value: options.startDate });
    }

    if (options.endDate) {
      filters.push({ field: "date", operator: "<=", value: options.endDate });
    }

    // Get total count
    const total = await this.sqlService.count(userId);

    // Get items with pagination
    const items = await this.sqlService.queryWithFilters(
      userId,
      filters,
      "date DESC",
      options.limit,
      options.offset
    );

    return {
      items: items.map(item => this.addGetters(item)),
      total,
    };
  }

  // Find recurring transactions
  static async findRecurringTransactions(
    userId: string,
    beforeDate?: string
  ): Promise<TransactionDocument[]> {
    const filters: { field: string; operator: string; value: any }[] = [
      { field: "isRecurring", operator: "=", value: true }
    ];

    if (beforeDate) {
      filters.push({ field: "nextRecurringDate", operator: "<=", value: beforeDate });
    }

    const items = await this.sqlService.queryWithFilters(userId, filters, "date DESC");
    return items.map(item => this.addGetters(item));
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

    try {
      const updatedTransaction = await this.sqlService.update(transactionId, userId, updates);
      return updatedTransaction ? this.addGetters(updatedTransaction) : null;
    } catch (error) {
      return null;
    }
  }

  // Delete transaction
  static async deleteById(transactionId: string, userId: string): Promise<void> {
    await this.sqlService.delete(transactionId, userId);
  }

  // Bulk delete transactions
  static async bulkDelete(transactionIds: string[], userId: string): Promise<void> {
    await this.sqlService.bulkDelete(transactionIds, userId);
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
      const transactionId = this.sqlService.generateId();
      const date = transactionData.date || now;
      const amountInCents = convertToCents(transactionData.amount);
      
      return {
        id: transactionId,
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
        createdAt: new Date(now),
        updatedAt: new Date(now),
      };
    });

    await this.sqlService.bulkInsert(transactionItems);
    return transactionItems.map(item => this.addGetters(item));
  }

  // Get transactions by category
  static async findByCategory(
    userId: string,
    category: string,
    limit: number = 10
  ): Promise<TransactionDocument[]> {
    const items = await this.sqlService.queryWithFilters(
      userId,
      [{ field: "category", operator: "=", value: category }],
      "date DESC",
      limit
    );

    return items.map(item => this.addGetters(item));
  }

  // Get transactions by type
  static async findByType(
    userId: string,
    type: keyof typeof TransactionTypeEnum,
    limit: number = 10
  ): Promise<TransactionDocument[]> {
    const items = await this.sqlService.queryWithFilters(
      userId,
      [{ field: "type", operator: "=", value: type }],
      "date DESC",
      limit
    );

    return items.map(item => this.addGetters(item));
  }

  // Add getters for amount conversion
  private static addGetters(transaction: SQLItem): TransactionDocument {
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

  // Get transaction statistics
  static async getStatistics(
    userId: string,
    startDate?: string,
    endDate?: string
  ): Promise<{
    totalIncome: number;
    totalExpense: number;
    transactionCount: number;
    averageAmount: number;
  }> {
    let query = `
      SELECT 
        type,
        SUM(amount) as totalAmount,
        COUNT(*) as count
      FROM transactions 
      WHERE userId = @userId
    `;
    
    const params: { [key: string]: any } = { userId };

    if (startDate) {
      query += " AND date >= @startDate";
      params.startDate = startDate;
    }

    if (endDate) {
      query += " AND date <= @endDate";
      params.endDate = endDate;
    }

    query += " GROUP BY type";

    const results = await this.sqlService.executeQuery(query, params);
    
    let totalIncome = 0;
    let totalExpense = 0;
    let transactionCount = 0;

    results.forEach(result => {
      const amount = convertToDollarUnit(result.totalAmount);
      transactionCount += result.count;
      
      if (result.type === TransactionTypeEnum.INCOME) {
        totalIncome += amount;
      } else {
        totalExpense += amount;
      }
    });

    const averageAmount = transactionCount > 0 ? (totalIncome + totalExpense) / transactionCount : 0;

    return {
      totalIncome,
      totalExpense,
      transactionCount,
      averageAmount,
    };
  }

  // Get monthly statistics
  static async getMonthlyStatistics(
    userId: string,
    year: number
  ): Promise<Array<{
    month: number;
    monthName: string;
    totalIncome: number;
    totalExpenses: number;
    netIncome: number;
    transactionCount: number;
  }>> {
    const query = `
      SELECT 
        MONTH(date) as month,
        SUM(CASE WHEN type = 'INCOME' THEN amount ELSE 0 END) as totalIncome,
        SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0 END) as totalExpenses,
        COUNT(*) as transactionCount
      FROM transactions 
      WHERE userId = @userId AND YEAR(date) = @year
      GROUP BY MONTH(date)
      ORDER BY MONTH(date)
    `;

    const results = await this.sqlService.executeQuery(query, { userId, year });
    
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    return results.map(result => ({
      month: result.month,
      monthName: monthNames[result.month - 1],
      totalIncome: convertToDollarUnit(result.totalIncome),
      totalExpenses: convertToDollarUnit(result.totalExpenses),
      netIncome: convertToDollarUnit(result.totalIncome) - convertToDollarUnit(result.totalExpenses),
      transactionCount: result.transactionCount,
    }));
  }
}

export default TransactionModel;
