import { SQLItem, SQLService } from "../utils/azure-sql";
import { compareValue, hashValue } from "../utils/bcrypt";

export interface UserDocument extends SQLItem {
  name: string;
  email: string;
  password: string;
  profilePicture?: string | null;
  omitPassword: () => Omit<UserDocument, "password">;
  comparePassword: (password: string) => Promise<boolean>;
}

export class UserModel {
  private static sqlService = new SQLService("users");

  // Create user
  static async create(userData: {
    name: string;
    email: string;
    password: string;
    profilePicture?: string | null;
  }): Promise<UserDocument> {
    const userId = this.sqlService.generateId();
    const hashedPassword = await hashValue(userData.password);
    
    const user: Partial<UserDocument> = {
      userId,
      name: userData.name,
      email: userData.email.toLowerCase(),
      password: hashedPassword,
      profilePicture: userData.profilePicture || null,
    };

    const createdUser = await this.sqlService.create(user);
    return this.addMethods(createdUser);
  }

  // Find by ID
  static async findById(userId: string): Promise<UserDocument | null> {
    const user = await this.sqlService.getById(userId, userId);
    return user ? this.addMethods(user) : null;
  }

  // Find by email
  static async findByEmail(email: string): Promise<UserDocument | null> {
    const users = await this.sqlService.executeQuery(
      "SELECT * FROM users WHERE email = @email",
      { email: email.toLowerCase() }
    );
    
    if (users.length === 0) return null;
    
    return this.addMethods(users[0]);
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

    // Convert email to lowercase if provided
    if (updates.email) {
      updates.email = updates.email.toLowerCase();
    }

    try {
      const updatedUser = await this.sqlService.update(userId, userId, updates);
      return updatedUser ? this.addMethods(updatedUser) : null;
    } catch (error) {
      return null;
    }
  }

  // Delete user
  static async deleteById(userId: string): Promise<void> {
    await this.sqlService.delete(userId, userId);
  }

  // Add methods to user object
  private static addMethods(user: SQLItem): UserDocument {
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

  // Get all users (for admin purposes)
  static async findAll(): Promise<UserDocument[]> {
    const users = await this.sqlService.executeQuery("SELECT * FROM users ORDER BY createdAt DESC");
    return users.map(user => this.addMethods(user));
  }

  // Count users
  static async count(): Promise<number> {
    return await this.sqlService.count();
  }

  // Search users by name or email
  static async search(searchTerm: string): Promise<UserDocument[]> {
    const users = await this.sqlService.executeQuery(
      "SELECT * FROM users WHERE name LIKE @searchTerm OR email LIKE @searchTerm ORDER BY createdAt DESC",
      { searchTerm: `%${searchTerm}%` }
    );
    return users.map(user => this.addMethods(user));
  }
}

export default UserModel;
