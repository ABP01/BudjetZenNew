import { Request, TYPES } from "mssql";
import { v4 as uuidv4 } from "uuid";
import { getConnection } from "../config/azure-sql.config";

export interface SQLItem {
  id: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: any;
}

export class SQLService {
  constructor(private tableName: string) {}

  // Generate unique ID
  generateId(): string {
    return uuidv4();
  }

  // Create item
  async create(item: Partial<SQLItem>): Promise<SQLItem> {
    const connection = await getConnection();
    const request = new Request(connection);
    
    const id = this.generateId();
    const now = new Date();
    
    const newItem: SQLItem = {
      id,
      userId: item.userId || "",
      createdAt: now,
      updatedAt: now,
      ...item,
    };

    // Construire la requête INSERT dynamique
    const columns = Object.keys(newItem).filter(key => key !== 'id');
    const values = columns.map((_, index) => `@${index + 1}`);
    const columnNames = columns.join(', ');
    const valuePlaceholders = values.join(', ');

    const query = `
      INSERT INTO ${this.tableName} (id, ${columnNames})
      VALUES (@id, ${valuePlaceholders})
    `;

    // Set parameters before executing query
    request.input('id', TYPES.UniqueIdentifier, id);
    
    columns.forEach((column, index) => {
      const value = newItem[column];
      if (value instanceof Date) {
        request.input(`${index + 1}`, TYPES.DateTime2, value);
      } else if (typeof value === 'string') {
        request.input(`${index + 1}`, TYPES.NVarChar, value);
      } else if (typeof value === 'number') {
        request.input(`${index + 1}`, TYPES.Decimal, value);
      } else if (typeof value === 'boolean') {
        request.input(`${index + 1}`, TYPES.Bit, value);
      } else {
        request.input(`${index + 1}`, TYPES.NVarChar, value?.toString() || null);
      }
    });

    await request.query(query);
    return newItem;
  }

  // Get item by ID
  async getById(id: string, userId: string): Promise<SQLItem | null> {
    const connection = await getConnection();
    const request = new Request(connection);
    
    request.input('id', TYPES.UniqueIdentifier, id);
    request.input('userId', TYPES.UniqueIdentifier, userId);
    
    const result = await request.query(`
      SELECT * FROM ${this.tableName} 
      WHERE id = @id AND userId = @userId
    `);

    return result.recordset[0] || null;
  }

  // Update item
  async update(
    id: string,
    userId: string,
    updates: Partial<SQLItem>
  ): Promise<SQLItem | null> {
    const connection = await getConnection();
    const request = new Request(connection);
    
    const now = new Date();
    const updateData = {
      ...updates,
      updatedAt: now,
    };

    // Construire la requête UPDATE dynamique
    const columns = Object.keys(updateData).filter(key => key !== 'id' && key !== 'userId');
    const setClause = columns.map((col, index) => `${col} = @${index + 1}`).join(', ');

    const query = `
      UPDATE ${this.tableName} 
      SET ${setClause}
      WHERE id = @id AND userId = @userId
    `;

    const result = await request.query(query);
    request.input('id', TYPES.UniqueIdentifier, id);
    request.input('userId', TYPES.UniqueIdentifier, userId);
    
    columns.forEach((column, index) => {
      const value = (updateData as any)[column];
      if (value instanceof Date) {
        request.input(`${index + 1}`, TYPES.DateTime2, value);
      } else if (typeof value === 'string') {
        request.input(`${index + 1}`, TYPES.NVarChar, value);
      } else if (typeof value === 'number') {
        request.input(`${index + 1}`, TYPES.Decimal, value);
      } else if (typeof value === 'boolean') {
        request.input(`${index + 1}`, TYPES.Bit, value);
      } else {
        request.input(`${index + 1}`, TYPES.NVarChar, value?.toString() || null);
      }
    });

    await request.query(query);
    
    // Récupérer l'élément mis à jour
    return await this.getById(id, userId);
  }

  // Delete item
  async delete(id: string, userId: string): Promise<void> {
    const connection = await getConnection();
    const request = new Request(connection);
    
    request.input('id', TYPES.UniqueIdentifier, id);
    request.input('userId', TYPES.UniqueIdentifier, userId);
    
    await request.query(`
      DELETE FROM ${this.tableName} 
      WHERE id = @id AND userId = @userId
    `);
  }

  // Query by userId
  async queryByUserId(userId: string): Promise<SQLItem[]> {
    const connection = await getConnection();
    const request = new Request(connection);
    
    request.input('userId', TYPES.UniqueIdentifier, userId);
    
    const result = await request.query(`
      SELECT * FROM ${this.tableName} 
      WHERE userId = @userId
      ORDER BY createdAt DESC
    `);

    return result.recordset;
  }

