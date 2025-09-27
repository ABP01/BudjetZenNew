#!/usr/bin/env node

/**
 * Script de test de configuration Azure pour BudgetZen
 * 
 * Ce script teste la connexion à Azure SQL Database et Azure Blob Storage
 * 
 * Usage:
 *   node scripts/test-azure-config.js
 */

import { BlobServiceClient } from "@azure/storage-blob";
import dotenv from "dotenv";
import { Request } from "mssql";

// Charger les variables d'environnement
dotenv.config();

// Configuration Azure SQL Database
const sqlConfig = {
  server: process.env.AZURE_SQL_SERVER!,
  database: process.env.AZURE_SQL_DATABASE!,
  user: process.env.AZURE_SQL_USER!,
  password: process.env.AZURE_SQL_PASSWORD!,
  options: {
    encrypt: true,
    trustServerCertificate: false,
    enableArithAbort: true,
  },
};

// Configuration Azure Blob Storage
const blobServiceClient = new BlobServiceClient(
  `https://${process.env.AZURE_STORAGE_ACCOUNT}.blob.core.windows.net`,
  process.env.AZURE_STORAGE_KEY!
);

// Test de connexion SQL Database
async function testSqlConnection() {
  console.log("🔍 Test de connexion Azure SQL Database...");
  console.log(`   Serveur: ${sqlConfig.server}`);
  console.log(`   Base de données: ${sqlConfig.database}`);
  console.log(`   Utilisateur: ${sqlConfig.user}`);
  
  try {
    const connection = new Connection(sqlConfig);
    await connection.connect();
    
    // Test de requête simple
    const request = new Request(connection);
    const result = await request.query("SELECT 1 as test");
    
    console.log("✅ Connexion Azure SQL Database réussie");
    console.log(`   Résultat du test: ${result.recordset[0].test}`);
    
    // Vérifier les tables existantes
    const tablesRequest = new Request(connection);
    const tablesResult = await tablesRequest.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE'
    `);
    
    console.log("📊 Tables existantes:");
    tablesResult.recordset.forEach(table => {
      console.log(`   - ${table.TABLE_NAME}`);
    });
    
    await connection.close();
    return true;
  } catch (error) {
    console.error("❌ Erreur de connexion Azure SQL Database:", error.message);
    return false;
  }
}

// Test de connexion Blob Storage
async function testBlobStorageConnection() {
  console.log("\n🔍 Test de connexion Azure Blob Storage...");
  console.log(`   Compte de stockage: ${process.env.AZURE_STORAGE_ACCOUNT}`);
  
  try {
    // Lister les conteneurs
    const containers = [];
    for await (const container of blobServiceClient.listContainers()) {
      containers.push(container.name);
    }
    
    console.log("✅ Connexion Azure Blob Storage réussie");
    console.log("📁 Conteneurs disponibles:");
    containers.forEach(container => {
      console.log(`   - ${container}`);
    });
    
    // Vérifier les conteneurs spécifiques
    const expectedContainers = ['profiles', 'invoices', 'documents'];
    const missingContainers = expectedContainers.filter(
      container => !containers.includes(container)
    );
    
    if (missingContainers.length > 0) {
      console.log("⚠️  Conteneurs manquants:");
      missingContainers.forEach(container => {
        console.log(`   - ${container}`);
      });
    } else {
      console.log("✅ Tous les conteneurs requis sont présents");
    }
    
    return true;
  } catch (error) {
    console.error("❌ Erreur de connexion Azure Blob Storage:", error.message);
    return false;
  }
}

// Test des variables d'environnement
function testEnvironmentVariables() {
  console.log("🔍 Test des variables d'environnement...");
  
  const requiredVars = [
    'AZURE_SQL_SERVER',
    'AZURE_SQL_DATABASE', 
    'AZURE_SQL_USER',
    'AZURE_SQL_PASSWORD',
    'AZURE_STORAGE_ACCOUNT',
    'AZURE_STORAGE_KEY'
  ];
  
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.log("❌ Variables d'environnement manquantes:");
    missingVars.forEach(varName => {
      console.log(`   - ${varName}`);
    });
    return false;
  } else {
    console.log("✅ Toutes les variables d'environnement requises sont présentes");
    return true;
  }
}

// Fonction principale de test
async function runTests() {
  console.log("🚀 Test de configuration Azure pour BudgetZen");
  console.log("================================================");
  
  // Test des variables d'environnement
  const envTest = testEnvironmentVariables();
  if (!envTest) {
    console.log("\n❌ Test échoué: Variables d'environnement manquantes");
    console.log("Veuillez configurer le fichier .env avec vos informations Azure");
    process.exit(1);
  }
  
  // Test de connexion SQL Database
  const sqlTest = await testSqlConnection();
  
  // Test de connexion Blob Storage
  const blobTest = await testBlobStorageConnection();
  
  // Résumé des tests
  console.log("\n📋 Résumé des tests:");
  console.log("===================");
  console.log(`Variables d'environnement: ${envTest ? '✅' : '❌'}`);
  console.log(`Azure SQL Database: ${sqlTest ? '✅' : '❌'}`);
  console.log(`Azure Blob Storage: ${blobTest ? '✅' : '❌'}`);
  
  if (envTest && sqlTest && blobTest) {
    console.log("\n🎉 Tous les tests sont passés avec succès!");
    console.log("Votre configuration Azure est prête à être utilisée.");
  } else {
    console.log("\n❌ Certains tests ont échoué.");
    console.log("Veuillez vérifier votre configuration Azure.");
    process.exit(1);
  }
}

// Exécuter les tests
if (require.main === module) {
  runTests().catch(console.error);
}

export { runTests };

