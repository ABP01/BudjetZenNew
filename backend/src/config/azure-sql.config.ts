import sql, { ConnectionPool, Request } from "mssql";
import { Env } from "./env.config";

// Configuration de connexion Azure SQL Database
const config = {
  server: Env.AZURE_SQL_SERVER!,
  database: Env.AZURE_SQL_DATABASE!,
  user: Env.AZURE_SQL_USER!,
  password: Env.AZURE_SQL_PASSWORD!,
  options: {
    encrypt: true, // Utiliser SSL/TLS pour Azure SQL Database
    trustServerCertificate: false,
    enableArithAbort: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

// Variable globale pour la connexion
let pool: ConnectionPool;

// Fonction pour obtenir la connexion
export const getConnection = async (): Promise<ConnectionPool> => {
  if (!pool) {
    pool = new sql.ConnectionPool(config);
    await pool.connect();
  }
  return pool;
};

// Fonction pour fermer la connexion
export const closeConnection = async (): Promise<void> => {
  if (pool) {
    await pool.close();
    pool = null as any;
  }
};

// Fonction pour tester la connexion
export const testConnection = async (): Promise<boolean> => {
  try {
    const connection = await getConnection();
    const request = connection.request();
    await request.query("SELECT 1 as test");
    console.log("✅ Connexion à Azure SQL Database réussie");
    return true;
  } catch (error) {
    console.error("❌ Erreur de connexion à Azure SQL Database:", error);
    return false;
  }
};

// Fonction pour créer les tables si elles n'existent pas
export const createTablesIfNotExists = async (): Promise<void> => {
  try {
    const connection = await getConnection();
    const request = connection.request();

    // Table Users
    await request.query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='users' AND xtype='U')
      CREATE TABLE users (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        userId UNIQUEIDENTIFIER NOT NULL UNIQUE,
        name NVARCHAR(255) NOT NULL,
        email NVARCHAR(255) NOT NULL UNIQUE,
        password NVARCHAR(255) NOT NULL,
        profilePicture NVARCHAR(500),
        createdAt DATETIME2 DEFAULT GETUTCDATE(),
        updatedAt DATETIME2 DEFAULT GETUTCDATE()
      )
    `);

    // Table Transactions
    await request.query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='transactions' AND xtype='U')
      CREATE TABLE transactions (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        userId UNIQUEIDENTIFIER NOT NULL,
        type NVARCHAR(50) NOT NULL CHECK (type IN ('INCOME', 'EXPENSE')),
        title NVARCHAR(255) NOT NULL,
        amount DECIMAL(18,2) NOT NULL,
        category NVARCHAR(100) NOT NULL,
        receiptUrl NVARCHAR(500),
        recurringInterval NVARCHAR(50) CHECK (recurringInterval IN ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY')),
        nextRecurringDate DATETIME2,
        lastProcessed DATETIME2,
        isRecurring BIT DEFAULT 0,
        description NVARCHAR(1000),
        date DATETIME2 NOT NULL,
        status NVARCHAR(50) DEFAULT 'COMPLETED' CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED')),
        paymentMethod NVARCHAR(50) DEFAULT 'CASH' CHECK (paymentMethod IN ('CARD', 'BANK_TRANSFER', 'MOBILE_PAYMENT', 'AUTO_DEBIT', 'CASH', 'OTHER')),
        createdAt DATETIME2 DEFAULT GETUTCDATE(),
        updatedAt DATETIME2 DEFAULT GETUTCDATE(),
        FOREIGN KEY (userId) REFERENCES users(userId) ON DELETE CASCADE
      )
    `);

    // Table Reports
    await request.query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='reports' AND xtype='U')
      CREATE TABLE reports (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        userId UNIQUEIDENTIFIER NOT NULL,
        period NVARCHAR(100) NOT NULL,
        sentDate DATETIME2 NOT NULL,
        status NVARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
        createdAt DATETIME2 DEFAULT GETUTCDATE(),
        updatedAt DATETIME2 DEFAULT GETUTCDATE(),
        FOREIGN KEY (userId) REFERENCES users(userId) ON DELETE CASCADE
      )
    `);

    // Table Report Settings
    await request.query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='report_settings' AND xtype='U')
      CREATE TABLE report_settings (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        userId UNIQUEIDENTIFIER NOT NULL UNIQUE,
        frequency NVARCHAR(50) NOT NULL CHECK (frequency IN ('MONTHLY')),
        isEnabled BIT DEFAULT 0,
        nextReportDate DATETIME2,
        lastSentDate DATETIME2,
        createdAt DATETIME2 DEFAULT GETUTCDATE(),
        updatedAt DATETIME2 DEFAULT GETUTCDATE(),
        FOREIGN KEY (userId) REFERENCES users(userId) ON DELETE CASCADE
      )
    `);

    // Créer les index pour améliorer les performances
    await request.query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_transactions_userId')
      CREATE INDEX IX_transactions_userId ON transactions(userId)
    `);

    await request.query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_transactions_date')
      CREATE INDEX IX_transactions_date ON transactions(date)
    `);

    await request.query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_transactions_type')
      CREATE INDEX IX_transactions_type ON transactions(type)
    `);

    await request.query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_transactions_category')
      CREATE INDEX IX_transactions_category ON transactions(category)
    `);

    await request.query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_reports_userId')
      CREATE INDEX IX_reports_userId ON reports(userId)
    `);

    console.log("✅ Tables Azure SQL Database créées ou vérifiées");
  } catch (error) {
    console.error("❌ Erreur lors de la création des tables:", error);
    throw error;
  }
};

export default { getConnection, closeConnection, testConnection, createTablesIfNotExists };