  // Query with filters
  async queryWithFilters(
    userId: string,
    filters: { field: string; operator: string; value: any }[] = [],
    orderBy: string = "createdAt DESC",
    limit?: number,
    offset?: number
  ): Promise<SQLItem[]> {
    const connection = await getConnection();
    const request = new Request(connection);
    
    let query = `SELECT * FROM ${this.tableName} WHERE userId = @userId`;
    request.input('userId', TYPES.UniqueIdentifier, userId);

    // Ajouter les filtres
    filters.forEach((filter, index) => {
      const paramName = `filter${index}`;
      query += ` AND ${filter.field} ${filter.operator} @${paramName}`;
      request.input(paramName, TYPES.NVarChar, filter.value);
    });

    // Ajouter l'ordre
    query += ` ORDER BY ${orderBy}`;

    // Ajouter la pagination
    if (limit) {
      query += ` OFFSET ${offset || 0} ROWS FETCH NEXT ${limit} ROWS ONLY`;
    }

    const result = await request.query(query);
    return result.recordset;
  }

  // Count items
  async count(userId?: string): Promise<number> {
    const connection = await getConnection();
    const request = new Request(connection);
    
    let query = `SELECT COUNT(*) as count FROM ${this.tableName}`;
    
    if (userId) {
      query += ` WHERE userId = @userId`;
      request.input('userId', TYPES.UniqueIdentifier, userId);
    }

    const result = await request.query(query);
    return result.recordset[0].count;
  }

  // Bulk insert
  async bulkInsert(items: Partial<SQLItem>[]): Promise<void> {
    const connection = await getConnection();
    const transaction = connection.transaction();
    
    try {
      await transaction.begin();
      
      for (const item of items) {
        const request = new Request(transaction);
        const id = this.generateId();
        const now = new Date();
        
        const newItem: SQLItem = {
          id,
          userId: item.userId || "",
          createdAt: now,
          updatedAt: now,
          ...item,
        };

        // Construire la requête INSERT
        const columns = Object.keys(newItem).filter(key => key !== 'id');
        const values = columns.map((_, index) => `@${index + 1}`);
        const columnNames = columns.join(', ');
        const valuePlaceholders = values.join(', ');

        const query = `
          INSERT INTO ${this.tableName} (id, ${columnNames})
          VALUES (@id, ${valuePlaceholders})
        `;

        const result = await request.query(query);
        request.input('id', TYPES.UniqueIdentifier, id);
        
        columns.forEach((column, index) => {
          const value = newItem[column];
          if (value instanceof Date) {
            request.input(`${index + 1}`, TYPES.DateTime2, value);
          } else if (typeof value === 'string') {
            request.input(`${index + 1}`, TYPES.NVarChar, value);
          } else if (typeof value === 'number') {
            request.input(`${index + 1}`, TYPES.Decimal, value);
          } else if (typeof value === 'boolean') {
            request.input(`${index + 1}`, TYPES.Bit, value);
          } else {
            request.input(`${index + 1}`, TYPES.NVarChar, value?.toString() || null);
          }
        });

        await request.query(query);
      }
      
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  // Bulk delete
  async bulkDelete(ids: string[], userId: string): Promise<void> {
    const connection = await getConnection();
    const request = new Request(connection);
    
    request.input('userId', TYPES.UniqueIdentifier, userId);
    
    // Construire la liste des IDs pour la clause IN
    const idParams = ids.map((_, index) => `@id${index}`).join(', ');
    ids.forEach((id, index) => {
      request.input(`id${index}`, TYPES.UniqueIdentifier, id);
    });

    await request.query(`
      DELETE FROM ${this.tableName} 
      WHERE userId = @userId AND id IN (${idParams})
    `);
  }

  // Execute custom query
  async executeQuery(query: string, params: { [key: string]: any } = {}): Promise<any[]> {
    const connection = await getConnection();
    const request = new Request(connection);
    
    // Ajouter les paramètres
    Object.keys(params).forEach(key => {
      const value = params[key];
      if (value instanceof Date) {
        request.input(key, TYPES.DateTime2, value);
      } else if (typeof value === 'string') {
        request.input(key, TYPES.NVarChar, value);
      } else if (typeof value === 'number') {
        request.input(key, TYPES.Decimal, value);
      } else if (typeof value === 'boolean') {
        request.input(key, TYPES.Bit, value);
      } else {
        request.input(key, TYPES.NVarChar, value?.toString() || null);
      }
    });

    const result = await request.query(query);
    return result.recordset;
  }
}
