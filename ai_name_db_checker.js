/**
 * AI-Powered Greek Name Database Semantic Search Library
 * Uses TensorFlow.js for intelligent semantic search across large Greek name databases
 * Supports batching for memory-efficient processing of 50k+ records
 */

const tf = require("@tensorflow/tfjs-node");
const { GreekNameCorrector } = require("./greeknames_rules.js");

class AINameDBSearcher {
  constructor(options = {}) {
    this.options = {
      batchSize: options.batchSize || 1000,
      maxResults: options.maxResults || 50,
      similarityThreshold: options.similarityThreshold || 0.7,
      useGPU: options.useGPU || false,
      modelPath:
        options.modelPath ||
        "https://tfhub.dev/google/universal-sentence-encoder-multilingual/1",
      ...options
    };

    this.model = null;
    this.nameCorrector = new GreekNameCorrector();
    this.embeddingsCache = new Map();
    this.isInitialized = false;

    // Initialize TensorFlow backend
    this.initializeTensorFlow();
  }

  /**
   * Initialize TensorFlow with appropriate backend
   */
  async initializeTensorFlow() {
    try {
      if (this.options.useGPU) {
        await tf.setBackend("tensorflow");
        console.log("Using GPU backend for TensorFlow.js");
      } else {
        await tf.setBackend("cpu");
        console.log("Using CPU backend for TensorFlow.js");
      }

      console.log("TensorFlow.js initialized successfully");
    } catch (error) {
      console.error("Failed to initialize TensorFlow.js:", error);
      throw error;
    }
  }

  /**
   * Load the sentence transformer model
   */
  async loadModel() {
    if (this.isInitialized) {
      return this.model;
    }

    try {
      console.log("Loading sentence transformer model...");

      // For Greek text, we'll use a multilingual model
      // In production, you might want to use a specialized Greek model
      this.model = await tf.loadLayersModel(this.options.modelPath);

      this.isInitialized = true;
      console.log("Model loaded successfully");
      return this.model;
    } catch (error) {
      console.error("Failed to load model:", error);

      // Fallback to a simpler embedding approach
      console.log("Using fallback embedding method...");
      this.model = this.createFallbackEmbeddingModel();
      this.isInitialized = true;
      return this.model;
    }
  }

  /**
   * Create a fallback embedding model using simple text features
   */
  createFallbackEmbeddingModel() {
    return {
      predict: async (texts) => {
        // Simple character-level and phonetic embeddings
        const embeddings = texts.map((text) =>
          this.createSimpleEmbedding(text)
        );
        return tf.tensor2d(embeddings);
      }
    };
  }

