# Migration DynamoDB vers Azure SQL Database et Blob Storage

Ce document décrit la migration complète du projet de DynamoDB vers Azure SQL Database et Azure Blob Storage.

## Vue d'ensemble

Cette migration remplace DynamoDB par Azure SQL Database (base de données relationnelle) et Azure Blob Storage (stockage de fichiers), offrant une meilleure intégration avec l'écosystème Microsoft Azure et des fonctionnalités avancées.

## Changements effectués

### 1. Configuration
- **Nouveau fichier**: `src/config/azure-sql.config.ts` - Configuration Azure SQL Database
- **Nouveau fichier**: `src/config/azure-blob.config.ts` - Configuration Azure Blob Storage
- **Modifié**: `src/config/env.config.ts` - Variables d'environnement Azure
- **Modifié**: `src/config/database.config.ts` - Connexion Azure SQL Database

### 2. Modèles
- **Nouveaux fichiers SQL**:
  - `src/models/user.sql.ts`
  - `src/models/transaction.sql.ts`
  - `src/models/report.sql.ts`
  - `src/models/report-setting.sql.ts`

### 3. Services
- **Nouveaux fichiers SQL**:
  - `src/services/auth.sql.ts`
  - `src/services/user.sql.ts`
  - `src/services/transaction.sql.ts`
  - `src/services/report.sql.ts`
  - `src/services/analytics.sql.ts`

### 4. Utilitaires
- **Nouveau fichier**: `src/utils/azure-sql.ts` - Service Azure SQL Database générique

### 5. Scripts de migration
- **Nouveau fichier**: `scripts/migrate-to-azure-sql.js` - Script de migration des données

## Variables d'environnement requises

Remplacez les variables DynamoDB par ces variables Azure dans votre fichier `.env`:

```env
# Azure SQL Database Configuration
AZURE_SQL_SERVER=your-server.database.windows.net
AZURE_SQL_DATABASE=your-database-name
AZURE_SQL_USER=your-username
AZURE_SQL_PASSWORD=your-password

# Azure Blob Storage Configuration
AZURE_STORAGE_ACCOUNT=your-storage-account
AZURE_STORAGE_KEY=your-storage-key

# Supprimez ces variables DynamoDB (optionnel)
# AWS_REGION=us-east-1
# AWS_ACCESS_KEY_ID=your_aws_access_key_id
# AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
# DYNAMODB_ENDPOINT=http://localhost:8000
```

## Installation des dépendances

```bash
# Supprimer les dépendances DynamoDB
npm uninstall @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb @aws-sdk/util-dynamodb

# Installer Azure SQL Database et Blob Storage
npm install mssql @azure/storage-blob
```

## Configuration Azure

### 1. Créer un serveur Azure SQL Database

