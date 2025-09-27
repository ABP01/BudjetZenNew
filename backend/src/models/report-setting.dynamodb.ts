import { dynamoDB, TABLE_NAMES } from "../config/dynamodb.config";
import { DynamoDBItem, DynamoDBService } from "../utils/dynamodb";

export enum ReportFrequencyEnum {
  MONTHLY = "MONTHLY",
}

export interface ReportSettingDocument extends DynamoDBItem {
  PK: string; // USER#{userId}
  SK: string; // REPORT_SETTING#{userId} (same as PK for single item)
  userId: string;
  frequency: keyof typeof ReportFrequencyEnum;
  isEnabled: boolean;
  nextReportDate?: string; // ISO string
  lastSentDate?: string; // ISO string
}

export class ReportSettingModel {
  private static dbService = new DynamoDBService(dynamoDB, TABLE_NAMES.REPORT_SETTINGS);

  // Create report setting
  static async create(reportSettingData: {
    userId: string;
    frequency: keyof typeof ReportFrequencyEnum;
    isEnabled?: boolean;
    nextReportDate?: string;
    lastSentDate?: string;
  }): Promise<ReportSettingDocument> {
    const reportSetting: Partial<ReportSettingDocument> = {
      PK: `USER#${reportSettingData.userId}`,
      SK: `REPORT_SETTING#${reportSettingData.userId}`,
      userId: reportSettingData.userId,
      frequency: reportSettingData.frequency,
      isEnabled: reportSettingData.isEnabled || false,
      nextReportDate: reportSettingData.nextReportDate,
      lastSentDate: reportSettingData.lastSentDate,
    };

    const createdReportSetting = await this.dbService.create(reportSetting);
    return createdReportSetting as ReportSettingDocument;
  }

  // Find by user ID
  static async findByUserId(userId: string): Promise<ReportSettingDocument | null> {
    const reportSetting = await this.dbService.getById(`USER#${userId}`, `REPORT_SETTING#${userId}`);
    return reportSetting as ReportSettingDocument | null;
  }

  // Update report setting
  static async updateByUserId(
    userId: string,
    updates: Partial<{
      frequency: keyof typeof ReportFrequencyEnum;
      isEnabled: boolean;
      nextReportDate: string;
      lastSentDate: string;
    }>
  ): Promise<ReportSettingDocument | null> {
    const updatedReportSetting = await this.dbService.update(
      `USER#${userId}`,
      `REPORT_SETTING#${userId}`,
      updates
    );

    return updatedReportSetting as ReportSettingDocument;
  }

  // Delete report setting
  static async deleteByUserId(userId: string): Promise<void> {
    await this.dbService.delete(`USER#${userId}`, `REPORT_SETTING#${userId}`);
  }

  // Find all enabled report settings
  static async findEnabledSettings(): Promise<ReportSettingDocument[]> {
    const allSettings = await this.dbService.scan(
      "isEnabled = :enabled",
      { ":enabled": true }
    );

    return allSettings as ReportSettingDocument[];
  }

  // Find settings that need to send reports
  static async findSettingsNeedingReports(currentDate: string): Promise<ReportSettingDocument[]> {
    const allSettings = await this.dbService.scan(
      "isEnabled = :enabled AND nextReportDate <= :currentDate",
      { 
        ":enabled": true,
        ":currentDate": currentDate
      }
    );

    return allSettings as ReportSettingDocument[];
  }

  // Extract user ID from PK
  static extractUserId(PK: string): string {
    return PK.replace("USER#", "");
  }
}

export default ReportSettingModel;
