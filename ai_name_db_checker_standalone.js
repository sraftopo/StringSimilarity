/**
 * Standalone AI-Powered Greek Name Database Semantic Search Library
 * Uses custom similarity algorithms without external dependencies
 * Works with in-memory data for testing and demonstration
 */

const GreekNameCorrector = require("./greeknames_rules.js");

class AINameDBSearcherStandalone {
  constructor(options = {}) {
    this.options = {
      batchSize: options.batchSize || 1000,
      maxResults: options.maxResults || 50,
      similarityThreshold: options.similarityThreshold || 0.7,
      ...options
    };

    this.nameCorrector = new GreekNameCorrector();
    this.embeddingsCache = new Map();
    this.isInitialized = true;
    this.sampleData = this.generateSampleData();

    console.log("✅ Standalone AI Name Database Searcher initialized");
  }

  /**
   * Generate sample Greek names for testing
   */
  generateSampleData() {
    return [
      { Firstname: "Γιάννης", Lastname: "Παπαδόπουλος" },
      { Firstname: "Μαρία", Lastname: "Κωνσταντίνου" },
      { Firstname: "Νίκος", Lastname: "Αλεξίου" },
      { Firstname: "Ελένη", Lastname: "Δημητρίου" },
      { Firstname: "Κώστας", Lastname: "Παπαγιάννης" },
      { Firstname: "Αννα", Lastname: "Γεωργίου" },
      { Firstname: "Δημήτρης", Lastname: "Νικολάου" },
      { Firstname: "Σοφία", Lastname: "Αντωνίου" },
      { Firstname: "Αλέξανδρος", Lastname: "Παπαδάκης" },
      { Firstname: "Χριστίνα", Lastname: "Βασιλείου" },
      { Firstname: "Μιχάλης", Lastname: "Παπαδόπουλος" },
      { Firstname: "Ευαγγελία", Lastname: "Κωνσταντίνου" },
      { Firstname: "Αντώνης", Lastname: "Αλεξίου" },
      { Firstname: "Κατερίνα", Lastname: "Δημητρίου" },
      { Firstname: "Γιώργος", Lastname: "Παπαγιάννης" },
      { Firstname: "Δέσποινα", Lastname: "Γεωργίου" },
      { Firstname: "Παύλος", Lastname: "Νικολάου" },
      { Firstname: "Αγγελική", Lastname: "Αντωνίου" },
      { Firstname: "Σπύρος", Lastname: "Παπαδάκης" },
      { Firstname: "Ειρήνη", Lastname: "Βασιλείου" }
    ];
  }

  /**
   * Create embeddings using custom algorithms
   */
  createEmbedding(text) {
    const normalizedText = this.normalizeGreekText(text);
    const embedding = new Array(64).fill(0);

    // Character frequency features
    for (let i = 0; i < normalizedText.length; i++) {
      const charCode = normalizedText.charCodeAt(i) % 64;
      embedding[charCode]++;
    }

    // Length and structure features
    embedding[0] = Math.min(normalizedText.length / 50, 1); // Normalized length
    embedding[1] =
      this.countVowels(normalizedText) / Math.max(normalizedText.length, 1);
    embedding[2] =
      this.countConsonants(normalizedText) / Math.max(normalizedText.length, 1);

    // Greek-specific features
    embedding[3] = this.hasGreekEnding(normalizedText) ? 1 : 0;
    embedding[4] = this.detectGenderFromEnding(normalizedText);

    // Phonetic features
    embedding[5] = this.calculatePhoneticSimilarity(normalizedText);

    return embedding;
  }

  /**
   * Normalize Greek text for processing
   */
  normalizeGreekText(text) {
    if (!text) return "";

    return text
      .toLowerCase()
      .trim()
      .replace(/[^\u0370-\u03FF\u0041-\u005A\u0061-\u007A]/g, "") // Keep Greek and Latin letters
      .replace(/\s+/g, " ");
  }

  /**
   * Count vowels in Greek text
   */
  countVowels(text) {
    const vowels = /[αεηιουωάέήίόύώ]/gi;
    return (text.match(vowels) || []).length;
  }

  /**
   * Count consonants in Greek text
   */
  countConsonants(text) {
    const consonants = /[βγδζθκλμνξπρστφχψ]/gi;
    return (text.match(consonants) || []).length;
  }

  /**
   * Check if text has Greek name ending
   */
  hasGreekEnding(text) {
    const greekEndings = ["ος", "ης", "ας", "α", "η", "ω", "ου", "ού"];
    return greekEndings.some((ending) => text.endsWith(ending));
  }

  /**
   * Detect gender from Greek name ending
   */
  detectGenderFromEnding(text) {
    const masculineEndings = ["ος", "ης", "ας"];
    const feminineEndings = ["α", "η", "ω"];

    if (masculineEndings.some((ending) => text.endsWith(ending))) return 1;
    if (feminineEndings.some((ending) => text.endsWith(ending))) return 0.5;
    return 0;
  }

