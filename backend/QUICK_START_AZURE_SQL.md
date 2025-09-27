# Guide de Migration Rapide - DynamoDB vers Azure SQL Database

## 🚀 Démarrage Rapide

### 1. Configuration Azure SQL Database

1. **Créer un serveur Azure SQL Database**:
   - Allez sur [portal.azure.com](https://portal.azure.com)
   - Créez une ressource "SQL Database"
   - Configurez votre serveur et base de données
   - Notez les informations de connexion

2. **Créer un compte Azure Blob Storage**:
   - Créez une ressource "Storage Account"
   - Obtenez la clé d'accès dans "Access keys"

### 2. Configuration des variables d'environnement

```bash
# Copiez le fichier d'exemple
cp env.azure-sql.example .env

# Éditez le fichier .env avec vos informations Azure
AZURE_SQL_SERVER=your-server.database.windows.net
AZURE_SQL_DATABASE=your-database-name
AZURE_SQL_USER=your-username
AZURE_SQL_PASSWORD=your-password
AZURE_STORAGE_ACCOUNT=your-storage-account
AZURE_STORAGE_KEY=your-storage-key
```

### 3. Installation des dépendances

```bash
# Supprimer DynamoDB
npm uninstall @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb @aws-sdk/util-dynamodb

# Installer Azure SQL Database et Blob Storage
npm install mssql @azure/storage-blob
```

### 4. Migration des données (optionnel)

```bash
# Si vous avez des données DynamoDB existantes
npm run migrate-to-azure-sql
```

### 5. Mise à jour du code

Remplacez les imports DynamoDB par SQL dans vos contrôleurs :

```typescript
// Avant
import UserModel from "../models/user.dynamodb";
import { authService } from "../services/auth.dynamodb";

// Après
import UserModel from "../models/user.sql";
import { authService } from "../services/auth.sql";
```

### 6. Test de la migration

```bash
# Démarrer l'application
npm run dev

# Tester les endpoints
curl http://localhost:8000/api/auth/register
```

## ✅ Vérification

Vérifiez que tout fonctionne :

- [ ] L'application démarre sans erreur
- [ ] La connexion à Azure SQL Database est établie
- [ ] Les tables sont créées automatiquement
- [ ] Les endpoints d'authentification fonctionnent
- [ ] Les transactions peuvent être créées/modifiées
- [ ] Les fichiers sont uploadés vers Blob Storage
- [ ] Les rapports sont générés correctement

## 🔧 Dépannage

### Erreur de connexion SQL
```bash
# Vérifier les variables d'environnement
echo $AZURE_SQL_SERVER
echo $AZURE_SQL_DATABASE
echo $AZURE_SQL_USER
```

### Erreur de table
```bash
# Vérifier que les tables existent
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
  const request = conn.request();
  request.query('SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES')
    .then(result => console.log('Tables:', result.recordset.map(r => r.TABLE_NAME)));
});
"
```

### Erreur Blob Storage
```bash
# Vérifier la connexion Blob Storage
node -e "
const { BlobServiceClient } = require('@azure/storage-blob');
const client = new BlobServiceClient(
  \`https://\${process.env.AZURE_STORAGE_ACCOUNT}.blob.core.windows.net\`,
  process.env.AZURE_STORAGE_KEY
);
client.listContainers().then(result => 
  console.log('Conteneurs:', result.containerItems.map(c => c.name))
);
"
```

## 📊 Structure des données

### Tables créées automatiquement :
- `users` - Utilisateurs
- `transactions` - Transactions financières
- `reports` - Rapports générés
- `report_settings` - Paramètres de rapport

### Index créés automatiquement :
- `IX_transactions_userId` - Transactions par utilisateur
- `IX_transactions_date` - Transactions par date
- `IX_transactions_type` - Transactions par type
- `IX_transactions_category` - Transactions par catégorie
- `IX_reports_userId` - Rapports par utilisateur

## 📚 Ressources

- [Documentation Azure SQL Database](https://docs.microsoft.com/en-us/azure/azure-sql/)
- [Documentation Azure Blob Storage](https://docs.microsoft.com/en-us/azure/storage/blobs/)
- [Guide de migration complet](./AZURE_SQL_MIGRATION.md)
- [SDK mssql](https://www.npmjs.com/package/mssql)
- [SDK Azure Storage Blob](https://www.npmjs.com/package/@azure/storage-blob)

## 🔄 Migration des fichiers

Les fichiers (photos de profil, reçus) sont maintenant stockés dans Azure Blob Storage :

```typescript
// Upload d'un fichier
import { uploadFile } from "../config/azure-blob.config";
const fileUrl = await uploadFile(file, "profile-picture.jpg");

// Suppression d'un fichier
import { deleteFile } from "../config/azure-blob.config";
await deleteFile(fileUrl);
```

---

**Migration terminée !** 🎉 Votre application utilise maintenant Azure SQL Database et Azure Blob Storage.
