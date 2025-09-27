# Migration MongoDB vers DynamoDB

Ce document décrit la migration du projet de MongoDB vers DynamoDB.

## Changements effectués

### 1. Configuration
- **Nouveau fichier**: `src/config/dynamodb.config.ts`
- **Modifié**: `src/config/env.config.ts` - Ajout des variables d'environnement DynamoDB
- **Modifié**: `src/config/database.config.ts` - Remplacement de MongoDB par DynamoDB

### 2. Modèles
- **Nouveaux fichiers DynamoDB**:
  - `src/models/user.dynamodb.ts`
  - `src/models/transaction.dynamodb.ts`
  - `src/models/report.dynamodb.ts`
  - `src/models/report-setting.dynamodb.ts`

### 3. Services
- **Nouveaux fichiers DynamoDB**:
  - `src/services/auth.dynamodb.ts`
  - `src/services/user.dynamodb.ts`
  - `src/services/transaction.dynamodb.ts`
  - `src/services/report.dynamodb.ts`
  - `src/services/analytics.dynamodb.ts`

### 4. Utilitaires
- **Nouveau fichier**: `src/utils/dynamodb.ts` - Service DynamoDB générique

### 5. Jobs Cron
- **Nouveaux fichiers DynamoDB**:
  - `src/cron/jobs/transaction.dynamodb.ts`
  - `src/cron/jobs/report.dynamodb.ts`

## Variables d'environnement requises

Ajoutez ces variables à votre fichier `.env`:

```env
# DynamoDB Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
DYNAMODB_ENDPOINT=http://localhost:8000  # Pour DynamoDB local (optionnel)
```

## Installation des dépendances

```bash
npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb @aws-sdk/util-dynamodb uuid
```

## Création des tables DynamoDB

### Option 1: DynamoDB Local
```bash
# Installer DynamoDB Local
npm install -g dynamodb-local

# Démarrer DynamoDB Local
dynamodb-local --port 8000

# Créer les tables
node scripts/create-dynamodb-tables.js
```

### Option 2: AWS DynamoDB
```bash
# Configurer AWS CLI
aws configure

# Créer les tables
node scripts/create-dynamodb-tables.js
```

## Structure des tables

### Users
- **PK**: `USER#{userId}`
- **SK**: `USER#{userId}`
- **GSI1**: Email lookup (`EMAIL#{email}` -> `USER#{userId}`)

### Transactions
- **PK**: `USER#{userId}`
- **SK**: `TRANSACTION#{transactionId}`
- **GSI1**: Type lookup (`USER#{userId}#TYPE#{type}` -> `DATE#{date}#TRANSACTION#{transactionId}`)
- **GSI2**: Category lookup (`USER#{userId}#CATEGORY#{category}` -> `DATE#{date}#TRANSACTION#{transactionId}`)

### Reports
- **PK**: `USER#{userId}`
- **SK**: `REPORT#{reportId}`
- **GSI1**: Status lookup (`USER#{userId}#STATUS#{status}` -> `DATE#{sentDate}#REPORT#{reportId}`)

### Report Settings
- **PK**: `USER#{userId}`
- **SK**: `REPORT_SETTING#{userId}`

## Migration des données

Pour migrer les données existantes de MongoDB vers DynamoDB, vous devrez créer un script de migration personnalisé qui :

1. Lit les données de MongoDB
2. Transforme les données au format DynamoDB
3. Écrit les données dans DynamoDB

## Tests

Après la migration, testez les fonctionnalités suivantes :
- [ ] Inscription/Connexion utilisateur
- [ ] Création/Modification/Suppression de transactions
- [ ] Upload de photos de profil
- [ ] Scan de reçus
- [ ] Génération de rapports
- [ ] Analytics et graphiques
- [ ] Jobs cron (transactions récurrentes, rapports)

## Notes importantes

1. **Sessions de transaction**: DynamoDB utilise des transactions atomiques au lieu des sessions MongoDB
2. **Agrégations**: Les agrégations MongoDB ont été remplacées par des requêtes DynamoDB et des calculs en mémoire
3. **Pagination**: La pagination a été simplifiée pour DynamoDB
4. **Index**: Les index GSI permettent des requêtes efficaces par type, catégorie, et statut

## Dépannage

### Erreurs communes
1. **Table not found**: Vérifiez que les tables DynamoDB sont créées
2. **Access denied**: Vérifiez les credentials AWS
3. **Region mismatch**: Vérifiez que la région AWS est correcte

### Logs utiles
- Vérifiez les logs de connexion DynamoDB
- Surveillez les erreurs de requête dans les services
- Vérifiez les métriques CloudWatch pour DynamoDB
