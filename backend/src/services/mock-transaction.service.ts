import { TransactionTypeEnum } from "../models/transaction.sql";
import { convertToDollarUnit } from "../utils/format-currency";

export const mockGetAllTransactionService = async (
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
  // Return mock data for development
  const mockTransactions = [
    {
      transactionId: "1",
      userId: userId,
      type: TransactionTypeEnum.EXPENSE,
      title: "Grocery Shopping",
      amount: convertToDollarUnit(150.00),
      category: "Food & Dining",
      date: new Date().toISOString(),
      paymentMethod: "Credit Card",
      isRecurring: false,
      description: "Weekly grocery shopping",
      status: "COMPLETED"
    },
    {
      transactionId: "2",
      userId: userId,
      type: TransactionTypeEnum.INCOME,
      title: "Salary",
      amount: convertToDollarUnit(3000.00),
      category: "Salary",
      date: new Date(Date.now() - 86400000).toISOString(), // Yesterday
      paymentMethod: "Bank Transfer",
      isRecurring: true,
      description: "Monthly salary",
      status: "COMPLETED"
    },
    {
      transactionId: "3",
      userId: userId,
      type: TransactionTypeEnum.EXPENSE,
      title: "Gas Station",
      amount: convertToDollarUnit(45.00),
      category: "Transportation",
      date: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
      paymentMethod: "Debit Card",
      isRecurring: false,
      description: "Fuel for car",
      status: "COMPLETED"
    }
  ];

  const { pageSize, pageNumber } = pagination;
  const offset = (pageNumber - 1) * pageSize;
  const totalCount = mockTransactions.length;
  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    transations: mockTransactions.slice(offset, offset + pageSize),
    pagination: {
      pageSize,
      pageNumber,
      totalCount,
      totalPages,
      skip: offset,
    },
  };
};
