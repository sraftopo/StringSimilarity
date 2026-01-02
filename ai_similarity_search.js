/**
 * AI-Powered Similarity Search Library
 * Searches for similar strings in a database table column using AI-based embeddings
 * Supports large datasets (20,000+ entries) with batch processing
 */

require("dotenv").config();

class AISimilaritySearch {
  constructor(options = {}) {
    // Lazy-load mssql to avoid loading Azure dependencies until needed
    this._sql = null;
    this.options = {
      batchSize: options.batchSize || 1000,
      maxResults: options.maxResults || 50,
      similarityThreshold: options.similarityThreshold || 0.5, // Lowered default threshold
      ...options
    };

    // Database configuration
    this.dbConfig = {
      server: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT) || 1433,
      database: process.env.DB_NAME || "TIASuite",
      user: process.env.DB_USERNAME || "sa",
      password: process.env.DB_PASSWORD || "E3@eTaesQl@dM1n",
      options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true
      },
      pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
      }
    };

    this.schema = process.env.DB_SCHEMA || "Core";
    this.pool = null;
    this.embeddingsCache = new Map();
    this.isInitialized = false;
  }

  /**
   * Lazy-load mssql module to avoid loading Azure dependencies at startup
   */
  _getMssql() {
    if (!this._sql) {
      try {
        this._sql = require("mssql");
      } catch (error) {
        console.error("❌ Failed to load mssql module:", error.message);
        throw new Error(
          `Failed to load mssql module. This might be a Node.js version compatibility issue. Error: ${error.message}`
        );
      }
    }
    return this._sql;
  }

  /**
   * Initialize database connection
   */
  async initialize() {
    try {
      if (!this.pool) {
        const sql = this._getMssql();
        this.pool = await sql.connect(this.dbConfig);
        this.isInitialized = true;
        console.log("✅ AI Similarity Search: Database connection established");
      }
      return this.pool;
    } catch (error) {
      console.error(
        "❌ AI Similarity Search: Database connection failed:",
        error
      );
      throw error;
    }
  }

  /**
   * Normalize text for processing
   */
  normalizeText(text) {
    if (!text) return "";
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s\u0370-\u03FF]/g, "") // Keep alphanumeric, spaces, and Greek characters
      .replace(/\s+/g, " ");
  }

  /**
   * Create embeddings using custom algorithms
   * Generates a 128-dimensional vector representing the text
   */
  createEmbedding(text) {
    const normalizedText = this.normalizeText(text);
    const embedding = new Array(128).fill(0);

    // Character frequency features (first 64 dimensions)
    for (let i = 0; i < normalizedText.length; i++) {
      const charCode = normalizedText.charCodeAt(i) % 64;
      embedding[charCode] += 1 / Math.max(normalizedText.length, 1);
    }

    // Length and structure features
    embedding[64] = Math.min(normalizedText.length / 100, 1); // Normalized length
    embedding[65] = normalizedText.split(/\s+/).length / 10; // Word count (normalized)
    embedding[66] = normalizedText.length > 0 ? 1 : 0; // Has content

    // Character type features
    embedding[67] =
      (normalizedText.match(/[a-z]/g) || []).length /
      Math.max(normalizedText.length, 1); // Latin lowercase
    embedding[68] =
      (normalizedText.match(/[A-Z]/g) || []).length /
      Math.max(normalizedText.length, 1); // Latin uppercase
    embedding[69] =
      (normalizedText.match(/[\u0370-\u03FF]/g) || []).length /
      Math.max(normalizedText.length, 1); // Greek characters
    embedding[70] =
      (normalizedText.match(/\d/g) || []).length /
      Math.max(normalizedText.length, 1); // Digits

    // Vowel/consonant ratios (for Greek and Latin)
    embedding[71] =
      (normalizedText.match(/[aeiouαεηιουωάέήίόύώ]/gi) || []).length /
      Math.max(normalizedText.length, 1);
    embedding[72] =
      (normalizedText.match(/[bcdfghjklmnpqrstvwxyzβγδζθκλμνξπρστφχψ]/gi) || [])
        .length / Math.max(normalizedText.length, 1);

    // Common substring patterns (simplified)
    const commonPatterns = [
      "tion",
      "ing",
      "ly",
      "er",
      "ed",
      "ος",
      "ης",
      "ας",
      "α",
      "η"
    ];
    commonPatterns.forEach((pattern, idx) => {
      embedding[73 + idx] = normalizedText.includes(pattern.toLowerCase())
        ? 1
        : 0;
    });

    // N-gram features (bigrams)
    if (normalizedText.length >= 2) {
      for (let i = 0; i < Math.min(normalizedText.length - 1, 40); i++) {
        const bigram = normalizedText.substring(i, i + 2);
        const hash = this.hashString(bigram) % 40;
        embedding[83 + hash] += 0.1;
      }
    }

    // Normalize the embedding
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (norm > 0) {
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] /= norm;
      }
    }

    return embedding;
  }

  /**
   * Simple string hash function
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Extract potential keywords from text (capitalized words, brand names, etc.)
   */
  extractKeywords(text) {
    if (!text) return [];

    const normalized = this.normalizeText(text);
    const words = normalized.split(/\s+/).filter((w) => w.length >= 3);

    // Find capitalized words (potential brand names) in original text
    const capitalizedWords = text.match(/[A-Z][a-z]+/g) || [];

    // Also extract ALL words that might be company/brand names
    // This helps catch lowercase company names too
    const allWords = normalized.match(/[a-z]{3,}/g) || [];

    // Combine all keywords, prioritizing capitalized words
    const keywords = [
      ...new Set([
        ...capitalizedWords.map((w) => w.toLowerCase()), // Prioritize capitalized
        ...words.filter((w) => w.length >= 3), // All words from normalized text
        ...allWords // Additional lowercase words
      ])
    ];

    return keywords;
  }

  /**
   * Calculate word-level similarity
   */
  calculateWordSimilarity(searchText, targetText) {
    const searchKeywords = this.extractKeywords(searchText);
    const targetNormalized = this.normalizeText(targetText);
    const targetWords = targetNormalized.split(/\s+/);
    const targetFullText = targetNormalized; // Full normalized target text

    if (searchKeywords.length === 0) {
      return 0;
    }

    // Check for exact word matches
    let exactMatches = 0;
    let partialMatches = 0;
    let fullTextMatches = 0;

    // Special case: if target is a single word (likely a company name)
    // and it matches any keyword exactly, give very high score
    if (targetWords.length === 1) {
      const singleTargetWord = targetWords[0];
      for (const keyword of searchKeywords) {
        if (singleTargetWord === keyword) {
          // Exact match - return very high score
          return 0.95;
        } else if (
          singleTargetWord.includes(keyword) ||
          keyword.includes(singleTargetWord)
        ) {
          // Partial match - still good score
          return 0.85;
        }
      }
    }

    for (const keyword of searchKeywords) {
      let matched = false;

      // Check word-by-word matches
      for (const targetWord of targetWords) {
        if (targetWord === keyword) {
          exactMatches++;
          matched = true;
          break;
        } else if (
          targetWord.includes(keyword) ||
          keyword.includes(targetWord)
        ) {
          partialMatches += 0.5;
          matched = true;
          break;
        }
      }

      // Also check if keyword appears in the full target text (for single-word company names)
      if (!matched && targetFullText.includes(keyword)) {
        // Higher weight if it's a standalone word match
        const wordBoundaryRegex = new RegExp(`\\b${keyword}\\b`, "i");
        if (wordBoundaryRegex.test(targetText)) {
          exactMatches += 1;
        } else {
          fullTextMatches += 0.7;
        }
      }
    }

    // Normalize by the number of keywords, but give bonus for exact matches
    const totalScore = exactMatches + partialMatches + fullTextMatches;

    // If we have exact matches, prioritize them more
    if (exactMatches > 0) {
      // For exact matches, give at least 0.8 score
      return Math.min(
        1,
        Math.max(0.8, exactMatches / Math.max(searchKeywords.length, 1))
      );
    }

    const baseScore = Math.min(
      1,
      totalScore / Math.max(searchKeywords.length, 1)
    );

    return baseScore;
  }

  /**
   * Calculate substring match score
   */
  calculateSubstringScore(searchText, targetText) {
    const normalizedSearch = this.normalizeText(searchText);
    const normalizedTarget = this.normalizeText(targetText);

    // Check if target is contained in search or vice versa
    if (normalizedTarget.includes(normalizedSearch)) {
      return 1.0;
    }
    if (normalizedSearch.includes(normalizedTarget)) {
      // Penalize if search is much longer than target
      const lengthRatio = normalizedTarget.length / normalizedSearch.length;
      return 0.8 * lengthRatio;
    }

    // Check for word-level substring matches (extract keywords and check each)
    const searchKeywords = this.extractKeywords(searchText);
    let bestKeywordMatch = 0;

    for (const keyword of searchKeywords) {
      if (normalizedTarget.includes(keyword)) {
        // Check if it's a word boundary match (full word)
        const wordBoundaryRegex = new RegExp(`\\b${keyword}\\b`, "i");
        if (wordBoundaryRegex.test(targetText)) {
          bestKeywordMatch = Math.max(bestKeywordMatch, 0.9);
        } else {
          // Partial match within a word
          const matchRatio =
            keyword.length / Math.max(normalizedTarget.length, 1);
          bestKeywordMatch = Math.max(bestKeywordMatch, 0.7 * matchRatio);
        }
      }
    }

    // Check for longest common substring
    let maxCommonLength = 0;
    for (let i = 0; i < normalizedSearch.length; i++) {
      for (let j = i + 1; j <= normalizedSearch.length; j++) {
        const substr = normalizedSearch.substring(i, j);
        if (substr.length >= 3 && normalizedTarget.includes(substr)) {
          maxCommonLength = Math.max(maxCommonLength, substr.length);
        }
      }
    }

    let substringScore = 0;
    if (maxCommonLength > 0) {
      const avgLength = (normalizedSearch.length + normalizedTarget.length) / 2;
      substringScore = Math.min(0.7, maxCommonLength / avgLength);
    }

    // Return the best of keyword match or substring match
    return Math.max(bestKeywordMatch, substringScore);
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  calculateCosineSimilarity(embedding1, embedding2) {
    if (embedding1.length !== embedding2.length) {
      throw new Error("Embeddings must have the same length");
    }

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
   * Calculate combined similarity score with multiple methods
   */
  calculateCombinedSimilarity(
    searchText,
    targetText,
    queryEmbedding,
    targetEmbedding
  ) {
    // 1. Cosine similarity from embeddings (semantic similarity)
    const embeddingSimilarity = this.calculateCosineSimilarity(
      queryEmbedding,
      targetEmbedding
    );

    // 2. Word-level similarity (keyword matching)
    const wordSimilarity = this.calculateWordSimilarity(searchText, targetText);

    // 3. Substring matching (exact/partial string matches)
    const substringScore = this.calculateSubstringScore(searchText, targetText);

    // 4. Weighted combination
    // Give higher weight to word and substring matches for better keyword extraction
    // If we have a strong word or substring match, prioritize it heavily
    let combinedScore;

    if (wordSimilarity >= 0.8 || substringScore >= 0.8) {
      // Strong keyword match - prioritize word and substring scores
      combinedScore =
        embeddingSimilarity * 0.2 + wordSimilarity * 0.5 + substringScore * 0.3;
    } else if (wordSimilarity >= 0.5 || substringScore >= 0.5) {
      // Moderate keyword match
      combinedScore =
        embeddingSimilarity * 0.3 +
        wordSimilarity * 0.45 +
        substringScore * 0.25;
    } else {
      // Weak keyword match - use balanced weights
      combinedScore =
        embeddingSimilarity * 0.4 +
        wordSimilarity * 0.35 +
        substringScore * 0.25;
    }

    // Ensure minimum score if there's any word/substring match
    if ((wordSimilarity > 0 || substringScore > 0) && combinedScore < 0.5) {
      combinedScore = Math.max(0.5, combinedScore);
    }

    return {
      combined: Math.min(1, combinedScore),
      embedding: embeddingSimilarity,
      word: wordSimilarity,
      substring: substringScore
    };
  }

  /**
   * Fetch all entries from a specific column in a table
   */
  async fetchColumnData(
    tableName,
    columnName,
    schema = null,
    clauses = null,
    joins = null,
    returnColumns = null
  ) {
    try {
      await this.initialize();

      const tableSchema = schema || this.schema;

      // Sanitize table and column names to prevent SQL injection
      const sanitizedTableName = tableName.replace(/[^\w]/g, "");
      const sanitizedColumnName = columnName.replace(/[^\w]/g, "");
      const sanitizedSchema = tableSchema.replace(/[^\w]/g, "");

      // Use table alias to avoid ambiguous column names when joins are present
      const mainTableAlias = "MainTable";
      const hasJoins = joins && Array.isArray(joins) && joins.length > 0;

      // Build FROM clause with joins - use alias for main table to avoid ambiguity
      let fromClause = hasJoins
        ? `FROM [${sanitizedSchema}].[${sanitizedTableName}] AS [${mainTableAlias}]`
        : `FROM [${sanitizedSchema}].[${sanitizedTableName}]`;

      // Add JOIN clauses if provided
      // NOTE: User is responsible for SQL injection prevention in join conditions
      if (hasJoins) {
        joins.forEach((join) => {
          if (join && typeof join === "object") {
            const joinType = (join.type || "INNER").toUpperCase();
            const joinTable = join.table || "";
            const joinSchema = join.schema || sanitizedSchema;
            const joinCondition = join.condition || "";

            if (joinTable && joinCondition) {
              const sanitizedJoinTable = joinTable.replace(/[^\w]/g, "");
              const sanitizedJoinSchema = joinSchema.replace(/[^\w]/g, "");

              // Replace main table references in join condition with alias
              // Handle both [TableName] and [Schema].[TableName] patterns
              let conditionWithAlias = joinCondition;

              // Replace [Schema].[TableName] pattern first
              conditionWithAlias = conditionWithAlias.replace(
                new RegExp(
                  `\\[${sanitizedSchema}\\]\\.\\[${sanitizedTableName}\\]`,
                  "gi"
                ),
                `[${mainTableAlias}]`
              );

              // Then replace standalone [TableName] pattern (but not if already part of [Schema].[TableName])
              conditionWithAlias = conditionWithAlias.replace(
                new RegExp(`\\[${sanitizedTableName}\\]`, "gi"),
                `[${mainTableAlias}]`
              );

              // Handle NULL-safe joins for INNER JOINs
              // When an INNER JOIN has a condition like [MainTable].[Column] = [OtherTable].[Column]
              // and [MainTable].[Column] is NULL, the row gets excluded because NULL = anything is NULL (not TRUE)
              // To preserve rows with NULL join keys from the main table, we need to modify the condition

              // Check if this is a simple equality condition that might exclude NULLs
              // Pattern: [Table].[Column] = [Table].[Column] (simple equality)
              const simpleEqualityPattern =
                /^(\s*\[.*?\]\.[^\s]+)\s*=\s*(\[.*?\]\.[^\s]+)\s*$/i;
              const equalityMatch = conditionWithAlias
                .trim()
                .match(simpleEqualityPattern);

              // If it's an INNER JOIN with simple equality and the left side references MainTable, make it NULL-safe
              // This allows rows where the main table's join key is NULL to be included (with NULL values for joined table columns)
              if (joinType === "INNER" && equalityMatch) {
                const leftSide = equalityMatch[1].trim();
                const rightSide = equalityMatch[2].trim();

                // Check if left side references the main table (contains MainTable alias)
                const referencesMainTable = new RegExp(
                  `\\[${mainTableAlias}\\]`,
                  "i"
                ).test(leftSide);

                if (referencesMainTable) {
                  // Convert to NULL-safe condition: (left = right) OR (left IS NULL)
                  // This preserves rows where the main table column is NULL
                  // Note: This will match ALL rows from the joined table when left IS NULL
                  // For proper behavior, consider using LEFT JOIN instead when NULLs are expected
                  conditionWithAlias = `(${leftSide} = ${rightSide} OR ${leftSide} IS NULL)`;
                }
              }

              fromClause += ` ${joinType} JOIN [${sanitizedJoinSchema}].[${sanitizedJoinTable}] ON ${conditionWithAlias}`;
            }
          } else if (typeof join === "string" && join.trim().length > 0) {
            // For string format, replace main table name with alias
            let joinString = join.trim();
            joinString = joinString.replace(
              new RegExp(
                `\\[${sanitizedSchema}\\]\\.\\[${sanitizedTableName}\\]`,
                "gi"
              ),
              `[${mainTableAlias}]`
            );
            // Also replace standalone table name references
            joinString = joinString.replace(
              new RegExp(`\\[${sanitizedTableName}\\]`, "gi"),
              `[${mainTableAlias}]`
            );
            fromClause += ` ${joinString}`;
          }
        });
      }

      // Fully qualify column name with table alias/name to avoid ambiguity
      const qualifiedColumnName = hasJoins
        ? `[${mainTableAlias}].[${sanitizedColumnName}]`
        : `[${sanitizedColumnName}]`;

      // Build SELECT clause with additional return columns
      let selectColumns = `${qualifiedColumnName}`;
      const returnColumnsList = [];

      if (
        returnColumns &&
        Array.isArray(returnColumns) &&
        returnColumns.length > 0
      ) {
        returnColumns.forEach((col) => {
          if (typeof col === "string" && col.trim().length > 0) {
            const sanitizedReturnCol = col.trim().replace(/[^\w]/g, "");

            // Check if column already includes table qualification
            if (col.includes(".")) {
              // User provided full qualification like [Table].[Column] or [Schema].[Table].[Column]
              // Use it as-is, but replace main table references with alias if joins present
              let qualifiedCol = col.trim();
              if (hasJoins) {
                qualifiedCol = qualifiedCol.replace(
                  new RegExp(
                    `\\[${sanitizedSchema}\\]\\.\\[${sanitizedTableName}\\]\\.`,
                    "gi"
                  ),
                  `[${mainTableAlias}].`
                );
                qualifiedCol = qualifiedCol.replace(
                  new RegExp(`\\[${sanitizedTableName}\\]\\.`, "gi"),
                  `[${mainTableAlias}].`
                );
              }
              selectColumns += `, ${qualifiedCol}`;
              returnColumnsList.push({
                original: col.trim(),
                qualified: qualifiedCol,
                key: sanitizedReturnCol
              });
            } else {
              // Unqualified column name - assume it's from main table
              const qualifiedReturnCol = hasJoins
                ? `[${mainTableAlias}].[${sanitizedReturnCol}]`
                : `[${sanitizedReturnCol}]`;
              selectColumns += `, ${qualifiedReturnCol}`;
              returnColumnsList.push({
                original: col.trim(),
                qualified: qualifiedReturnCol,
                key: sanitizedReturnCol
              });
            }
          }
        });
      }

      // Build WHERE clause with fully qualified column name
      let whereClause = `
        WHERE ${qualifiedColumnName} IS NOT NULL 
        AND ${qualifiedColumnName} != ''
        AND LEN(LTRIM(RTRIM(${qualifiedColumnName}))) > 0
      `;

      // Add custom clauses if provided
      // NOTE: User is responsible for SQL injection prevention in clauses
      if (clauses && typeof clauses === "string" && clauses.trim().length > 0) {
        let processedClauses = clauses.trim();

        // If joins are present, help with table qualification in clauses
        if (hasJoins) {
          // Replace unqualified references to the main table with the alias
          // Match patterns like "[TableName]." or "[Schema].[TableName]." or just column names
          // This helps when user writes clauses like "CategoryId = 10" for the main table
          // But preserve already-qualified references like "[Categories].[Id] = 10"

          // Replace [Schema].[TableName] with alias
          processedClauses = processedClauses.replace(
            new RegExp(
              `\\[${sanitizedSchema}\\]\\.\\[${sanitizedTableName}\\]\\.`,
              "gi"
            ),
            `[${mainTableAlias}].`
          );

          // Replace [TableName] with alias (when not part of a fully qualified name)
          processedClauses = processedClauses.replace(
            new RegExp(`\\[${sanitizedTableName}\\]\\.`, "gi"),
            `[${mainTableAlias}].`
          );

          // For unqualified column references that might be from main table,
          // we leave them as-is since the user might want to reference joined table columns
          // Users should explicitly qualify: "[MainTable].[ColumnName]" or "[JoinedTable].[ColumnName]"
        }

        whereClause += ` AND ${processedClauses}`;
      }

      const query = `
        SELECT DISTINCT ${selectColumns}, 
               COUNT(*) OVER (PARTITION BY ${qualifiedColumnName}) as occurrence_count
        ${fromClause}
        ${whereClause}
      `;

      // Log the generated query for debugging (only first 500 chars to avoid spam)
      console.log(
        `🔍 Generated SQL Query (first 500 chars):\n${query.substring(0, 500)}${
          query.length > 500 ? "..." : ""
        }`
      );

      const result = await this.pool.request().query(query);

      console.log(
        `📊 Fetched ${result.recordset.length} entries from [${sanitizedSchema}].[${sanitizedTableName}].[${sanitizedColumnName}]`
      );

      return result.recordset.map((row) => {
        const entry = {
          value: String(row[sanitizedColumnName] || "")
            .toLowerCase()
            .trim(), // Force lowercase for matching
          occurrenceCount: row.occurrence_count,
          originalValue: row[sanitizedColumnName], // Keep original value from DB for returning in results
          returnColumns: {} // Store additional return columns
        };

        // Add return columns to entry
        if (returnColumnsList.length > 0) {
          returnColumnsList.forEach((colInfo) => {
            // SQL Server returns column names without brackets, so we need to try multiple formats
            // Try: sanitized key, original name, and column name extracted from qualified format
            let columnValue = null;
            const possibleKeys = [
              colInfo.key, // Sanitized name (e.g., "Id")
              colInfo.original.replace(/\[|\]/g, ""), // Remove brackets from original
              colInfo.qualified.replace(/\[|\]/g, "").split(".").pop() // Last part after dots
            ];

            // Remove duplicates
            const uniqueKeys = [...new Set(possibleKeys)];

            // Try each possible key format
            for (const key of uniqueKeys) {
              if (row[key] !== undefined) {
                columnValue = row[key];
                break;
              }
            }

            // Store with the sanitized key for consistent access
            entry.returnColumns[colInfo.key] = columnValue;
          });
        }

        return entry;
      });
    } catch (error) {
      console.error(
        `❌ Error fetching column data from ${tableName}.${columnName}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Process entries in batches and calculate similarities
   */
  async processBatch(entries, queryEmbedding, searchString, options = {}) {
    const results = [];
    const batchSize = options.batchSize || this.options.batchSize;

    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);

      try {
        // Generate embeddings for the batch
        // Use lowercase normalized values for embedding generation to ensure consistency
        const batchEmbeddings = batch.map((entry) => {
          const normalizedValue = String(entry.value || "")
            .toLowerCase()
            .trim();
          const cacheKey = normalizedValue;

          // Check cache first
          if (this.embeddingsCache.has(cacheKey)) {
            return this.embeddingsCache.get(cacheKey);
          }

          const embedding = this.createEmbedding(normalizedValue);
          this.embeddingsCache.set(cacheKey, embedding);
          return embedding;
        });

        // Calculate similarities using combined method
        // Ensure all values are lowercase for consistent matching
        const normalizedSearchString = String(searchString || "")
          .toLowerCase()
          .trim();

        for (let j = 0; j < batch.length; j++) {
          // batch[j].value is already lowercase from fetchColumnData
          const targetValue = String(batch[j].value || "")
            .toLowerCase()
            .trim();

          const similarityScores = this.calculateCombinedSimilarity(
            normalizedSearchString,
            targetValue,
            queryEmbedding,
            batchEmbeddings[j]
          );

          const similarity = similarityScores.combined;

          // Log detailed scores for debugging (first few entries)
          if (j < 3) {
            console.log(
              `   Testing: "${targetValue}" vs "${normalizedSearchString}"`
            );
            console.log(
              `     Similarity: ${similarity.toFixed(
                4
              )} (word: ${similarityScores.word.toFixed(
                4
              )}, substring: ${similarityScores.substring.toFixed(
                4
              )}, embedding: ${similarityScores.embedding.toFixed(4)})`
            );
          }

          const threshold =
            options.minSimilarity || this.options.similarityThreshold;

          if (similarity >= threshold) {
            const resultItem = {
              value: batch[j].originalValue || batch[j].value, // Return original value from DB
              similarity: similarity,
              detailedScores: {
                embedding:
                  Math.round(similarityScores.embedding * 10000) / 10000,
                word: Math.round(similarityScores.word * 10000) / 10000,
                substring:
                  Math.round(similarityScores.substring * 10000) / 10000
              },
              occurrenceCount: batch[j].occurrenceCount || 1,
              returnColumns: batch[j].returnColumns || {} // Include return columns
            };

            // Include uniqueId if provided in options (pass-through, not from DB)
            if (options.uniqueId !== null && options.uniqueId !== undefined) {
              resultItem.uniqueId = options.uniqueId;
            }

            // Include eq_number if provided in options (pass-through, not from DB)
            if (options.eq_number !== null && options.eq_number !== undefined) {
              resultItem.eq_number = options.eq_number;
            }

            results.push(resultItem);
          }
        }

        // Periodic cache cleanup if it gets too large
        if (this.embeddingsCache.size > 10000) {
          // Keep only the most recent 5000 entries
          const entriesToKeep = Array.from(
            this.embeddingsCache.entries()
          ).slice(-5000);
          this.embeddingsCache.clear();
          entriesToKeep.forEach(([key, value]) => {
            this.embeddingsCache.set(key, value);
          });
        }

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      } catch (error) {
        console.error(
          `Error processing batch ${i}-${i + batch.length}:`,
          error
        );
        continue;
      }
    }

    return results;
  }

  /**
   * Main search function
   * @param {string} searchString - The string to search for
   * @param {string} tableName - The name of the table to search in
   * @param {string} columnName - The name of the column to search in
   * @param {Object} options - Search options
   * @param {string} options.schema - Optional schema name (defaults to configured schema)
   * @param {string} options.clauses - Optional WHERE clause conditions (e.g., "ApplicationCategoryId = 10")
   * @param {Array} options.joins - Optional array of JOIN definitions
   * @param {Object} options.joins[].type - Join type: "INNER", "LEFT", "RIGHT", "FULL" (default: "INNER")
   * @param {string} options.joins[].table - Table name to join
   * @param {string} options.joins[].schema - Schema name for join table (defaults to main schema)
   * @param {string} options.joins[].condition - JOIN condition (e.g., "Table1.Id = Table2.Id")
   * @param {Array<string>} options.returnColumns - Optional array of additional column names to return in results (e.g., ["Id", "CategoryId", "[Practice].[Name]"])
   * @param {string|number} options.uniqueId - Optional unique ID to pass through in results (not from DB)
   * @param {string|number} options.eq_number - Optional equipment number to pass through in results (not from DB)
   * @param {number} options.minSimilarity - Minimum similarity threshold (0-1)
   * @param {number} options.maxResults - Maximum number of results to return
   * @param {number} options.batchSize - Batch size for processing
   * @returns {Promise<Object>} Search results
   */
  async search(searchString, tableName, columnName, options = {}) {
    if (!searchString || typeof searchString !== "string") {
      throw new Error("searchString must be a non-empty string");
    }

    if (!tableName || typeof tableName !== "string") {
      throw new Error("tableName must be a non-empty string");
    }

    if (!columnName || typeof columnName !== "string") {
      throw new Error("columnName must be a non-empty string");
    }

    const startTime = Date.now();

    try {
      console.log(`🔍 Starting AI similarity search:`);
      console.log(`   Search string: "${searchString}"`);
      console.log(`   Table: ${tableName}`);
      console.log(`   Column: ${columnName}`);
      console.log(`   Schema: ${options.schema || this.schema}`);

      // Generate embedding for the search string (force lowercase for consistent matching)
      const normalizedSearchString = String(searchString || "")
        .toLowerCase()
        .trim();
      const queryEmbedding = this.createEmbedding(normalizedSearchString);

      // Fetch all entries from the specified column
      const entries = await this.fetchColumnData(
        tableName,
        columnName,
        options.schema,
        options.clauses,
        options.joins,
        options.returnColumns
      );

      if (entries.length === 0) {
        console.log("⚠️ No entries found in the specified column");
        return {
          searchString: searchString,
          tableName: tableName,
          columnName: columnName,
          query: {
            original: searchString,
            normalized: this.normalizeText(searchString)
          },
          results: [],
          totalEntries: 0,
          resultsReturned: 0,
          searchTime: Date.now() - startTime
        };
      }

      console.log(`📊 Processing ${entries.length} entries...`);

      // Extract keywords for logging (use normalized lowercase string)
      const keywords = this.extractKeywords(normalizedSearchString);
      if (keywords.length > 0) {
        console.log(`   Extracted keywords: ${keywords.join(", ")}`);
      }

      // Process entries in batches (pass normalized lowercase search string)
      const results = await this.processBatch(
        entries,
        queryEmbedding,
        normalizedSearchString,
        options
      );

      // Sort by similarity score (highest first)
      results.sort((a, b) => b.similarity - a.similarity);

      // Apply additional filters
      let filteredResults = results;

      if (options.minSimilarity) {
        filteredResults = filteredResults.filter(
          (record) => record.similarity >= options.minSimilarity
        );
      }

      // Limit results
      const maxResults = options.maxResults || this.options.maxResults;
      const finalResults = filteredResults.slice(0, maxResults);

      const searchTime = Date.now() - startTime;
      console.log(
        `✅ Search completed: Found ${finalResults.length} matches in ${searchTime}ms`
      );

      // Build response object
      const response = {
        searchString: searchString,
        tableName: tableName,
        columnName: columnName,
        query: {
          original: searchString,
          normalized: this.normalizeText(searchString)
        },
        results: finalResults.map((result) => {
          // Check if the value exists as a complete word in the search string
          const normalizedValue = String(result.value || "")
            .toLowerCase()
            .trim();
          const normalizedSearch = normalizedSearchString;

          // Use word boundary regex to check if value exists as a complete word
          const wordBoundaryRegex = new RegExp(
            `\\b${normalizedValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
            "i"
          );
          const wordExists = wordBoundaryRegex.test(searchString) ? 1 : 0;

          // Calculate total_similarity: 50% similarity + 50% word_exist
          const totalSimilarity = 0.5 * result.similarity + 0.5 * wordExists;

          const resultObj = {
            value: result.value,
            similarity: Math.round(result.similarity * 10000) / 10000, // Round to 4 decimal places
            word_exist: wordExists,
            total_similarity: Math.round(totalSimilarity * 10000) / 10000, // Round to 4 decimal places
            detailedScores: result.detailedScores || undefined, // Include detailed breakdown if available
            occurrenceCount: result.occurrenceCount
          };

          // Include return columns if they exist
          if (
            result.returnColumns &&
            Object.keys(result.returnColumns).length > 0
          ) {
            Object.assign(resultObj, result.returnColumns);
          }

          return resultObj;
        }),
        totalEntries: entries.length,
        resultsReturned: finalResults.length,
        searchTime: searchTime
      };

      // Include uniqueId and eq_number at top level if provided in options (pass-through, not from DB)
      if (options.uniqueId !== null && options.uniqueId !== undefined) {
        response.uniqueId = options.uniqueId;
      }

      if (options.eq_number !== null && options.eq_number !== undefined) {
        response.eq_number = options.eq_number;
      }

      return response;
    } catch (error) {
      console.error("❌ Error in AI similarity search:", error);
      throw error;
    }
  }

  /**
   * Get search statistics
   */
  getStats() {
    return {
      isInitialized: this.isInitialized,
      batchSize: this.options.batchSize,
      similarityThreshold: this.options.similarityThreshold,
      embeddingsCacheSize: this.embeddingsCache.size,
      memoryUsage: process.memoryUsage()
    };
  }

  /**
   * Clear embeddings cache
   */
  clearCache() {
    this.embeddingsCache.clear();
    if (global.gc) {
      global.gc();
    }
    console.log("✅ Embeddings cache cleared");
  }

  /**
   * Close database connection
   */
  async close() {
    try {
      if (this.pool) {
        await this.pool.close();
        this.pool = null;
        this.isInitialized = false;
        console.log("✅ Database connection closed");
      }
    } catch (error) {
      console.error("❌ Error closing database connection:", error);
      throw error;
    }
  }

  /**
   * Test database connection
   */
  async testConnection() {
    try {
      await this.initialize();
      const result = await this.pool.request().query("SELECT 1 as test");
      return true;
    } catch (error) {
      console.error("❌ Database connection test failed:", error);
      return false;
    }
  }
}

module.exports = AISimilaritySearch;
