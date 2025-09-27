import { SQLItem, SQLService } from "../utils/azure-sql";

export enum ReportStatusEnum {
  PENDING = "PENDING",
  SENT = "SENT",
  FAILED = "FAILED",
}

export interface ReportDocument extends SQLItem {
  period: string;
  sentDate: string; // ISO string
  status: keyof typeof ReportStatusEnum;
}

export class ReportModel {
  private static sqlService = new SQLService("reports");

  // Create report
  static async create(reportData: {
    userId: string;
    period: string;
    sentDate: string;
    status?: keyof typeof ReportStatusEnum;
  }): Promise<ReportDocument> {
    const reportId = this.sqlService.generateId();
    
    const report: Partial<ReportDocument> = {
      userId: reportData.userId,
      period: reportData.period,
      sentDate: reportData.sentDate,
      status: reportData.status || ReportStatusEnum.PENDING,
    };

    const createdReport = await this.sqlService.create(report);
    return createdReport as ReportDocument;
  }

  // Find by ID
  static async findById(reportId: string, userId: string): Promise<ReportDocument | null> {
    const report = await this.sqlService.getById(reportId, userId);
    return report as ReportDocument | null;
  }

  // Find all reports for a user
  static async findByUserId(
    userId: string,
    options: {
      status?: keyof typeof ReportStatusEnum;
      limit?: number;
    } = {}
  ): Promise<ReportDocument[]> {
    const filters: { field: string; operator: string; value: any }[] = [];

    if (options.status) {
      filters.push({ field: "status", operator: "=", value: options.status });
    }

    const items = await this.sqlService.queryWithFilters(
      userId,
      filters,
      "sentDate DESC",
      options.limit
    );

    return items as ReportDocument[];
  }

  // Update report
  static async updateById(
    reportId: string,
    userId: string,
    updates: Partial<{
      status: keyof typeof ReportStatusEnum;
      sentDate: string;
    }>
  ): Promise<ReportDocument | null> {
    try {
      const updatedReport = await this.sqlService.update(reportId, userId, updates);
      return updatedReport as ReportDocument;
    } catch (error) {
      return null;
    }
  }

  // Delete report
  static async deleteById(reportId: string, userId: string): Promise<void> {
    await this.sqlService.delete(reportId, userId);
  }

  // Get reports by status
  static async findByStatus(
    userId: string,
    status: keyof typeof ReportStatusEnum
  ): Promise<ReportDocument[]> {
    const items = await this.sqlService.queryWithFilters(
      userId,
      [{ field: "status", operator: "=", value: status }],
      "sentDate DESC"
    );

    return items as ReportDocument[];
  }

  // Get latest report for user
  static async findLatestByUserId(userId: string): Promise<ReportDocument | null> {
    const items = await this.sqlService.queryWithFilters(
      userId,
      [],
      "sentDate DESC",
      1
    );

    return items.length > 0 ? items[0] as ReportDocument : null;
  }

  // Count reports by status
  static async countByStatus(
    userId: string,
    status: keyof typeof ReportStatusEnum
  ): Promise<number> {
    const results = await this.sqlService.executeQuery(
      "SELECT COUNT(*) as count FROM reports WHERE userId = @userId AND status = @status",
      { userId, status }
    );

    return results[0]?.count || 0;
  }

  // Get all reports needing processing
  static async findReportsNeedingProcessing(): Promise<ReportDocument[]> {
    const results = await this.sqlService.executeQuery(`
      SELECT r.* FROM reports r
      INNER JOIN report_settings rs ON r.userId = rs.userId
      WHERE rs.isEnabled = 1 AND r.status = 'PENDING'
      ORDER BY r.sentDate ASC
    `);

    return results as ReportDocument[];
  }
}

export default ReportModel;
