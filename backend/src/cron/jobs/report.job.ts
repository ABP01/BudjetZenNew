import { endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { sendReportEmail } from "../../mailers/report.mailer";
import ReportSettingModel from "../../models/report-setting.sql";
import ReportModel, { ReportStatusEnum } from "../../models/report.sql";
import UserModel from "../../models/user.sql";
import { generateReportService } from "../../services/report.service";
import { calulateNextReportDate } from "../../utils/helper";

export const processReportJob = async () => {
  const now = new Date();

  let processedCount = 0;
  let failedCount = 0;

  //Today july 1, then run report for -> june 1 - 30 
//Get Last Month because this will run on the first of the month
  const from = startOfMonth(subMonths(now, 1));
  const to = endOfMonth(subMonths(now, 1));

  // const from = "2025-04-01T23:00:00.000Z";
  // const to = "2025-04-T23:00:00.000Z";

  try {
    const reportSettings = await ReportSettingModel.findSettingsNeedingReports(now.toISOString());

    console.log("Running report ");

    for (const setting of reportSettings) {
      const user = await UserModel.findById(setting.userId);
      if (!user) {
        console.log(`User not found for setting: ${setting.id}`);
        continue;
      }

      try {
        const report = await generateReportService(user.userId, from, to);

        console.log(report, "resport data");

        let emailSent = false;
        if (report) {
          try {
            await sendReportEmail({
              email: user.email!,
              username: user.name!,
              report: {
                period: report.period,
                totalIncome: report.summary.income,
                totalExpenses: report.summary.expenses,
                availableBalance: report.summary.balance,
                savingsRate: report.summary.savingsRate,
                topSpendingCategories: report.summary.topCategories,
                insights: report.insights,
              },
              frequency: setting.frequency!,
            });
            emailSent = true;
          } catch (error) {
            console.log(`Email failed for ${user.id}`);
          }
        }

        if (report && emailSent) {
          // Create report record
          await ReportModel.create({
            userId: user.userId,
            period: report.period,
            sentDate: now.toISOString(),
            status: ReportStatusEnum.SENT,
          });

          // Update report setting
          await ReportSettingModel.updateByUserId(user.userId, {
            lastSentDate: now.toISOString(),
            nextReportDate: calulateNextReportDate(now).toISOString(),
          });
        } else {
          // Create failed report record
          await ReportModel.create({
            userId: user.userId,
            period: report?.period || `${format(from, "MMMM d")}–${format(to, "d, yyyy")}`,
            sentDate: now.toISOString(),
            status: report ? ReportStatusEnum.FAILED : ReportStatusEnum.PENDING,
          });

          // Update report setting for next attempt
          await ReportSettingModel.updateByUserId(user.userId, {
            lastSentDate: undefined,
            nextReportDate: calulateNextReportDate(now).toISOString(),
          });
        }

        processedCount++;
      } catch (error) {
        console.log(`Failed to process report`, error);
        failedCount++;
      }
    }

    console.log(`✅Processed: ${processedCount} report`);
    console.log(`❌ Failed: ${failedCount} report`);

    return {
      success: true,
      processedCount,
      failedCount,
    };
  } catch (error) {
    console.error("Error processing reports", error);
    return {
      success: false,
      error: "Report process failed",
    };
  }
};
