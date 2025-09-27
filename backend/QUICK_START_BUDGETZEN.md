# Guide de Démarrage Rapide - BudgetZen Azure

## 🚀 Configuration Rapide

### 1. Créer le fichier .env

Créez un fichier `.env` dans le dossier `backend/` avec vos informations Azure :

```env
# Configuration de l'application
NODE_ENV=development
PORT=8000
BASE_PATH=/api

# Azure SQL Database Configuration
AZURE_SQL_SERVER=budgetzen.database.windows.net
AZURE_SQL_DATABASE=Budgetzen
AZURE_SQL_USER=armel
AZURE_SQL_PASSWORD=votre_mot_de_passe_ici

# Azure Blob Storage Configuration
AZURE_STORAGE_ACCOUNT=budgetzenstorage
AZURE_STORAGE_KEY=votre_clé_de_stockage_ici

# JWT Configuration
JWT_SECRET=votre_jwt_secret_ici
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=votre_jwt_refresh_secret_ici
JWT_REFRESH_EXPIRES_IN=7d

# Google AI Configuration
GEMINI_API_KEY=votre_gemini_api_key_ici

# Resend Configuration
RESEND_API_KEY=votre_resend_api_key_ici
RESEND_MAILER_SENDER=votre_email@example.com

# Frontend Configuration
FRONTEND_ORIGIN=http://localhost:3000
```

### 2. Installer les dépendances

```bash
cd backend
npm install
npm install mssql @azure/storage-blob
```

### 3. Tester la configuration

```bash
npm run test-azure-config
```

### 4. Démarrer l'application

```bash
npm run dev
```

## ✅ Vérification

Vérifiez que tout fonctionne :

- [ ] Le test de configuration passe (`npm run test-azure-config`)
- [ ] L'application démarre sans erreur (`npm run dev`)
- [ ] La connexion à Azure SQL Database est établie
- [ ] Les conteneurs Blob Storage sont accessibles
- [ ] Les tables SQL sont créées automatiquement

## 🔧 Obtenir les clés manquantes

### Mot de passe Azure SQL Database
1. Allez sur [portal.azure.com](https://portal.azure.com)
2. Trouvez votre serveur SQL Database `budgetzen`
3. Dans "Security" → "Authentication", réinitialisez le mot de passe

### Clé de stockage Azure Blob Storage
1. Dans le portail Azure, allez dans `budgetzenstorage`
2. Dans "Security + networking" → "Access keys"
3. Copiez la "key1" ou "key2"

## 📊 Structure des données

### Tables SQL créées automatiquement :
- `users` - Utilisateurs avec photos de profil
- `transactions` - Transactions financières avec reçus
- `reports` - Rapports générés
- `report_settings` - Paramètres de rapport

### Conteneurs Blob Storage :
- `profiles` - Photos de profil des utilisateurs
- `invoices` - Factures et reçus scannés
- `documents` - Documents généraux

## 🔄 Migration des données (optionnel)

Si vous avez des données DynamoDB existantes :

```bash
npm run migrate-to-azure-sql
```

## 🛠️ Utilisation des conteneurs

### Upload de photo de profil
```typescript
import { uploadFile, CONTAINER_NAMES } from "../config/azure-blob.config";

const profilePictureUrl = await uploadFile(file, CONTAINER_NAMES.PROFILES);
```

### Upload de facture/reçu
```typescript
const invoiceUrl = await uploadFile(file, CONTAINER_NAMES.INVOICES);
```

### Upload de document
```typescript
const documentUrl = await uploadFile(file, CONTAINER_NAMES.DOCUMENTS);
```

## 🔧 Dépannage

### Erreur de connexion SQL
```bash
# Vérifier les variables d'environnement
echo $AZURE_SQL_SERVER
echo $AZURE_SQL_DATABASE
echo $AZURE_SQL_USER
```

### Erreur de connexion Blob Storage
```bash
# Vérifier les variables d'environnement
echo $AZURE_STORAGE_ACCOUNT
echo $AZURE_STORAGE_KEY
```

### Test de connexion manuel
```bash
# Test SQL Database
node -e "
const { Connection } = require('mssql');
const conn = new Connection({
  server: 'budgetzen.database.windows.net',
  database: 'Budgetzen',
  user: 'armel',
  password: 'votre_mot_de_passe',
  options: { encrypt: true }
});
conn.connect().then(() => {
  console.log('✅ SQL Database OK');
  conn.close();
}).catch(err => console.error('❌ Erreur SQL:', err));
"

# Test Blob Storage
node -e "
const { BlobServiceClient } = require('@azure/storage-blob');
const client = new BlobServiceClient(
  'https://budgetzenstorage.blob.core.windows.net',
  'votre_clé_de_stockage'
);
client.listContainers().then(result => {
  console.log('✅ Blob Storage OK');
  console.log('Conteneurs:', result.containerItems.map(c => c.name));
}).catch(err => console.error('❌ Erreur Blob:', err));
"
```

## 📚 Ressources

- [Documentation Azure SQL Database](https://docs.microsoft.com/en-us/azure/azure-sql/)
- [Documentation Azure Blob Storage](https://docs.microsoft.com/en-us/azure/storage/blobs/)
- [Guide de configuration complet](./AZURE_CONFIGURATION.md)
- [Guide de migration complet](./AZURE_SQL_MIGRATION.md)

---

**Configuration terminée !** 🎉 Votre application BudgetZen est maintenant configurée pour Azure SQL Database et Blob Storage.
