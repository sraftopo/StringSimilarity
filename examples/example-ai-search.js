/**
 * Example usage of AI Name Database Checker
 * Demonstrates how to use the AINameDBSearcher for intelligent Greek name search
 */

const AINameDBSearcher = require("./ai_name_db_checker.js");
const mysql = require("mysql2/promise");

class DatabaseIntegration {
  constructor(dbConfig) {
    this.dbConfig = dbConfig;
    this.connection = null;
  }

  async connect() {
    try {
      this.connection = await mysql.createConnection(this.dbConfig);
      console.log("Database connected successfully");
    } catch (error) {
      console.error("Database connection failed:", error);
      throw error;
    }
  }

  async disconnect() {
    if (this.connection) {
      await this.connection.end();
      console.log("Database disconnected");
    }
  }

  async fetchNamesFromDatabase(tableName = "names", limit = null) {
    if (!this.connection) {
      throw new Error("Database not connected");
    }

    try {
      const limitClause = limit ? `LIMIT ${limit}` : "";
      const query = `SELECT Firstname, Lastname FROM ${tableName} ${limitClause}`;

      const [rows] = await this.connection.execute(query);
      console.log(`Fetched ${rows.length} records from database`);
      return rows;
    } catch (error) {
      console.error("Error fetching data from database:", error);
      throw error;
    }
  }

  async searchInDatabase(
    searcher,
    firstName,
    lastName,
    tableName = "names",
    options = {}
  ) {
    try {
      // Fetch all records from database
      const records = await this.fetchNamesFromDatabase(
        tableName,
        options.limit
      );

      // Perform semantic search
      const results = await searcher.searchNames(
        firstName,
        lastName,
        records,
        options
      );

      return results;
    } catch (error) {
      console.error("Error searching in database:", error);
      throw error;
    }
  }
}

