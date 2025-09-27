import { dynamoDB, TABLE_NAMES } from "../config/dynamodb.config";
import { DynamoDBItem, DynamoDBService } from "../utils/dynamodb";

export enum ReportStatusEnum {
  PENDING = "PENDING",
  SENT = "SENT",
  FAILED = "FAILED",
}

export interface ReportDocument extends DynamoDBItem {
  PK: string; // USER#{userId}
  SK: string; // REPORT#{reportId}
  GSI1PK: string; // USER#{userId}#STATUS#{status}
  GSI1SK: string; // DATE#{sentDate}#REPORT#{reportId}
  userId: string;
  period: string;
  sentDate: string; // ISO string
  status: keyof typeof ReportStatusEnum;
}

export class ReportModel {
  private static dbService = new DynamoDBService(dynamoDB, TABLE_NAMES.REPORTS);

  // Create report
  static async create(reportData: {
    userId: string;
    period: string;
    sentDate: string;
    status?: keyof typeof ReportStatusEnum;
  }): Promise<ReportDocument> {
    const reportId = this.dbService.generateId();
    
    const report: Partial<ReportDocument> = {
      PK: `USER#${reportData.userId}`,
      SK: `REPORT#${reportId}`,
      GSI1PK: `USER#${reportData.userId}#STATUS#${reportData.status || ReportStatusEnum.PENDING}`,
      GSI1SK: `DATE#${reportData.sentDate}#REPORT#${reportId}`,
      userId: reportData.userId,
      period: reportData.period,
      sentDate: reportData.sentDate,
      status: reportData.status || ReportStatusEnum.PENDING,
    };

    const createdReport = await this.dbService.create(report);
    return createdReport as ReportDocument;
  }

  // Find by ID
  static async findById(reportId: string, userId: string): Promise<ReportDocument | null> {
    const report = await this.dbService.getById(`USER#${userId}`, `REPORT#${reportId}`);
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
    let items: DynamoDBItem[] = [];

    if (options.status) {
      // Query by status using GSI1
      items = await this.dbService.queryByGSI(
        "GSI1",
        `USER#${userId}#STATUS#${options.status}`
      );
    } else {
      // Query all reports for user
      items = await this.dbService.queryByPK(`USER#${userId}`);
      items = items.filter(item => item.SK.startsWith("REPORT#"));
    }

    // Sort by sent date (newest first)
    items.sort((a, b) => new Date(b.sentDate).getTime() - new Date(a.sentDate).getTime());

    // Apply limit
    if (options.limit) {
      items = items.slice(0, options.limit);
    }

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
    const updateData: any = { ...updates };
    
    // Update GSI keys if status changes
    if (updates.status) {
      const currentReport = await this.findById(reportId, userId);
      if (!currentReport) return null;
      
      updateData.GSI1PK = `USER#${userId}#STATUS#${updates.status}`;
      updateData.GSI1SK = `DATE#${currentReport.sentDate}#REPORT#${reportId}`;
    }

    const updatedReport = await this.dbService.update(
      `USER#${userId}`,
      `REPORT#${reportId}`,
      updateData
    );

    return updatedReport as ReportDocument;
  }

  // Delete report
  static async deleteById(reportId: string, userId: string): Promise<void> {
    await this.dbService.delete(`USER#${userId}`, `REPORT#${reportId}`);
  }

  // Extract report ID from SK
  static extractReportId(SK: string): string {
    return SK.replace("REPORT#", "");
  }
}

export default ReportModel;
