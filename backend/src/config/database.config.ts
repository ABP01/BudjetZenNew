import { createTablesIfNotExists } from "./dynamodb.config";

const connectDatabase = async () => {
  try {
    await createTablesIfNotExists();
    console.log("Connected to DynamoDB database");
  } catch (error) {
    console.error("Error connecting to DynamoDB database:", error);
    process.exit(1);
  }
};

export default connectDatabase;