  /**
   * Create simple embeddings for fallback
   */
  createSimpleEmbedding(text) {
    const normalizedText = this.normalizeGreekText(text);
    const embedding = new Array(128).fill(0);

    // Character frequency features
    for (let i = 0; i < normalizedText.length; i++) {
      const charCode = normalizedText.charCodeAt(i) % 128;
      embedding[charCode]++;
    }

    // Length and structure features
    embedding[0] = normalizedText.length / 50; // Normalized length
    embedding[1] = this.countVowels(normalizedText) / normalizedText.length;
    embedding[2] = this.countConsonants(normalizedText) / normalizedText.length;

    // Greek-specific features
    embedding[3] = this.hasGreekEnding(normalizedText) ? 1 : 0;
    embedding[4] = this.detectGenderFromEnding(normalizedText);

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
   * Generate embeddings for a batch of texts
   */
  async generateEmbeddings(texts) {
    if (!this.isInitialized) {
      await this.loadModel();
    }

    try {
      const embeddings = await this.model.predict(texts);
      return embeddings;
    } catch (error) {
      console.error("Error generating embeddings:", error);
      throw error;
    }
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  calculateCosineSimilarity(embedding1, embedding2) {
    const dotProduct = tf.dot(embedding1, embedding2);
    const norm1 = tf.norm(embedding1);
    const norm2 = tf.norm(embedding2);
    const similarity = tf.div(dotProduct, tf.mul(norm1, norm2));

    return similarity.dataSync()[0];
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
        const batchTexts = batch.map((record) =>
          `${record.Firstname || ""} ${record.Lastname || ""}`.trim()
        );

        const batchEmbeddings = await this.generateEmbeddings(batchTexts);

        // Calculate similarities
        for (let j = 0; j < batch.length; j++) {
          const similarity = this.calculateCosineSimilarity(
            queryEmbedding,
            batchEmbeddings.slice([j, 0])
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

        // Clean up tensors to prevent memory leaks
        batchEmbeddings.dispose();

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
   * Main search function - accepts Firstname and Lastname
   * @param {string} firstName - First name to search for
   * @param {string} lastName - Last name to search for
   * @param {Array} databaseRecords - Array of database records with Firstname and Lastname columns
   * @param {Object} options - Search options
   * @returns {Promise<Array>} - Array of matching records with similarity scores
   */
  async searchNames(firstName, lastName, databaseRecords, options = {}) {
    if (!firstName && !lastName) {
      throw new Error("At least one name (first or last) must be provided");
    }

    if (!Array.isArray(databaseRecords) || databaseRecords.length === 0) {
      throw new Error(
        "Database records array is required and must not be empty"
      );
    }

    try {
      console.log(
        `Starting semantic search for: ${firstName || ""} ${lastName || ""}`
      );
      console.log(`Processing ${databaseRecords.length} database records...`);

      // Normalize and correct the input names
      const correctedFirstName = firstName
        ? this.nameCorrector.correctName(firstName.trim()).corrected
        : "";
      const correctedLastName = lastName
        ? this.nameCorrector.correctName(lastName.trim()).corrected
        : "";

      const queryText = `${correctedFirstName} ${correctedLastName}`.trim();
      console.log(`Corrected query: ${queryText}`);

      // Generate embedding for the query
      const queryEmbedding = await this.generateEmbeddings([queryText]);
      const queryVector = queryEmbedding.slice([0, 0]);

      // Process database records in batches
      const results = await this.processBatch(databaseRecords, queryVector);

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

      // Clean up query embedding
      queryEmbedding.dispose();
      queryVector.dispose();

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
   * @param {Array} databaseRecords - Array of database records
   * @param {Object} options - Search options
   */
  async searchPartialName(partialName, databaseRecords, options = {}) {
    if (!partialName || partialName.trim().length < 2) {
      throw new Error("Partial name must be at least 2 characters long");
    }

    // Split partial name into possible first/last name parts
    const nameParts = partialName.trim().split(/\s+/);
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    return await this.searchNames(firstName, lastName, databaseRecords, {
      ...options,
      similarityThreshold: options.similarityThreshold || 0.5 // Lower threshold for partial matches
    });
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
   * Dispose of the model and free resources
   */
  dispose() {
    if (this.model && this.model.dispose) {
      this.model.dispose();
    }
    this.clearCache();
    this.isInitialized = false;
    console.log("AINameDBSearcher disposed");
  }
}

// Export the class
module.exports = AINameDBSearcher;

// Example usage and testing
if (require.main === module) {
  (async () => {
    try {
      // Initialize the searcher
      const searcher = new AINameDBSearcher({
        batchSize: 500,
        similarityThreshold: 0.7,
        maxResults: 20
      });

      // Sample database records (in real usage, these would come from your SQL database)
      const sampleRecords = [
        { Firstname: "Γιάννης", Lastname: "Παπαδόπουλος" },
        { Firstname: "Μαρία", Lastname: "Κωνσταντίνου" },
        { Firstname: "Νίκος", Lastname: "Αντωνίου" },
        { Firstname: "Ελένη", Lastname: "Δημητρίου" },
        { Firstname: "Κώστας", Lastname: "Γεωργίου" },
        { Firstname: "Σοφία", Lastname: "Μιχαήλ" },
        { Firstname: "Δημήτρης", Lastname: "Αλεξάνδρου" },
        { Firstname: "Αναστασία", Lastname: "Βασιλείου" },
        { Firstname: "Γεώργιος", Lastname: "Νικολάου" },
        { Firstname: "Κατερίνα", Lastname: "Παύλου" }
      ];

      console.log("AI Name Database Checker - Test Results");
      console.log("=====================================");

      // Test 1: Exact name search
      console.log("\n1. Searching for exact name: Γιάννης Παπαδόπουλος");
      const exactResults = await searcher.searchNames(
        "Γιάννης",
        "Παπαδόπουλος",
        sampleRecords
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
        "\n2. Searching with Latin transliteration: Giannis Papadopoulos"
      );
      const latinResults = await searcher.searchNames(
        "Giannis",
        "Papadopoulos",
        sampleRecords
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
      console.log("\n3. Searching for partial name: Μαρ");
      const partialResults = await searcher.searchPartialName(
        "Μαρ",
        sampleRecords
      );
      console.log(`Found ${partialResults.results.length} matches`);
      partialResults.results.forEach((result, index) => {
        console.log(
          `${index + 1}. ${result.fullName} (similarity: ${(
            result.similarity * 100
          ).toFixed(1)}%)`
        );
      });

      // Test 4: Gender-filtered search
      console.log("\n4. Searching for female names only: Μαρία");
      const genderResults = await searcher.searchNames(
        "Μαρία",
        "",
        sampleRecords,
        { gender: "feminine" }
      );
      console.log(`Found ${genderResults.results.length} matches`);
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
      searcher.dispose();
    } catch (error) {
      console.error("Test failed:", error);
    }
  })();
}
