/**
 * Database Configuration for MSSQL
 * Contains connection settings and database operations
 */

const sql = require("mssql");
require("dotenv").config();

class DatabaseConfig {
  constructor() {
    this.config = {
      server: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT) || 1433,
      database: process.env.DB_NAME || "TIASuite",
      user: process.env.DB_USERNAME || "username",
      password: process.env.DB_PASSWORD || "password",
      options: {
        encrypt: false, // Use true if you're on Windows Azure
        trustServerCertificate: true, // Use true if you're on Windows Azure
        enableArithAbort: true
      },
      pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
      }
    };

    this.schema = process.env.DB_SCHEMA || "Core";
    this.table = process.env.DB_TABLE || "Person";
    this.pool = null;
  }

  /**
   * Connect to the database
   */
  async connect() {
    try {
      if (!this.pool) {
        this.pool = await sql.connect(this.config);
        console.log("✅ Connected to MSSQL database successfully");
      }
      return this.pool;
    } catch (error) {
      console.error("❌ Database connection failed:", error);
      throw error;
    }
  }

  /**
   * Disconnect from the database
   */
  async disconnect() {
    try {
      if (this.pool) {
        await this.pool.close();
        this.pool = null;
        console.log("✅ Disconnected from MSSQL database");
      }
    } catch (error) {
      console.error("❌ Error disconnecting from database:", error);
      throw error;
    }
  }

  /**
   * Fetch all person records from the database
   */
  async fetchAllPersons(limit = null) {
    try {
      await this.connect();

      const limitClause = limit ? `TOP ${limit}` : "";
      const query = `
        SELECT ${limitClause} 
        Firstname, 
        Lastname 
        FROM [${this.schema}].[${this.table}]
        WHERE Firstname IS NOT NULL 
        AND Lastname IS NOT NULL
        AND Firstname != '' 
        AND Lastname != ''
      `;

      const result = await this.pool.request().query(query);
      console.log(
        `📊 Fetched ${result.recordset.length} person records from database`
      );

      return result.recordset;
    } catch (error) {
      console.error("❌ Error fetching persons from database:", error);
      throw error;
    }
  }

  /**
   * Search for persons with specific criteria
   */
  async searchPersons(criteria = {}) {
    try {
      await this.connect();

      let whereClause =
        "WHERE Firstname IS NOT NULL AND Lastname IS NOT NULL AND Firstname != '' AND Lastname != ''";
      const params = [];

      if (criteria.gender) {
        // Add gender filtering logic if needed
        // This would require additional columns in your database
      }

      if (criteria.limit) {
        whereClause += ` AND ROW_NUMBER() OVER (ORDER BY Firstname) <= ${criteria.limit}`;
      }

      const query = `
        SELECT Firstname, Lastname 
        FROM [${this.schema}].[${this.table}]
        ${whereClause}
      `;

      const result = await this.pool.request().query(query);
      console.log(
        `🔍 Found ${result.recordset.length} persons matching criteria`
      );

      return result.recordset;
    } catch (error) {
      console.error("❌ Error searching persons in database:", error);
      throw error;
    }
  }

  /**
   * Get database statistics
   */
  async getDatabaseStats() {
    try {
      await this.connect();

      const query = `
        SELECT 
          COUNT(*) as total_records,
          COUNT(DISTINCT Firstname) as unique_firstnames,
          COUNT(DISTINCT Lastname) as unique_lastnames
        FROM [${this.schema}].[${this.table}]
        WHERE Firstname IS NOT NULL 
        AND Lastname IS NOT NULL
        AND Firstname != '' 
        AND Lastname != ''
      `;

      const result = await this.pool.request().query(query);
      return result.recordset[0];
    } catch (error) {
      console.error("❌ Error getting database statistics:", error);
      throw error;
    }
  }

  /**
   * Test database connection
   */
  async testConnection() {
    try {
      await this.connect();
      const result = await this.pool.request().query("SELECT 1 as test");
      console.log("✅ Database connection test successful");
      return true;
    } catch (error) {
      console.error("❌ Database connection test failed:", error);
      return false;
    }
  }
}

module.exports = DatabaseConfig;
