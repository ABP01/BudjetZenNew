import { BlobServiceClient, ContainerClient, StorageSharedKeyCredential } from "@azure/storage-blob";
import { Env } from "./env.config";

// Configuration Azure Blob Storage avec support pour SAS et Shared Key
let blobServiceClient: BlobServiceClient;

if (Env.AZURE_STORAGE_CONNECTION_STRING) {
  // Utiliser la chaîne de connexion complète (recommandé)
  blobServiceClient = BlobServiceClient.fromConnectionString(Env.AZURE_STORAGE_CONNECTION_STRING);
} else if (Env.AZURE_STORAGE_SAS_URL) {
  // Utiliser l'URL SAS
  blobServiceClient = new BlobServiceClient(Env.AZURE_STORAGE_SAS_URL);
} else {
  // Fallback vers l'authentification par clé partagée
  const credential = new StorageSharedKeyCredential(Env.AZURE_STORAGE_ACCOUNT!, Env.AZURE_STORAGE_KEY!);
  blobServiceClient = new BlobServiceClient(
    `https://${Env.AZURE_STORAGE_ACCOUNT}.blob.core.windows.net`,
    credential
  );
}

// Noms des conteneurs pour les fichiers
export const CONTAINER_NAMES = {
  PROFILES: "profiles",
  INVOICES: "invoices", 
  DOCUMENTS: "documents",
} as const;

// Obtenir le client du conteneur
export const getContainerClient = (containerName: string = CONTAINER_NAMES.PROFILES): ContainerClient => {
  return blobServiceClient.getContainerClient(containerName);
};

// Créer les conteneurs s'ils n'existent pas
export const createContainersIfNotExists = async (): Promise<void> => {
  try {
    for (const containerName of Object.values(CONTAINER_NAMES)) {
      const containerClient = getContainerClient(containerName);
      await containerClient.createIfNotExists({
        access: "blob", // Accès public en lecture
      });
      console.log(`✅ Conteneur '${containerName}' créé ou vérifié`);
    }
  } catch (error) {
    console.error("❌ Erreur lors de la création des conteneurs:", error);
    throw error;
  }
};

// Uploader un fichier vers Blob Storage
export const uploadFile = async (
  file: Express.Multer.File,
  containerName: string = CONTAINER_NAMES.PROFILES,
  fileName?: string
): Promise<string> => {
  try {
    const containerClient = getContainerClient(containerName);
    const blobName = fileName || `${Date.now()}-${file.originalname}`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.upload(file.buffer, file.buffer.length, {
      blobHTTPHeaders: {
        blobContentType: file.mimetype,
      },
    });

    return blockBlobClient.url;
  } catch (error) {
    console.error("❌ Erreur lors de l'upload du fichier:", error);
    throw error;
  }
};

// Supprimer un fichier de Blob Storage
export const deleteFile = async (blobUrl: string, containerName?: string): Promise<void> => {
  try {
    // Extraire le nom du conteneur et du blob de l'URL
    const urlParts = blobUrl.split('/');
    const blobName = urlParts.pop();
    const extractedContainerName = urlParts[urlParts.length - 1];
    
    const containerClient = getContainerClient(containerName || extractedContainerName);
    if (blobName) {
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      await blockBlobClient.delete();
    }
  } catch (error) {
    console.error("❌ Erreur lors de la suppression du fichier:", error);
    throw error;
  }
};

// Obtenir l'URL publique d'un blob
export const getBlobUrl = (blobName: string, containerName: string = CONTAINER_NAMES.PROFILES): string => {
  const containerClient = getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  return blockBlobClient.url;
};

// Lister les fichiers dans le conteneur
export const listFiles = async (containerName: string = CONTAINER_NAMES.PROFILES, prefix?: string): Promise<string[]> => {
  try {
    const containerClient = getContainerClient(containerName);
    const files: string[] = [];
    
    for await (const blob of containerClient.listBlobsFlat({ prefix })) {
      files.push(blob.name);
    }
    
    return files;
  } catch (error) {
    console.error("❌ Erreur lors de la liste des fichiers:", error);
    throw error;
  }
};

// Tester la connexion à Blob Storage
export const testBlobStorageConnection = async (): Promise<boolean> => {
  try {
    await createContainersIfNotExists();
    console.log("✅ Connexion à Azure Blob Storage réussie");
    return true;
  } catch (error) {
    console.error("❌ Erreur de connexion à Azure Blob Storage:", error);
    return false;
  }
};

export default {
  getContainerClient,
  createContainersIfNotExists,
  uploadFile,
  deleteFile,
  getBlobUrl,
  listFiles,
  testBlobStorageConnection,
  CONTAINER_NAMES,
};
