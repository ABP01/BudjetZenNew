# Configuration Azure pour BudgetZen

## 🔧 Configuration Azure SQL Database

Votre serveur Azure SQL Database est configuré avec :
- **Serveur** : `budgetzen.database.windows.net`
- **Base de données** : `Budgetzen`
- **Utilisateur** : `armel`
- **Mot de passe** : `{your_password_here}` (à remplacer)

### Chaîne de connexion complète :
```
Server=tcp:budgetzen.database.windows.net,1433;Database=Budgetzen;Uid=armel;Pwd={your_password_here};Encrypt=yes;TrustServerCertificate=no;Connection Timeout=30;
```

## 📁 Configuration Azure Blob Storage

Votre compte de stockage Azure est configuré avec :
- **Compte de stockage** : `budgetzenstorage`
- **Conteneurs** :
  - `profiles` - Photos de profil des utilisateurs
  - `invoices` - Factures et reçus
  - `documents` - Documents généraux

### URLs SAS des conteneurs :

#### Conteneur `profiles`
- **URL SAS** : `https://budgetzenstorage.blob.core.windows.net/profiles?sp=r&si=moi&sv=2024-11-04&sr=c&sig=HCqg1n7cuI%2F1s97KyB5QCJZ66uD8cTkTJ3gnB2B6now%3D`

#### Conteneur `invoices`
- **URL SAS** : `https://budgetzenstorage.blob.core.windows.net/invoices?sp=r&si=Moi&sv=2024-11-04&sr=c&sig=qBNOSgjo41yg3ZS9ABkd2uL1qUDoNT2f6duOxb4OFe8%3D`

#### Conteneur `documents`
- **URL SAS** : `https://budgetzenstorage.blob.core.windows.net/documents?si=Moi&sv=2024-11-04&sr=c&sig=e20eN%2FYukvBVV7SV4cLQTH8j5YdsZGwN8BpBrXzj9K8%3D`

## 📝 Configuration du fichier .env

Créez un fichier `.env` dans le dossier `backend/` avec le contenu suivant :

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

# Cloudinary Configuration (optionnel)
CLOUDINARY_CLOUD_NAME=votre_cloudinary_cloud_name
CLOUDINARY_API_KEY=votre_cloudinary_api_key
CLOUDINARY_API_SECRET=votre_cloudinary_api_secret

# Resend Configuration
RESEND_API_KEY=votre_resend_api_key_ici
RESEND_MAILER_SENDER=votre_email@example.com

# Frontend Configuration
FRONTEND_ORIGIN=http://localhost:3000
```

## 🔑 Obtenir les clés manquantes

### 1. Mot de passe Azure SQL Database
- Connectez-vous au [portail Azure](https://portal.azure.com)
- Allez dans votre serveur SQL Database `budgetzen`
- Dans "Security" → "Authentication", réinitialisez le mot de passe si nécessaire

### 2. Clé de stockage Azure Blob Storage
- Dans le portail Azure, allez dans votre compte de stockage `budgetzenstorage`
- Dans "Security + networking" → "Access keys"
- Copiez la "key1" ou "key2"

## 🚀 Installation et démarrage

### 1. Installer les dépendances
```bash
cd backend
npm install
```

### 2. Installer les dépendances Azure
```bash
npm install mssql @azure/storage-blob
```

### 3. Supprimer les dépendances DynamoDB (si présentes)
```bash
npm uninstall @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb @aws-sdk/util-dynamodb
```

### 4. Démarrer l'application
```bash
npm run dev
```

## ✅ Vérification de la configuration

### Test de connexion SQL Database
```bash
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
  console.log('✅ Connexion SQL Database réussie');
  conn.close();
}).catch(err => console.error('❌ Erreur:', err));
"
```

### Test de connexion Blob Storage
```bash
node -e "
const { BlobServiceClient } = require('@azure/storage-blob');
const client = new BlobServiceClient(
  'https://budgetzenstorage.blob.core.windows.net',
  'votre_clé_de_stockage'
);
client.listContainers().then(result => {
  console.log('✅ Connexion Blob Storage réussie');
  console.log('Conteneurs:', result.containerItems.map(c => c.name));
}).catch(err => console.error('❌ Erreur:', err));
"
```

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

## 🔄 Migration des données existantes

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
- Vérifiez le mot de passe dans le portail Azure
- Vérifiez que le firewall autorise votre IP
- Vérifiez que SSL/TLS est activé

### Erreur de connexion Blob Storage
- Vérifiez la clé de stockage
- Vérifiez que les conteneurs existent
- Vérifiez les permissions SAS

### Erreur de table
- Les tables sont créées automatiquement au démarrage
- Vérifiez les logs de l'application

---

**Configuration terminée !** 🎉 Votre application BudgetZen est maintenant configurée pour Azure SQL Database et Blob Storage.
