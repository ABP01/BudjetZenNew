import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { Env } from "./env.config";

// Create DynamoDB client
const client = new DynamoDBClient({
  region: Env.AWS_REGION,
  ...(Env.DYNAMODB_ENDPOINT && {
    endpoint: Env.DYNAMODB_ENDPOINT, // For local DynamoDB
  }),
  ...(Env.AWS_ACCESS_KEY_ID && Env.AWS_SECRET_ACCESS_KEY && {
    credentials: {
      accessKeyId: Env.AWS_ACCESS_KEY_ID,
      secretAccessKey: Env.AWS_SECRET_ACCESS_KEY,
    },
  }),
});

// Create DynamoDB Document client
export const dynamoDB = DynamoDBDocumentClient.from(client);

// Table names
export const TABLE_NAMES = {
  USERS: "users",
  TRANSACTIONS: "transactions", 
  REPORTS: "reports",
  REPORT_SETTINGS: "report_settings",
} as const;

// Helper function to create table if not exists (for development)
export const createTablesIfNotExists = async () => {
  try {
    console.log("DynamoDB client initialized successfully");
    console.log(`Region: ${Env.AWS_REGION}`);
    if (Env.DYNAMODB_ENDPOINT) {
      console.log(`Local endpoint: ${Env.DYNAMODB_ENDPOINT}`);
    }
  } catch (error) {
    console.error("Error initializing DynamoDB:", error);
    process.exit(1);
  }
};

export default dynamoDB;
