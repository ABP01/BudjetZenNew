import { endOfMonth, startOfMonth, subMonths } from "date-fns";
import { sendReportEmail } from "../../mailers/report.mailer";
import ReportSettingModel from "../../models/report-setting.dynamodb";
import ReportModel, { ReportStatusEnum } from "../../models/report.dynamodb";
import UserModel from "../../models/user.dynamodb";
import { generateReportService } from "../../services/report.dynamodb";
import { calulateNextReportDate } from "../../utils/helper";

export const processReportJob = async () => {
  const now = new Date();

  let processedCount = 0;
  let failedCount = 0;

  //Today july 1, then run report for -> june 1 - 30 
  //Get Last Month because this will run on the first of the month
  const from = startOfMonth(subMonths(now, 1));
  const to = endOfMonth(subMonths(now, 1));

  try {
    console.log("Running report");

    // Get all report settings that need to send reports
    const reportSettings = await ReportSettingModel.findSettingsNeedingReports(now.toISOString());

    console.log(`Found ${reportSettings.length} report settings to process`);

    for (const setting of reportSettings) {
      try {
        // Get user details
        const user = await UserModel.findById(setting.userId);
        if (!user) {
          console.log(`User not found for setting: ${setting.userId}`);
          continue;
        }

        // Generate report
        const report = await generateReportService(user.userId);

        console.log(report, "report data");

        let emailSent = false;
        if (report) {
          try {
            await sendReportEmail({
              email: user.email,
              username: user.name,
              report: {
                period: report.period,
                totalIncome: report.analytics.totalIncome,
                totalExpenses: report.analytics.totalExpenses,
                availableBalance: report.analytics.netIncome,
                savingsRate: report.analytics.netIncome > 0 
                  ? ((report.analytics.netIncome / report.analytics.totalIncome) * 100).toFixed(1)
                  : "0",
                topSpendingCategories: report.analytics.topCategories,
                insights: report.aiInsights,
              },
              frequency: setting.frequency,
            });
            emailSent = true;
          } catch (error) {
            console.log(`Email failed for ${user.userId}`);
          }
        }

        // Update report status
        if (report) {
          await ReportModel.updateById(
            ReportModel.extractReportId(report.report.SK),
            user.userId,
            {
              status: emailSent ? ReportStatusEnum.SENT : ReportStatusEnum.FAILED,
            }
          );
        }

        // Update report setting
        await ReportSettingModel.updateByUserId(setting.userId, {
          lastSentDate: now.toISOString(),
          nextReportDate: calulateNextReportDate(now),
        });

        processedCount++;
        console.log(`Processed report for user: ${user.name}`);
      } catch (error) {
        console.log(`Failed to process report for user ${setting.userId}`, error);
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
