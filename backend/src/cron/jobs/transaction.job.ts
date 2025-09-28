import TransactionModel from "../../models/transaction.sql";
import { calculateNextOccurrence } from "../../utils/helper";

export const processRecurringTransactions = async () => {
  const now = new Date();
  let processedCount = 0;
  let failedCount = 0;

  try {
    // Get all recurring transactions that need to be processed
    const recurringTransactions = await TransactionModel.findRecurringTransactions(
      "", // We need to get all users' recurring transactions
      now.toISOString()
    );

    console.log("Starting recurring process");

    for (const tx of recurringTransactions) {
      try {
        const nextDate = calculateNextOccurrence(
          new Date(tx.nextRecurringDate!),
          tx.recurringInterval!
        );

        // Create new transaction from recurring one
        await TransactionModel.create({
          userId: tx.userId,
          type: tx.type,
          title: `Recurring - ${tx.title}`,
          amount: tx.amount,
          category: tx.category,
          receiptUrl: tx.receiptUrl,
          description: tx.description,
          date: tx.nextRecurringDate!,
          status: tx.status,
          paymentMethod: tx.paymentMethod,
          isRecurring: false,
        });

        // Update the original recurring transaction
        await TransactionModel.updateById(tx.id, tx.userId, {
          nextRecurringDate: nextDate.toISOString(),
          lastProcessed: now.toISOString(),
        });

        processedCount++;
      } catch (error: any) {
        failedCount++;
        console.log(`Failed recurring tx: ${tx.id}`, error);
      }
    }

    console.log(`✅Processed: ${processedCount} transaction`);
    console.log(`❌ Failed: ${failedCount} transaction`);

    return {
      success: true,
      processedCount,
      failedCount,
    };
  } catch (error: any) {
    console.error("Error occur processing transaction", error);

    return {
      success: false,
      error: error?.message,
    };
  }
};
