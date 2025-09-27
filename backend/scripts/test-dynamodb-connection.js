const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ListTablesCommand } = require("@aws-sdk/lib-dynamodb");
require("dotenv").config();

const testConnection = async () => {
  console.log("Testing DynamoDB connection...");
  
  const client = new DynamoDBClient({
    region: process.env.AWS_REGION || "us-east-1",
    ...(process.env.DYNAMODB_ENDPOINT && {
      endpoint: process.env.DYNAMODB_ENDPOINT,
    }),
    ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && {
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    }),
  });

  const docClient = DynamoDBDocumentClient.from(client);

  try {
    const command = new ListTablesCommand({});
    const result = await docClient.send(command);
    
    console.log("✅ DynamoDB connection successful!");
    console.log("Available tables:", result.TableNames);
    
    const requiredTables = ["users", "transactions", "reports", "report_settings"];
    const missingTables = requiredTables.filter(table => !result.TableNames.includes(table));
    
    if (missingTables.length > 0) {
      console.log("⚠️  Missing required tables:", missingTables);
      console.log("Run: node scripts/create-dynamodb-tables.js");
    } else {
      console.log("✅ All required tables are present!");
    }
    
  } catch (error) {
    console.error("❌ DynamoDB connection failed:", error.message);
    process.exit(1);
  }
};

testConnection();