  /**
   * Calculate phonetic similarity
   */
  calculatePhoneticSimilarity(text) {
    // Simple phonetic scoring based on common Greek name patterns
    const phoneticScore = text.split("").reduce((score, char) => {
      const charCode = char.charCodeAt(0);
      if (charCode >= 0x0370 && charCode <= 0x03ff) {
        // Greek characters
        return score + 1;
      }
      return score;
    }, 0);

    return phoneticScore / Math.max(text.length, 1);
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  calculateCosineSimilarity(embedding1, embedding2) {
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);

    if (norm1 === 0 || norm2 === 0) return 0;
    return dotProduct / (norm1 * norm2);
  }

  /**
   * Process database records in batches
   */
  async processBatch(records, queryEmbedding) {
    const results = [];

    for (let i = 0; i < records.length; i += this.options.batchSize) {
      const batch = records.slice(i, i + this.options.batchSize);

      try {
        // Generate embeddings for the batch
        const batchEmbeddings = batch.map((record) => {
          const fullName = `${record.Firstname || ""} ${
            record.Lastname || ""
          }`.trim();
          return this.createEmbedding(fullName);
        });

        // Calculate similarities
        for (let j = 0; j < batch.length; j++) {
          const similarity = this.calculateCosineSimilarity(
            queryEmbedding,
            batchEmbeddings[j]
          );

          if (similarity >= this.options.similarityThreshold) {
            results.push({
              ...batch[j],
              similarity: similarity,
              fullName: `${batch[j].Firstname || ""} ${
                batch[j].Lastname || ""
              }`.trim()
            });
          }
        }

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      } catch (error) {
        console.error(
          `Error processing batch ${i}-${i + this.options.batchSize}:`,
          error
        );
        continue;
      }
    }

    return results;
  }

  /**
   * Main search function - searches in sample data
   * @param {string} firstName - First name to search for
   * @param {string} lastName - Last name to search for
   * @param {Object} options - Search options
   * @returns {Promise<Array>} - Array of matching records with similarity scores
   */
  async searchNames(firstName, lastName, options = {}) {
    if (!firstName && !lastName) {
      throw new Error("At least one name (first or last) must be provided");
    }

    try {
      console.log(
        `Starting semantic search for: ${firstName || ""} ${lastName || ""}`
      );

      // Normalize and correct the input names
      const correctedFirstName = firstName
        ? this.nameCorrector.correctName(firstName.trim()).corrected
        : "";
      const correctedLastName = lastName
        ? this.nameCorrector.correctName(lastName.trim()).corrected
        : "";

      const queryText = `${correctedFirstName} ${correctedLastName}`.trim();
      console.log(`Corrected query: ${queryText}`);

      // Use sample data
      const databaseRecords = this.sampleData.slice(
        0,
        options.limit || this.sampleData.length
      );

      if (databaseRecords.length === 0) {
        console.log("No records found");
        return {
          query: {
            original: { firstName, lastName },
            corrected: {
              firstName: correctedFirstName,
              lastName: correctedLastName
            },
            processed: queryText
          },
          results: [],
          totalProcessed: 0,
          searchTime: Date.now()
        };
      }

      console.log(`Processing ${databaseRecords.length} database records...`);

      // Generate embedding for the query
      const queryEmbedding = this.createEmbedding(queryText);

      // Process database records in batches
      const results = await this.processBatch(databaseRecords, queryEmbedding);

      // Sort by similarity score (highest first)
      results.sort((a, b) => b.similarity - a.similarity);

      // Apply additional filters if specified
      let filteredResults = results;

      if (options.gender) {
        filteredResults = filteredResults.filter((record) => {
          const recordGender = this.nameCorrector.detectGender(
            record.Firstname
          );
          return recordGender === options.gender || recordGender === "unknown";
        });
      }

      if (options.minSimilarity) {
        filteredResults = filteredResults.filter(
          (record) => record.similarity >= options.minSimilarity
        );
      }

      // Limit results
      const maxResults = options.maxResults || this.options.maxResults;
      const finalResults = filteredResults.slice(0, maxResults);

      console.log(`Found ${finalResults.length} matching records`);

      return {
        query: {
          original: { firstName, lastName },
          corrected: {
            firstName: correctedFirstName,
            lastName: correctedLastName
          },
          processed: queryText
        },
        results: finalResults,
        totalProcessed: databaseRecords.length,
        searchTime: Date.now()
      };
    } catch (error) {
      console.error("Error in semantic search:", error);
      throw error;
    }
  }