1. Connectez-vous au [portail Azure](https://portal.azure.com)
2. Créez une nouvelle ressource "SQL Database"
3. Configurez votre serveur et base de données
4. Notez les informations de connexion

### 2. Créer un compte Azure Blob Storage

1. Dans le portail Azure, créez une nouvelle ressource "Storage Account"
2. Configurez votre compte de stockage
3. Obtenez la clé d'accès dans "Access keys"

### 3. Structure de la base de données

La migration crée automatiquement les tables suivantes :

#### Table `users`
```sql
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
```

#### Table `transactions`
```sql
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
```

#### Table `reports`
```sql
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
```

#### Table `report_settings`
```sql
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
```

## Migration des données

### Option 1: Script de migration automatique

```bash
# Exécuter le script de migration
node scripts/migrate-to-azure-sql.js
```

### Option 2: Migration manuelle

Si vous préférez migrer manuellement :

1. **Exporter les données DynamoDB**:
   ```bash
   aws dynamodb scan --table-name users --output json > users.json
   aws dynamodb scan --table-name transactions --output json > transactions.json
   aws dynamodb scan --table-name reports --output json > reports.json
   aws dynamodb scan --table-name report_settings --output json > report_settings.json
   ```

2. **Transformer et importer dans Azure SQL Database**:
   Utilisez SQL Server Management Studio ou Azure Data Studio pour importer les données.

## Changements dans le code

### Modèles

**Avant (DynamoDB)**:
```typescript
export interface UserDocument extends DynamoDBItem {
  PK: string; // USER#{userId}
  SK: string; // USER#{userId}
  GSI1PK: string; // EMAIL#{email}
  GSI1SK: string; // USER#{userId}
  // ...
}
```

**Après (Azure SQL Database)**:
```typescript
export interface UserDocument extends SQLItem {
  id: string;
  userId: string;
  name: string;
  email: string;
  // ...
}
```

### Services

**Avant (DynamoDB)**:
```typescript
const user = await this.dbService.getById(`USER#${userId}`);
```

**Après (Azure SQL Database)**:
```typescript
const user = await this.sqlService.getById(userId, userId);
```

### Requêtes

**Avant (DynamoDB)**:
```typescript
const users = await this.dbService.queryByGSI("GSI1", `EMAIL#${email}`);
```

**Après (Azure SQL Database)**:
```typescript
const users = await this.sqlService.executeQuery(
  "SELECT * FROM users WHERE email = @email",
  { email }
);
```

## Gestion des fichiers avec Azure Blob Storage

### Upload de fichiers
```typescript
import { uploadFile } from "../config/azure-blob.config";

const fileUrl = await uploadFile(file, "profile-picture.jpg");
```

### Suppression de fichiers
```typescript
import { deleteFile } from "../config/azure-blob.config";

await deleteFile(fileUrl);
```

## Avantages de la migration

### 1. Performance
- **Requêtes SQL optimisées**: Index automatiques et requêtes SQL performantes
- **Transactions ACID**: Garanties de cohérence des données
- **Mise à l'échelle**: Scaling automatique avec Azure SQL Database

### 2. Fonctionnalités avancées
- **Requêtes SQL complexes**: JOINs, agrégations, sous-requêtes
- **Index personnalisés**: Optimisation des performances
- **Backup automatique**: Sauvegardes automatiques et point-in-time recovery
- **Sécurité**: Chiffrement au repos et en transit

### 3. Intégration Azure
- **Azure Active Directory**: Authentification intégrée
- **Azure Monitor**: Monitoring et alertes
- **Azure Backup**: Sauvegardes automatisées
- **Azure Security Center**: Sécurité centralisée

### 4. Coûts
- **Modèle de consommation**: Payez seulement ce que vous utilisez
- **Réserve de capacité**: Réductions jusqu'à 80% avec les réserves
- **Niveau gratuit**: 32 Go de stockage gratuit

## Tests après migration

Après la migration, testez les fonctionnalités suivantes :

- [ ] Inscription/Connexion utilisateur
- [ ] Création/Modification/Suppression de transactions
- [ ] Upload de photos de profil (Blob Storage)
- [ ] Scan de reçus
- [ ] Génération de rapports
- [ ] Analytics et graphiques
- [ ] Jobs cron (transactions récurrentes, rapports)

## Dépannage

### Erreurs communes

1. **Connection refused**: Vérifiez l'URL du serveur Azure SQL Database
2. **Authentication failed**: Vérifiez le nom d'utilisateur et mot de passe
3. **Database not found**: Vérifiez que la base de données existe
4. **Table not found**: Vérifiez que les tables sont créées
5. **Blob storage error**: Vérifiez la clé de stockage Azure

### Logs utiles

- Vérifiez les logs de connexion Azure SQL Database
- Surveillez les erreurs de requête dans les services
- Vérifiez les métriques Azure Monitor pour SQL Database
- Surveillez les logs Azure Blob Storage

### Commandes de diagnostic

```bash
# Tester la connexion SQL
node -e "
const { Connection } = require('mssql');
const conn = new Connection({
  server: process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  options: { encrypt: true }
});
conn.connect().then(() => {
  console.log('✅ Connexion SQL réussie');
  conn.close();
});
"

# Tester Blob Storage
node -e "
const { BlobServiceClient } = require('@azure/storage-blob');
const client = new BlobServiceClient(
  \`https://\${process.env.AZURE_STORAGE_ACCOUNT}.blob.core.windows.net\`,
  process.env.AZURE_STORAGE_KEY
);
client.listContainers().then(() => console.log('✅ Blob Storage OK'));
"
```

## Rollback

Si vous devez revenir à DynamoDB :

1. Restaurez les fichiers DynamoDB originaux
2. Reinstallez les dépendances DynamoDB
3. Restaurez les variables d'environnement DynamoDB
4. Migrez les données d'Azure vers DynamoDB si nécessaire

## Support

Pour toute question ou problème :

1. Consultez la [documentation Azure SQL Database](https://docs.microsoft.com/en-us/azure/azure-sql/)
2. Consultez la [documentation Azure Blob Storage](https://docs.microsoft.com/en-us/azure/storage/blobs/)
3. Vérifiez les logs d'application
4. Contactez l'équipe de développement

## Notes importantes

1. **Clés étrangères**: Les relations entre tables sont gérées par des clés étrangères
2. **Index**: Des index sont créés automatiquement pour optimiser les performances
3. **Transactions**: Les transactions SQL garantissent la cohérence des données
4. **Blob Storage**: Les fichiers sont stockés dans Azure Blob Storage avec URLs publiques
5. **Sécurité**: Chiffrement SSL/TLS obligatoire pour Azure SQL Database

---

**Migration terminée avec succès !** 🎉

Votre application utilise maintenant Azure SQL Database et Azure Blob Storage au lieu de DynamoDB.
