import TransactionModel from "../../models/transaction.dynamodb";
import { calculateNextOccurrence } from "../../utils/helper";

export const processRecurringTransactions = async () => {
  const now = new Date();
  let processedCount = 0;
  let failedCount = 0;

  try {
    console.log("Starting recurring process");

    // Get all recurring transactions that need to be processed
    const recurringTransactions = await TransactionModel.findRecurringTransactions(
      "", // We need to get all users' transactions
      now.toISOString()
    );

    console.log(`Found ${recurringTransactions.length} recurring transactions to process`);

    for (const tx of recurringTransactions) {
      try {
        const nextDate = calculateNextOccurrence(
          new Date(tx.nextRecurringDate!),
          tx.recurringInterval!
        );

        // Create new transaction
        const newTransaction = await TransactionModel.create({
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

        // Update original transaction
        await TransactionModel.updateById(
          TransactionModel.extractTransactionId(tx.SK),
          tx.userId,
          {
            nextRecurringDate: nextDate.toISOString(),
            lastProcessed: now.toISOString(),
          }
        );

        processedCount++;
        console.log(`Processed recurring transaction: ${tx.title}`);
      } catch (error: any) {
        failedCount++;
        console.log(`Failed recurring tx: ${tx.SK}`, error);
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