  /**
   * Search with fuzzy matching for partial names
   * @param {string} partialName - Partial name to search for
   * @param {Object} options - Search options
   */
  async searchPartialName(partialName, options = {}) {
    if (!partialName || partialName.trim().length < 2) {
      throw new Error("Partial name must be at least 2 characters long");
    }

    // Split partial name into possible first/last name parts
    const nameParts = partialName.trim().split(/\s+/);
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    return await this.searchNames(firstName, lastName, {
      ...options,
      similarityThreshold: options.similarityThreshold || 0.5 // Lower threshold for partial matches
    });
  }

  /**
   * Get database statistics
   */
  async getDatabaseStats() {
    return {
      total_records: this.sampleData.length,
      unique_firstnames: new Set(this.sampleData.map((r) => r.Firstname)).size,
      unique_lastnames: new Set(this.sampleData.map((r) => r.Lastname)).size
    };
  }

  /**
   * Test database connection (always returns true for standalone)
   */
  async testDatabaseConnection() {
    return true;
  }

  /**
   * Get search statistics and performance metrics
   */
  getSearchStats() {
    return {
      isInitialized: this.isInitialized,
      batchSize: this.options.batchSize,
      similarityThreshold: this.options.similarityThreshold,
      embeddingsCacheSize: this.embeddingsCache.size,
      memoryUsage: process.memoryUsage()
    };
  }

  /**
   * Clear embeddings cache to free memory
   */
  clearCache() {
    this.embeddingsCache.clear();
    if (global.gc) {
      global.gc();
    }
    console.log("Embeddings cache cleared");
  }

  /**
   * Dispose of resources
   */
  async dispose() {
    this.clearCache();
    this.isInitialized = false;
    console.log("AINameDBSearcherStandalone disposed");
  }
}

// Export the class
module.exports = AINameDBSearcherStandalone;

// Example usage and testing
if (require.main === module) {
  (async () => {
    try {
      // Initialize the searcher
      const searcher = new AINameDBSearcherStandalone({
        batchSize: 10,
        similarityThreshold: 0.3,
        maxResults: 20
      });

      console.log("AI Name Database Checker (Standalone) - Test Results");
      console.log("==================================================");

      // Test database connection
      console.log("\n1. Testing database connection...");
      const isConnected = await searcher.testDatabaseConnection();
      console.log(
        `✅ Database connection: ${isConnected ? "SUCCESS" : "FAILED"}`
      );

      // Test database statistics
      console.log("\n2. Getting database statistics...");
      const dbStats = await searcher.getDatabaseStats();
      console.log(`✅ Database contains ${dbStats.total_records} records`);
      console.log(`✅ Unique first names: ${dbStats.unique_firstnames}`);
      console.log(`✅ Unique last names: ${dbStats.unique_lastnames}`);

      // Test 1: Exact name search
      console.log("\n3. Searching for exact name: Γιάννης Παπαδόπουλος");
      const exactResults = await searcher.searchNames(
        "Γιάννης",
        "Παπαδόπουλος"
      );
      console.log(`Found ${exactResults.results.length} matches`);
      exactResults.results.forEach((result, index) => {
        console.log(
          `${index + 1}. ${result.fullName} (similarity: ${(
            result.similarity * 100
          ).toFixed(1)}%)`
        );
      });

      // Test 2: Latin transliteration search
      console.log(
        "\n4. Searching with Latin transliteration: Giannis Papadopoulos"
      );
      const latinResults = await searcher.searchNames(
        "Giannis",
        "Papadopoulos"
      );
      console.log(`Found ${latinResults.results.length} matches`);
      latinResults.results.forEach((result, index) => {
        console.log(
          `${index + 1}. ${result.fullName} (similarity: ${(
            result.similarity * 100
          ).toFixed(1)}%)`
        );
      });

      // Test 3: Partial name search
      console.log("\n5. Searching for partial name: Μαρ");
      const partialResults = await searcher.searchPartialName("Μαρ");
      console.log(`Found ${partialResults.results.length} matches`);
      partialResults.results.forEach((result, index) => {
        console.log(
          `${index + 1}. ${result.fullName} (similarity: ${(
            result.similarity * 100
          ).toFixed(1)}%)`
        );
      });

      // Test 4: Gender-filtered search
      console.log("\n6. Searching for female names only");
      const genderResults = await searcher.searchNames(" ", " ", {
        gender: "feminine"
      });
      console.log(`Found ${genderResults.results.length} female names`);
      genderResults.results.forEach((result, index) => {
        console.log(
          `${index + 1}. ${result.fullName} (similarity: ${(
            result.similarity * 100
          ).toFixed(1)}%)`
        );
      });

      // Display search statistics
      console.log("\nSearch Statistics:");
      console.log(searcher.getSearchStats());

      // Clean up
      await searcher.dispose();
    } catch (error) {
      console.error("Test failed:", error);
    }
  })();
}