// Example usage scenarios
async function runExamples() {
  console.log("AI Name Database Checker - Example Usage");
  console.log("========================================\n");

  // Initialize the AI searcher
  const searcher = new AINameDBSearcher({
    batchSize: 1000, // Process 1000 records at a time
    similarityThreshold: 0.7, // 70% similarity threshold
    maxResults: 50, // Return top 50 results
    useGPU: false // Use CPU for better compatibility
  });

  // Example 1: Basic search with sample data
  console.log("Example 1: Basic Search with Sample Data");
  console.log("----------------------------------------");

  const sampleData = [
    { Firstname: "Γιάννης", Lastname: "Παπαδόπουλος" },
    { Firstname: "Μαρία", Lastname: "Κωνσταντίνου" },
    { Firstname: "Νίκος", Lastname: "Αντωνίου" },
    { Firstname: "Ελένη", Lastname: "Δημητρίου" },
    { Firstname: "Κώστας", Lastname: "Γεωργίου" },
    { Firstname: "Σοφία", Lastname: "Μιχαήλ" },
    { Firstname: "Δημήτρης", Lastname: "Αλεξάνδρου" },
    { Firstname: "Αναστασία", Lastname: "Βασιλείου" },
    { Firstname: "Γεώργιος", Lastname: "Νικολάου" },
    { Firstname: "Κατερίνα", Lastname: "Παύλου" },
    { Firstname: "Ιωάννης", Lastname: "Παπαδόπουλος" },
    { Firstname: "Ευαγγελία", Lastname: "Κωνσταντίνου" },
    { Firstname: "Μιχάλης", Lastname: "Αντωνίου" },
    { Firstname: "Αλέξανδρος", Lastname: "Δημητρίου" },
    { Firstname: "Βασίλης", Lastname: "Γεωργίου" }
  ];

  try {
    // Search for a specific name
    const results1 = await searcher.searchNames(
      "Γιάννης",
      "Παπαδόπουλος",
      sampleData
    );
    console.log(
      `Found ${results1.results.length} matches for "Γιάννης Παπαδόπουλος":`
    );
    results1.results.forEach((result, index) => {
      console.log(
        `  ${index + 1}. ${result.fullName} (${(
          result.similarity * 100
        ).toFixed(1)}% similarity)`
      );
    });

    // Search with Latin transliteration
    const results2 = await searcher.searchNames(
      "Giannis",
      "Papadopoulos",
      sampleData
    );
    console.log(
      `\nFound ${results2.results.length} matches for "Giannis Papadopoulos" (Latin):`
    );
    results2.results.forEach((result, index) => {
      console.log(
        `  ${index + 1}. ${result.fullName} (${(
          result.similarity * 100
        ).toFixed(1)}% similarity)`
      );
    });

    // Partial name search
    const results3 = await searcher.searchPartialName("Μαρ", sampleData);
    console.log(
      `\nFound ${results3.results.length} matches for partial name "Μαρ":`
    );
    results3.results.forEach((result, index) => {
      console.log(
        `  ${index + 1}. ${result.fullName} (${(
          result.similarity * 100
        ).toFixed(1)}% similarity)`
      );
    });
  } catch (error) {
    console.error("Error in basic search:", error);
  }

  // Example 2: Database integration (commented out - requires actual database)
  console.log("\n\nExample 2: Database Integration");
  console.log("--------------------------------");
  console.log(
    "Note: This example requires a MySQL database with a names table"
  );

  /*
  const dbConfig = {
    host: 'localhost',
    user: 'your_username',
    password: 'your_password',
    database: 'your_database'
  };

  const dbIntegration = new DatabaseIntegration(dbConfig);
  
  try {
    await dbIntegration.connect();
    
    // Search in actual database
    const dbResults = await dbIntegration.searchInDatabase(
      searcher, 
      'Γιάννης', 
      'Παπαδόπουλος', 
      'names',
      { limit: 10000 } // Limit to 10k records for demo
    );
    
    console.log(`Database search found ${dbResults.results.length} matches`);
    
    await dbIntegration.disconnect();
  } catch (error) {
    console.error('Database integration error:', error);
  }
  */

  // Example 3: Advanced search options
  console.log("\n\nExample 3: Advanced Search Options");
  console.log("----------------------------------");

  try {
    // Gender-filtered search
    const genderResults = await searcher.searchNames("", "", sampleData, {
      gender: "feminine",
      minSimilarity: 0.6,
      maxResults: 10
    });

    console.log(`Found ${genderResults.results.length} female names:`);
    genderResults.results.forEach((result, index) => {
      console.log(
        `  ${index + 1}. ${result.fullName} (${(
          result.similarity * 100
        ).toFixed(1)}% similarity)`
      );
    });

    // Low similarity threshold for broader matches
    const broadResults = await searcher.searchNames("Γιάννης", "", sampleData, {
      similarityThreshold: 0.3,
      maxResults: 5
    });

    console.log(`\nBroad search found ${broadResults.results.length} matches:`);
    broadResults.results.forEach((result, index) => {
      console.log(
        `  ${index + 1}. ${result.fullName} (${(
          result.similarity * 100
        ).toFixed(1)}% similarity)`
      );
    });
  } catch (error) {
    console.error("Error in advanced search:", error);
  }

  // Example 4: Performance testing with large dataset
  console.log("\n\nExample 4: Performance Testing");
  console.log("-------------------------------");

  // Generate a larger dataset for testing
  const largeDataset = generateLargeDataset(1000);
  console.log(`Generated ${largeDataset.length} test records`);

  try {
    const startTime = Date.now();
    const performanceResults = await searcher.searchNames(
      "Γιάννης",
      "Παπαδόπουλος",
      largeDataset
    );
    const endTime = Date.now();

    console.log(`Performance test completed in ${endTime - startTime}ms`);
    console.log(`Found ${performanceResults.results.length} matches`);
    console.log(`Processed ${performanceResults.totalProcessed} records`);

    // Display search statistics
    const stats = searcher.getSearchStats();
    console.log("\nSearch Statistics:");
    console.log(`  Initialized: ${stats.isInitialized}`);
    console.log(`  Batch Size: ${stats.batchSize}`);
    console.log(`  Similarity Threshold: ${stats.similarityThreshold}`);
    console.log(`  Cache Size: ${stats.embeddingsCacheSize}`);
    console.log(
      `  Memory Usage: ${Math.round(
        stats.memoryUsage.heapUsed / 1024 / 1024
      )}MB`
    );
  } catch (error) {
    console.error("Error in performance test:", error);
  }

  // Clean up
  searcher.dispose();
  console.log("\nExample completed successfully!");
}

// Helper function to generate large dataset for testing
function generateLargeDataset(size) {
  const firstNames = [
    "Γιάννης",
    "Μαρία",
    "Νίκος",
    "Ελένη",
    "Κώστας",
    "Σοφία",
    "Δημήτρης",
    "Αναστασία",
    "Γεώργιος",
    "Κατερίνα",
    "Ιωάννης",
    "Ευαγγελία",
    "Μιχάλης",
    "Αλέξανδρος",
    "Βασίλης",
    "Χριστίνα",
    "Παναγιώτης",
    "Αγγελική",
    "Σπύρος"
  ];

  const lastNames = [
    "Παπαδόπουλος",
    "Κωνσταντίνου",
    "Αντωνίου",
    "Δημητρίου",
    "Γεωργίου",
    "Μιχαήλ",
    "Αλεξάνδρου",
    "Βασιλείου",
    "Νικολάου",
    "Παύλου",
    "Κωνσταντίνου",
    "Παπαγιάννη",
    "Δημητρίου",
    "Αντωνίου",
    "Γεωργίου",
    "Μιχαήλ",
    "Αλεξάνδρου"
  ];

  const dataset = [];
  for (let i = 0; i < size; i++) {
    dataset.push({
      Firstname: firstNames[Math.floor(Math.random() * firstNames.length)],
      Lastname: lastNames[Math.floor(Math.random() * lastNames.length)]
    });
  }

  return dataset;
}

// Run examples if this file is executed directly
if (require.main === module) {
  runExamples().catch(console.error);
}

module.exports = { DatabaseIntegration, runExamples };

