import { dynamoDB, TABLE_NAMES } from "../config/dynamodb.config";
import { compareValue, hashValue } from "../utils/bcrypt";
import { DynamoDBItem, DynamoDBService } from "../utils/dynamodb";

export interface UserDocument extends DynamoDBItem {
  PK: string; // USER#{userId}
  SK: string; // USER#{userId} (same as PK for single item)
  GSI1PK: string; // EMAIL#{email} for email lookup
  GSI1SK: string; // USER#{userId}
  name: string;
  email: string;
  password: string;
  profilePicture?: string | null;
  omitPassword: () => Omit<UserDocument, "password">;
  comparePassword: (password: string) => Promise<boolean>;
}

export class UserModel {
  private static dbService = new DynamoDBService(dynamoDB, TABLE_NAMES.USERS);

  // Create user
  static async create(userData: {
    name: string;
    email: string;
    password: string;
    profilePicture?: string | null;
  }): Promise<UserDocument> {
    const userId = this.dbService.generateId();
    const hashedPassword = await hashValue(userData.password);
    
    const user: Partial<UserDocument> = {
      PK: `USER#${userId}`,
      SK: `USER#${userId}`,
      GSI1PK: `EMAIL#${userData.email.toLowerCase()}`,
      GSI1SK: `USER#${userId}`,
      name: userData.name,
      email: userData.email.toLowerCase(),
      password: hashedPassword,
      profilePicture: userData.profilePicture || null,
    };

    const createdUser = await this.dbService.create(user);
    return this.addMethods(createdUser);
  }

  // Find by ID
  static async findById(userId: string): Promise<UserDocument | null> {
    const user = await this.dbService.getById(`USER#${userId}`);
    return user ? this.addMethods(user) : null;
  }

  // Find by email
  static async findByEmail(email: string): Promise<UserDocument | null> {
    const users = await this.dbService.queryByGSI(
      "GSI1", // Email index
      `EMAIL#${email.toLowerCase()}`
    );
    
    if (users.length === 0) return null;
    
    // Get the full user record
    const user = await this.dbService.getById(users[0].PK, users[0].SK);
    return user ? this.addMethods(user) : null;
  }

  // Update user
  static async updateById(
    userId: string, 
    updates: Partial<{
      name: string;
      email: string;
      password: string;
      profilePicture: string | null;
    }>
  ): Promise<UserDocument | null> {
    // Hash password if provided
    if (updates.password) {
      updates.password = await hashValue(updates.password);
    }

    // If email is being updated, we need to handle GSI1
    if (updates.email) {
      const currentUser = await this.findById(userId);
      if (!currentUser) return null;

      // Update the user record
      const updatedUser = await this.dbService.update(
        `USER#${userId}`,
        `USER#${userId}`,
        {
          ...updates,
          email: updates.email.toLowerCase(),
          GSI1PK: `EMAIL#${updates.email.toLowerCase()}`,
        }
      );

      return this.addMethods(updatedUser);
    } else {
      const updatedUser = await this.dbService.update(
        `USER#${userId}`,
        `USER#${userId}`,
        updates
      );

      return this.addMethods(updatedUser);
    }
  }

  // Delete user
  static async deleteById(userId: string): Promise<void> {
    await this.dbService.delete(`USER#${userId}`);
  }

  // Add methods to user object
  private static addMethods(user: DynamoDBItem): UserDocument {
    const userDoc = user as UserDocument;
    
    userDoc.omitPassword = function(): Omit<UserDocument, "password"> {
      const { password, ...userWithoutPassword } = this;
      return userWithoutPassword;
    };

    userDoc.comparePassword = async function(password: string): Promise<boolean> {
      return compareValue(password, this.password);
    };

    return userDoc;
  }

  // Extract userId from PK
  static extractUserId(PK: string): string {
    return PK.replace("USER#", "");
  }
}

export default UserModel;
