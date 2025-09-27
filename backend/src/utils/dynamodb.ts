import {
    BatchWriteCommand,
    ConditionalCheckFailedException,
    DeleteCommand,
    DynamoDBDocumentClient,
    GetCommand,
    PutCommand,
    QueryCommand,
    ResourceNotFoundException,
    ScanCommand,
    TransactWriteCommand,
    UpdateCommand
} from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";

export interface DynamoDBItem {
  PK: string; // Partition Key
  SK?: string; // Sort Key (optional)
  GSI1PK?: string; // Global Secondary Index 1 Partition Key
  GSI1SK?: string; // Global Secondary Index 1 Sort Key
  GSI2PK?: string; // Global Secondary Index 2 Partition Key  
  GSI2SK?: string; // Global Secondary Index 2 Sort Key
  createdAt: string;
  updatedAt: string;
  [key: string]: any;
}

export class DynamoDBService {
  constructor(private client: DynamoDBDocumentClient, private tableName: string) {}

  // Generate unique ID
  generateId(): string {
    return uuidv4();
  }

  // Create item
  async create(item: Partial<DynamoDBItem>): Promise<DynamoDBItem> {
    const now = new Date().toISOString();
    const id = this.generateId();
    
    const newItem: DynamoDBItem = {
      PK: item.PK || id,
      SK: item.SK || id,
      createdAt: now,
      updatedAt: now,
      ...item,
    };

    const command = new PutCommand({
      TableName: this.tableName,
      Item: newItem,
      ConditionExpression: "attribute_not_exists(PK)",
    });

    try {
      await this.client.send(command);
      return newItem;
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) {
        throw new Error("Item already exists");
      }
      throw error;
    }
  }

  // Get item by primary key
  async getById(PK: string, SK?: string): Promise<DynamoDBItem | null> {
    const command = new GetCommand({
      TableName: this.tableName,
      Key: {
        PK,
        ...(SK && { SK }),
      },
    });

    try {
      const result = await this.client.send(command);
      return result.Item as DynamoDBItem | null;
    } catch (error) {
      if (error instanceof ResourceNotFoundException) {
        return null;
      }
      throw error;
    }
  }

  // Update item
  async update(
    PK: string, 
    SK: string | undefined, 
    updates: Partial<DynamoDBItem>,
    conditionExpression?: string
  ): Promise<DynamoDBItem> {
    const now = new Date().toISOString();
    
    // Build update expression
    const updateExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    // Add updatedAt
    updateExpressions.push("#updatedAt = :updatedAt");
    expressionAttributeNames["#updatedAt"] = "updatedAt";
    expressionAttributeValues[":updatedAt"] = now;

    // Add other updates
    Object.keys(updates).forEach((key, index) => {
      if (key !== "PK" && key !== "SK" && key !== "createdAt") {
        updateExpressions.push(`#${key} = :${key}`);
        expressionAttributeNames[`#${key}`] = key;
        expressionAttributeValues[`:${key}`] = updates[key];
      }
    });

    const command = new UpdateCommand({
      TableName: this.tableName,
      Key: {
        PK,
        ...(SK && { SK }),
      },
      UpdateExpression: `SET ${updateExpressions.join(", ")}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ConditionExpression: conditionExpression || "attribute_exists(PK)",
      ReturnValues: "ALL_NEW",
    });

    try {
      const result = await this.client.send(command);
      return result.Attributes as DynamoDBItem;
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) {
        throw new Error("Item not found or condition failed");
      }
      throw error;
    }
  }

  // Delete item
  async delete(PK: string, SK?: string): Promise<void> {
    const command = new DeleteCommand({
      TableName: this.tableName,
      Key: {
        PK,
        ...(SK && { SK }),
      },
    });

    await this.client.send(command);
  }

  // Query by partition key
  async queryByPK(PK: string, SKBeginsWith?: string): Promise<DynamoDBItem[]> {
    const command = new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: "PK = :pk" + (SKBeginsWith ? " AND begins_with(SK, :sk)" : ""),
      ExpressionAttributeValues: {
        ":pk": PK,
        ...(SKBeginsWith && { ":sk": SKBeginsWith }),
      },
    });

    const result = await this.client.send(command);
    return result.Items as DynamoDBItem[] || [];
  }

  // Query by GSI
  async queryByGSI(
    indexName: string,
    GSI1PK?: string,
    GSI1SK?: string,
    GSI2PK?: string,
    GSI2SK?: string
  ): Promise<DynamoDBItem[]> {
    const pkKey = GSI1PK ? "GSI1PK" : "GSI2PK";
    const skKey = GSI1PK ? "GSI1SK" : "GSI2SK";
    const pkValue = GSI1PK || GSI2PK;
    const skValue = GSI1SK || GSI2SK;

    const command = new QueryCommand({
      TableName: this.tableName,
      IndexName: indexName,
      KeyConditionExpression: `${pkKey} = :pk` + (skValue ? ` AND begins_with(${skKey}, :sk)` : ""),
      ExpressionAttributeValues: {
        ":pk": pkValue,
        ...(skValue && { ":sk": skValue }),
      },
    });

    const result = await this.client.send(command);
    return result.Items as DynamoDBItem[] || [];
  }

  // Scan table
  async scan(filterExpression?: string, expressionAttributeValues?: Record<string, any>): Promise<DynamoDBItem[]> {
    const command = new ScanCommand({
      TableName: this.tableName,
      ...(filterExpression && { FilterExpression: filterExpression }),
      ...(expressionAttributeValues && { ExpressionAttributeValues: expressionAttributeValues }),
    });

    const result = await this.client.send(command);
    return result.Items as DynamoDBItem[] || [];
  }

  // Batch write
  async batchWrite(items: DynamoDBItem[]): Promise<void> {
    const chunks = this.chunkArray(items, 25); // DynamoDB batch limit is 25

    for (const chunk of chunks) {
      const command = new BatchWriteCommand({
        RequestItems: {
          [this.tableName]: chunk.map(item => ({
            PutRequest: { Item: item }
          }))
        }
      });

      await this.client.send(command);
    }
  }

  // Transaction write
  async transactWrite(transactItems: any[]): Promise<void> {
    const command = new TransactWriteCommand({
      TransactItems: transactItems
    });

    await this.client.send(command);
  }

  // Helper to chunk array
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
