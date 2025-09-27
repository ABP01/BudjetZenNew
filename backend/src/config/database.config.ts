import { testBlobStorageConnection } from "./azure-blob.config";
import { createTablesIfNotExists, testConnection } from "./azure-sql.config";

const connectDatabase = async () => {
  try {
    await testConnection();
    await createTablesIfNotExists();
    await testBlobStorageConnection();
    console.log("Connected to Azure SQL Database and Blob Storage");
  } catch (error) {
    console.error("Error connecting to Azure services:", error);
    process.exit(1);
  }
};

export default connectDatabase;
