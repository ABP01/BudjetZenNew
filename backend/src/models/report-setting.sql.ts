import { SQLItem, SQLService } from "../utils/azure-sql";

export enum ReportFrequencyEnum {
  MONTHLY = "MONTHLY",
}

export interface ReportSettingDocument extends SQLItem {
  frequency: keyof typeof ReportFrequencyEnum;
  isEnabled: boolean;
  nextReportDate?: string; // ISO string
  lastSentDate?: string; // ISO string
}

export class ReportSettingModel {
  private static sqlService = new SQLService("report_settings");

  // Create report setting
  static async create(reportSettingData: {
    userId: string;
    frequency: keyof typeof ReportFrequencyEnum;
    isEnabled?: boolean;
    nextReportDate?: string;
    lastSentDate?: string;
  }): Promise<ReportSettingDocument> {
    const reportSetting: Partial<ReportSettingDocument> = {
      userId: reportSettingData.userId,
      frequency: reportSettingData.frequency,
      isEnabled: reportSettingData.isEnabled || false,
      nextReportDate: reportSettingData.nextReportDate,
      lastSentDate: reportSettingData.lastSentDate,
    };

    const createdReportSetting = await this.sqlService.create(reportSetting);
    return createdReportSetting as ReportSettingDocument;
  }

  // Find by user ID
  static async findByUserId(userId: string): Promise<ReportSettingDocument | null> {
    const results = await this.sqlService.executeQuery(
      "SELECT * FROM report_settings WHERE userId = @userId",
      { userId }
    );
    
    return results.length > 0 ? results[0] as ReportSettingDocument : null;
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
    try {
      // SQL Server doesn't have a direct update by userId, so we need to find first
      const existing = await this.findByUserId(userId);
      if (!existing) return null;

      const updatedReportSetting = await this.sqlService.update(existing.id, userId, updates);
      return updatedReportSetting as ReportSettingDocument;
    } catch (error) {
      return null;
    }
  }

  // Delete report setting
  static async deleteByUserId(userId: string): Promise<void> {
    const existing = await this.findByUserId(userId);
    if (existing) {
      await this.sqlService.delete(existing.id, userId);
    }
  }

  // Find all enabled report settings
  static async findEnabledSettings(): Promise<ReportSettingDocument[]> {
    const results = await this.sqlService.executeQuery(
      "SELECT * FROM report_settings WHERE isEnabled = 1 ORDER BY createdAt DESC"
    );

    return results as ReportSettingDocument[];
  }

  // Find settings that need to send reports
  static async findSettingsNeedingReports(currentDate: string): Promise<ReportSettingDocument[]> {
    const results = await this.sqlService.executeQuery(
      "SELECT * FROM report_settings WHERE isEnabled = 1 AND nextReportDate <= @currentDate ORDER BY nextReportDate ASC",
      { currentDate }
    );

    return results as ReportSettingDocument[];
  }

  // Upsert report setting (create or update)
  static async upsertByUserId(
    userId: string,
    reportSettingData: {
      frequency: keyof typeof ReportFrequencyEnum;
      isEnabled?: boolean;
      nextReportDate?: string;
      lastSentDate?: string;
    }
  ): Promise<ReportSettingDocument> {
    const existing = await this.findByUserId(userId);
    
    if (existing) {
      // Update existing
      const updated = await this.updateByUserId(userId, reportSettingData);
      return updated!;
    } else {
      // Create new
      return await this.create(reportSettingData);
    }
  }

  // Get settings count
  static async count(): Promise<number> {
    return await this.sqlService.count();
  }

  // Get enabled settings count
  static async countEnabled(): Promise<number> {
    const results = await this.sqlService.executeQuery(
      "SELECT COUNT(*) as count FROM report_settings WHERE isEnabled = 1"
    );

    return results[0]?.count || 0;
  }

  // Get settings by frequency
  static async findByFrequency(
    frequency: keyof typeof ReportFrequencyEnum
  ): Promise<ReportSettingDocument[]> {
    const results = await this.sqlService.executeQuery(
      "SELECT * FROM report_settings WHERE frequency = @frequency ORDER BY createdAt DESC",
      { frequency }
    );

    return results as ReportSettingDocument[];
  }

  // Get settings statistics
  static async getStatistics(): Promise<{
    total: number;
    enabled: number;
    disabled: number;
    byFrequency: { [key: string]: number };
  }> {
    const total = await this.count();
    const enabled = await this.countEnabled();
    const disabled = total - enabled;

    const frequencyResults = await this.sqlService.executeQuery(
      "SELECT frequency, COUNT(*) as count FROM report_settings GROUP BY frequency"
    );

    const byFrequency: { [key: string]: number } = {};
    frequencyResults.forEach(result => {
      byFrequency[result.frequency] = result.count;
    });

    return {
      total,
      enabled,
      disabled,
      byFrequency,
    };
  }
}

export default ReportSettingModel;
