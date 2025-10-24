const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const natural = require("natural");
const stringSimilarity = require("string-similarity");
const { distance } = require("ml-distance");
const { Matrix } = require("ml-matrix");
const GreekNameCorrector = require("./greeknames_rules.js");
const AINameDBSearcherMSSQL = require("./ai_name_db_checker_standalone.js");

const app = express();
const PORT = 3031;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(
    `[${timestamp}] ${req.method} ${req.path} - IP: ${
      req.ip || req.connection.remoteAddress
    }`
  );

  if (req.method === "POST" && req.path === "/compare") {
    console.log(`📝 Request Body Summary:`, {
      inputObject: req.body.inputObject ? "Object provided" : "undefined",
      inputElement: req.body.inputElement || "undefined",
      inputString:
        req.body.inputObject &&
        req.body.inputElement &&
        req.body.inputObject[req.body.inputElement]
          ? `${req.body.inputObject[req.body.inputElement].substring(0, 50)}${
              req.body.inputObject[req.body.inputElement].length > 50
                ? "..."
                : ""
            }`
          : "undefined",
      arrayOfObjects: req.body.arrayOfObjects
        ? `${req.body.arrayOfObjects.length} objects`
        : "undefined",
      elementToCheck: req.body.elementToCheck || "undefined"
    });

    // Debug logging for object parsing
    console.log(`🔍 Debug - Raw inputObject:`, req.body.inputObject);
    console.log(`🔍 Debug - inputObject type:`, typeof req.body.inputObject);
    console.log(
      `🔍 Debug - inputObject constructor:`,
      req.body.inputObject?.constructor?.name
    );
    console.log(
      `🔍 Debug - inputObject keys:`,
      req.body.inputObject ? Object.keys(req.body.inputObject) : "N/A"
    );
    console.log(`🔍 Debug - Full request body keys:`, Object.keys(req.body));
    console.log(`🔍 Debug - Content-Type:`, req.get("Content-Type"));
  }

  next();
});

// Initialize TF-IDF for better text similarity
const tfidf = new natural.TfIdf();

// Text preprocessing function
function preprocessText(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "") // Remove punctuation
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}

// Calculate cosine similarity between two vectors
function cosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) {
    throw new Error("Vectors must have the same length");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

// Create TF-IDF vectors for text similarity
function createTfIdfVector(text, corpus) {
  const tfidf = new natural.TfIdf();

  // Add all documents to TF-IDF
  corpus.forEach((doc) => tfidf.addDocument(doc));

  // Get TF-IDF vector for the input text
  const vector = new Array(corpus.length).fill(0);
  tfidf.tfidfs(text, (i, measure) => {
    vector[i] = measure;
  });

  return vector;
}

// Calculate multiple similarity scores
function calculateSimilarityScores(inputText, targetText) {
  const scores = {};

  // 1. String similarity (Dice coefficient)
  scores.stringSimilarity = stringSimilarity.compareTwoStrings(
    inputText,
    targetText
  );

  // 2. Jaro-Winkler distance
  scores.jaroWinkler = natural.JaroWinklerDistance(inputText, targetText);

  // 3. Levenshtein distance (normalized)
  const levenshtein = natural.LevenshteinDistance(inputText, targetText);
  const maxLength = Math.max(inputText.length, targetText.length);
  scores.levenshtein = maxLength === 0 ? 1 : 1 - levenshtein / maxLength;

  // 4. Jaccard similarity
  const inputWords = new Set(inputText.toLowerCase().split(/\s+/));
  const targetWords = new Set(targetText.toLowerCase().split(/\s+/));
  const intersection = new Set(
    [...inputWords].filter((x) => targetWords.has(x))
  );
  const union = new Set([...inputWords, ...targetWords]);
  scores.jaccard = union.size === 0 ? 0 : intersection.size / union.size;

  // 5. TF-IDF cosine similarity
  const corpus = [inputText, targetText];
  const inputVector = createTfIdfVector(inputText, corpus);
  const targetVector = createTfIdfVector(targetText, corpus);
  scores.tfidfCosine = cosineSimilarity(inputVector, targetVector);

  return scores;
}

// Calculate weighted similarity score
function calculateWeightedScore(scores) {
  const weights = {
    stringSimilarity: 0.3,
    jaroWinkler: 0.2,
    levenshtein: 0.2,
    jaccard: 0.15,
    tfidfCosine: 0.15
  };

  let weightedScore = 0;
  for (const [metric, weight] of Object.entries(weights)) {
    weightedScore += scores[metric] * weight;
  }

  return Math.min(1, Math.max(0, weightedScore));
}

// Main similarity comparison function
function compareStrings(inputString, arrayOfObjects, elementToCheck) {
  const results = [];

  arrayOfObjects.forEach((obj, index) => {
    const targetString = obj[elementToCheck];
    if (!targetString || typeof targetString !== "string") {
      return;
    }

    const scores = calculateSimilarityScores(inputString, targetString);
    const weightedScore = calculateWeightedScore(scores);

    results.push({
      index: index,
      originalObject: obj,
      targetString: targetString,
      score: weightedScore,
      detailedScores: scores
    });
  });

  // Sort by score (descending)
  results.sort((a, b) => b.score - a.score);

  return results;
}

// POST endpoint for string similarity comparison
app.post("/compare", (req, res) => {
  try {
    const { inputObject, inputElement, arrayOfObjects, elementToCheck } =
      req.body;

    // Validation with detailed logging
    console.log("🔍 Validation Debug:");
    console.log("  - inputObject exists:", !!inputObject);
    console.log("  - inputObject type:", typeof inputObject);
    console.log("  - inputObject value:", inputObject);
    console.log("  - inputObject is null:", inputObject === null);
    console.log("  - inputObject is array:", Array.isArray(inputObject));

    let parsedInputObject = inputObject;

    // Try to parse inputObject if it's a string
    if (typeof inputObject === "string") {
      console.log("🔄 Attempting to parse inputObject string as JSON...");
      try {
        parsedInputObject = JSON.parse(inputObject);
        console.log("✅ Successfully parsed inputObject string to object");
        console.log("  - Parsed type:", typeof parsedInputObject);
        console.log("  - Parsed keys:", Object.keys(parsedInputObject));
      } catch (parseError) {
        console.log(
          "❌ Failed to parse inputObject string as JSON:",
          parseError.message
        );
        console.log(
          "❌ Raw string value:",
          inputObject.substring(0, 100) +
            (inputObject.length > 100 ? "..." : "")
        );
        return res.status(400).json({
          error: "inputObject string could not be parsed as valid JSON",
          debug: {
            received: inputObject,
            type: typeof inputObject,
            parseError: parseError.message
          }
        });
      }
    }

    if (
      !parsedInputObject ||
      typeof parsedInputObject !== "object" ||
      Array.isArray(parsedInputObject)
    ) {
      console.log(
        "❌ Validation Error: inputObject is required and must be an object"
      );
      console.log("❌ Debug - inputObject details:", {
        exists: !!parsedInputObject,
        type: typeof parsedInputObject,
        isArray: Array.isArray(parsedInputObject),
        isNull: parsedInputObject === null,
        value: parsedInputObject
      });
      return res.status(400).json({
        error: "inputObject is required and must be an object",
        debug: {
          received: parsedInputObject,
          type: typeof parsedInputObject,
          isArray: Array.isArray(parsedInputObject)
        }
      });
    }

    // Update inputObject to use the parsed version
    const finalInputObject = parsedInputObject;

    if (!inputElement || typeof inputElement !== "string") {
      console.log(
        "❌ Validation Error: inputElement is required and must be a string"
      );
      return res.status(400).json({
        error: "inputElement is required and must be a string"
      });
    }

    // Helper function to get nested property using dot notation
    function getNestedProperty(obj, path) {
      return path.split(".").reduce((current, key) => {
        return current && current[key] !== undefined ? current[key] : undefined;
      }, obj);
    }

    // Check if inputElement exists (supports dot notation)
    const inputString = getNestedProperty(finalInputObject, inputElement);

    if (inputString === undefined) {
      console.log(
        "❌ Validation Error: inputObject does not have the specified inputElement path"
      );
      console.log("❌ Debug - Searched path:", inputElement);
      console.log("❌ Debug - Available keys:", Object.keys(finalInputObject));
      return res.status(400).json({
        error: "inputObject does not have the specified inputElement path",
        debug: {
          searchedPath: inputElement,
          availableKeys: Object.keys(finalInputObject)
        }
      });
    }
    if (!inputString || typeof inputString !== "string") {
      console.log("❌ Validation Error: inputElement value must be a string");
      return res.status(400).json({
        error: "inputElement value must be a string"
      });
    }

    if (!Array.isArray(arrayOfObjects)) {
      console.log(
        "❌ Validation Error: arrayOfObjects is required and must be an array"
      );
      return res.status(400).json({
        error: "arrayOfObjects is required and must be an array"
      });
    }

    if (!elementToCheck || typeof elementToCheck !== "string") {
      console.log(
        "❌ Validation Error: elementToCheck is required and must be a string"
      );
      return res.status(400).json({
        error: "elementToCheck is required and must be a string"
      });
    }

    // Filter out objects that don't have the specified element
    const validObjects = arrayOfObjects.filter(
      (obj) =>
        obj && typeof obj === "object" && obj.hasOwnProperty(elementToCheck)
    );

    if (validObjects.length === 0) {
      console.log(
        "❌ Validation Error: No valid objects found with the specified elementToCheck"
      );
      return res.status(400).json({
        error: "No valid objects found with the specified elementToCheck"
      });
    }

    // Perform similarity comparison
    const comparisonResults = compareStrings(
      inputString,
      validObjects,
      elementToCheck
    );

    // Filter results with score > 0 (optional threshold)
    const filteredResults = comparisonResults.filter(
      (result) => result.score > 0
    );

    // Format response
    const response = {
      inputObject: finalInputObject,
      inputString: inputString,
      totalCompared: validObjects.length,
      resultsReturned: filteredResults.length,
      results: filteredResults.map((result) => ({
        index: result.index,
        score: Math.round(result.score * 10000) / 10000, // Round to 4 decimal places
        targetString: result.targetString,
        originalObject: result.originalObject
      })),
      topMatch:
        filteredResults.length > 0
          ? {
              index: filteredResults[0].index,
              score: Math.round(filteredResults[0].score * 10000) / 10000,
              targetString: filteredResults[0].targetString,
              originalObject: filteredResults[0].originalObject
            }
          : null
    };

    // Log response summary
    console.log(
      `✅ Response: ${response.resultsReturned}/${response.totalCompared} matches found`
    );
    if (response.topMatch) {
      console.log(
        `🎯 Top match: Score ${
          response.topMatch.score
        } - "${response.topMatch.targetString.substring(0, 50)}${
          response.topMatch.targetString.length > 50 ? "..." : ""
        }"`
      );
    }

    res.json(response);
  } catch (error) {
    console.error("❌ Error in comparison:", error.message);
    console.error("Stack trace:", error.stack);
    res.status(500).json({
      error: "Internal server error",
      message: error.message
    });
  }
});

// POST endpoint for finding AFKAS numbers in filenames
app.post("/findAfaks", (req, res) => {
  try {
    const { filename, ignoreStrings } = req.body;

    // Validation
    if (!filename || typeof filename !== "string") {
      console.log(
        "❌ Validation Error: filename is required and must be a string"
      );
      return res.status(400).json({
        error: "filename is required and must be a string"
      });
    }

    // Validate ignoreStrings if provided
    if (ignoreStrings !== undefined) {
      if (!Array.isArray(ignoreStrings)) {
        console.log("❌ Validation Error: ignoreStrings must be an array");
        return res.status(400).json({
          error: "ignoreStrings must be an array of strings"
        });
      }

      // Check if all elements in ignoreStrings are strings
      const invalidElements = ignoreStrings.filter(
        (item) => typeof item !== "string"
      );
      if (invalidElements.length > 0) {
        console.log(
          "❌ Validation Error: All elements in ignoreStrings must be strings"
        );
        return res.status(400).json({
          error: "All elements in ignoreStrings must be strings"
        });
      }
    }

    // Regex pattern to match 4-5 digit numbers
    // This pattern matches:
    // - 4 digits: \d{4}
    // - 5 digits: \d{5}
    // - Not preceded or followed by digits to ensure we get complete numbers
    const afkasPattern = /(?:^|[^0-9])(\d{4,5})(?![0-9])/g;

    // Find all matches
    const matches = [...filename.matchAll(afkasPattern)];
    const matchValues = matches.map((match) => match[1]);

    // Convert to numbers and remove duplicates
    let afkasNumbers =
      matchValues.length > 0
        ? [...new Set(matchValues.map((match) => parseInt(match, 10)))]
        : [];

    // Auto-detect and ignore year pattern at start of filename
    // Check patterns in order of specificity (most specific first)

    // Pattern 1: _year_year_ at start (multiple years) - most specific
    const yearPattern1 = /^_(\d{4})_(\d{4})_/;
    const yearMatch1 = filename.match(yearPattern1);

    // Pattern 2: number_year_ at start
    const yearPattern2 = /^(\d+)_(\d{4})_/;
    const yearMatch2 = filename.match(yearPattern2);

    // Pattern 3: _year_ at start - least specific
    const yearPattern3 = /^_(\d{4})_/;
    const yearMatch3 = filename.match(yearPattern3);

    let autoIgnoreNumbers = [];

    if (yearMatch1) {
      const firstYear = parseInt(yearMatch1[1], 10);
      const secondYear = parseInt(yearMatch1[2], 10);
      autoIgnoreNumbers.push(firstYear);
      autoIgnoreNumbers.push(secondYear);
      console.log(`🗓️ Auto-detected first year (pattern 1): ${firstYear}`);
      console.log(`🗓️ Auto-detected second year (pattern 1): ${secondYear}`);
    } else if (yearMatch2) {
      const beforeYearNumber = parseInt(yearMatch2[1], 10);
      const year = yearMatch2[2];
      autoIgnoreNumbers.push(parseInt(beforeYearNumber, 10));
      autoIgnoreNumbers.push(parseInt(year, 10));
      console.log(`🔢 Auto-detected number before year: ${beforeYearNumber}`);
      console.log(`🗓️ Auto-detected year (pattern 2): ${year}`);
    } else if (yearMatch3) {
      const year = yearMatch3[1];
      autoIgnoreNumbers.push(parseInt(year, 10));
      console.log(`🗓️ Auto-detected year (pattern 3): ${year}`);
    }

    // Combine user-provided ignoreStrings with auto-detected ones
    const allIgnoreNumbers = [...autoIgnoreNumbers];
    if (ignoreStrings && ignoreStrings.length > 0) {
      console.log(
        `🔍 User-provided ignoreStrings: [${ignoreStrings.join(", ")}]`
      );
      allIgnoreNumbers.push(
        ...ignoreStrings
          .map((str) => parseInt(str, 10))
          .filter((num) => !isNaN(num))
      );
    }

    // Filter out numbers that should be ignored
    if (allIgnoreNumbers.length > 0) {
      console.log(
        `🔍 Filtering with all ignore numbers: [${allIgnoreNumbers.join(", ")}]`
      );

      afkasNumbers = afkasNumbers.filter((number) => {
        const shouldIgnore = allIgnoreNumbers.includes(number);

        if (shouldIgnore) {
          console.log(`🚫 Filtering out ${number} (in ignore list)`);
        }

        return !shouldIgnore;
      });
    }

    // Sort numbers for consistent output
    afkasNumbers.sort((a, b) => a - b);

    const response = {
      filename: filename,
      afkasNumbers: afkasNumbers,
      count: afkasNumbers.length,
      found: afkasNumbers.length > 0,
      ignoreStrings: ignoreStrings || [],
      autoIgnoredNumbers: autoIgnoreNumbers,
      allIgnoredNumbers: allIgnoreNumbers
    };

    console.log(
      `🔍 AFKAS Search: "${filename}" -> [${afkasNumbers.join(", ")}]`
    );

    res.json(response);
  } catch (error) {
    console.error("❌ Error in findAfaks:", error.message);
    console.error("Stack trace:", error.stack);
    res.status(500).json({
      error: "Internal server error",
      message: error.message
    });
  }
});

// Initialize Greek Name Corrector
const greekNameCorrector = new GreekNameCorrector();

// Initialize AI Name Database Searcher (Standalone)
let aiNameSearcherMSSQL = null;

// Initialize AI searcher with standalone configuration
async function initializeAISearcherMSSQL() {
  try {
    aiNameSearcherMSSQL = new AINameDBSearcherMSSQL({
      batchSize: 1000,
      similarityThreshold: 0.7,
      maxResults: 50
    });
    console.log(
      "🤖 AI Name Database Searcher (Standalone) initialized successfully"
    );
  } catch (error) {
    console.error("❌ Failed to initialize AI Name Database Searcher:", error);
  }
}

// Initialize the AI searcher on startup
initializeAISearcherMSSQL();

// POST endpoint for Greek name correction
app.post("/correctGreekName", (req, res) => {
  try {
    const { name, options = {} } = req.body;

    // Validation
    if (!name || typeof name !== "string") {
      return res.status(400).json({
        success: false,
        error: "Invalid name provided. Name must be a non-empty string.",
        received: { name, type: typeof name }
      });
    }

    console.log(`🇬🇷 Greek Name Correction Request:`, {
      name: name,
      options: options,
      timestamp: new Date().toISOString()
    });

    // Correct the name using the Greek Name Corrector
    const result = greekNameCorrector.correctName(name, options);

    // Log the result for debugging
    console.log(`✅ Greek Name Correction Result:`, {
      original: result.original,
      corrected: result.corrected,
      gender: result.gender,
      confidence: result.confidence
    });

    // Return the result
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("❌ Greek Name Correction Error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error during Greek name correction",
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// POST endpoint for AI-powered Greek name database search
app.post("/aiNameSearch", async (req, res) => {
  try {
    const { firstName, lastName, databaseRecords, options = {} } = req.body;

    // Validation
    if (!firstName && !lastName) {
      console.log(
        "❌ Validation Error: At least one name (first or last) must be provided"
      );
      return res.status(400).json({
        success: false,
        error: "At least one name (first or last) must be provided",
        received: { firstName, lastName }
      });
    }

    if (!Array.isArray(databaseRecords) || databaseRecords.length === 0) {
      console.log(
        "❌ Validation Error: databaseRecords is required and must not be empty"
      );
      return res.status(400).json({
        success: false,
        error: "databaseRecords is required and must not be empty",
        received: {
          databaseRecords: Array.isArray(databaseRecords)
            ? databaseRecords.length
            : "not an array"
        }
      });
    }

    // Check if AI searcher is initialized
    if (!aiNameSearcher) {
      console.log("❌ AI searcher not initialized");
      return res.status(500).json({
        success: false,
        error:
          "AI Name Database Searcher is not initialized. Please try again in a moment."
      });
    }

    console.log(`🤖 AI Name Search Request:`, {
      firstName: firstName || "not provided",
      lastName: lastName || "not provided",
      databaseRecordsCount: databaseRecords.length,
      options: options,
      timestamp: new Date().toISOString()
    });

    // Perform AI-powered semantic search
    const searchResults = await aiNameSearcher.searchNames(
      firstName || "",
      lastName || "",
      databaseRecords,
      options
    );

    // Log the result for debugging
    console.log(`✅ AI Name Search Result:`, {
      query: searchResults.query,
      resultsFound: searchResults.results.length,
      totalProcessed: searchResults.totalProcessed,
      topMatch:
        searchResults.results.length > 0
          ? {
              name: searchResults.results[0].fullName,
              similarity: searchResults.results[0].similarity
            }
          : null
    });

    // Return the result
    res.json({
      success: true,
      data: searchResults,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("❌ AI Name Search Error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error during AI name search",
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// POST endpoint for AI-powered partial name search
app.post("/aiPartialNameSearch", async (req, res) => {
  try {
    const { partialName, databaseRecords, options = {} } = req.body;

    // Validation
    if (
      !partialName ||
      typeof partialName !== "string" ||
      partialName.trim().length < 2
    ) {
      console.log(
        "❌ Validation Error: partialName must be at least 2 characters long"
      );
      return res.status(400).json({
        success: false,
        error: "partialName must be at least 2 characters long",
        received: { partialName, type: typeof partialName }
      });
    }

    if (!Array.isArray(databaseRecords) || databaseRecords.length === 0) {
      console.log(
        "❌ Validation Error: databaseRecords is required and must not be empty"
      );
      return res.status(400).json({
        success: false,
        error: "databaseRecords is required and must not be empty",
        received: {
          databaseRecords: Array.isArray(databaseRecords)
            ? databaseRecords.length
            : "not an array"
        }
      });
    }

    // Check if AI searcher is initialized
    if (!aiNameSearcher) {
      console.log("❌ AI searcher not initialized");
      return res.status(500).json({
        success: false,
        error:
          "AI Name Database Searcher is not initialized. Please try again in a moment."
      });
    }

    console.log(`🔍 AI Partial Name Search Request:`, {
      partialName: partialName,
      databaseRecordsCount: databaseRecords.length,
      options: options,
      timestamp: new Date().toISOString()
    });

    // Perform AI-powered partial name search
    const searchResults = await aiNameSearcher.searchPartialName(
      partialName,
      databaseRecords,
      options
    );

    // Log the result for debugging
    console.log(`✅ AI Partial Name Search Result:`, {
      query: searchResults.query,
      resultsFound: searchResults.results.length,
      totalProcessed: searchResults.totalProcessed,
      topMatch:
        searchResults.results.length > 0
          ? {
              name: searchResults.results[0].fullName,
              similarity: searchResults.results[0].similarity
            }
          : null
    });

    // Return the result
    res.json({
      success: true,
      data: searchResults,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("❌ AI Partial Name Search Error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error during AI partial name search",
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// GET endpoint for AI searcher statistics
app.get("/aiSearchStats", (req, res) => {
  try {
    if (!aiNameSearcher) {
      return res.status(500).json({
        success: false,
        error: "AI Name Database Searcher is not initialized"
      });
    }

    const stats = aiNameSearcher.getSearchStats();

    res.json({
      success: true,
      data: {
        isInitialized: stats.isInitialized,
        batchSize: stats.batchSize,
        similarityThreshold: stats.similarityThreshold,
        embeddingsCacheSize: stats.embeddingsCacheSize,
        memoryUsage: {
          heapUsed: Math.round(stats.memoryUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(stats.memoryUsage.heapTotal / 1024 / 1024),
          external: Math.round(stats.memoryUsage.external / 1024 / 1024),
          rss: Math.round(stats.memoryUsage.rss / 1024 / 1024)
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("❌ AI Search Stats Error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error getting AI search statistics",
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// POST endpoint to clear AI searcher cache
app.post("/aiSearchClearCache", (req, res) => {
  try {
    if (!aiNameSearcher) {
      return res.status(500).json({
        success: false,
        error: "AI Name Database Searcher is not initialized"
      });
    }

    aiNameSearcher.clearCache();

    res.json({
      success: true,
      message: "AI searcher cache cleared successfully",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("❌ AI Search Clear Cache Error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error clearing AI search cache",
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// POST endpoint for AI-powered Greek name database search with MSSQL
app.post("/aiNameSearchMSSQL", async (req, res) => {
  try {
    const { firstName, lastName, options = {} } = req.body;

    // Validation
    if (!firstName && !lastName) {
      console.log(
        "❌ Validation Error: At least one name (first or last) must be provided"
      );
      return res.status(400).json({
        success: false,
        error: "At least one name (first or last) must be provided",
        received: { firstName, lastName }
      });
    }

    // Check if AI searcher is initialized
    if (!aiNameSearcherMSSQL) {
      console.log("❌ AI searcher not initialized");
      return res.status(500).json({
        success: false,
        error:
          "AI Name Database Searcher with MSSQL is not initialized. Please try again in a moment."
      });
    }

    console.log(`🤖 AI Name Search Request (MSSQL):`, {
      firstName: firstName || "not provided",
      lastName: lastName || "not provided",
      options: options,
      timestamp: new Date().toISOString()
    });

    // Perform AI-powered semantic search in MSSQL database
    const searchResults = await aiNameSearcherMSSQL.searchNames(
      firstName || "",
      lastName || "",
      options
    );

    // Log the result for debugging
    console.log(`✅ AI Name Search Result (MSSQL):`, {
      query: searchResults.query,
      resultsFound: searchResults.results.length,
      totalProcessed: searchResults.totalProcessed,
      topMatch:
        searchResults.results.length > 0
          ? {
              name: searchResults.results[0].fullName,
              similarity: searchResults.results[0].similarity
            }
          : null
    });

    // Return the result
    res.json({
      success: true,
      data: searchResults,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("❌ AI Name Search Error (MSSQL):", error);
    res.status(500).json({
      success: false,
      error: "Internal server error during AI name search in MSSQL database",
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// POST endpoint for AI-powered partial name search with MSSQL
app.post("/aiPartialNameSearchMSSQL", async (req, res) => {
  try {
    const { partialName, options = {} } = req.body;

    // Validation
    if (
      !partialName ||
      typeof partialName !== "string" ||
      partialName.trim().length < 2
    ) {
      console.log(
        "❌ Validation Error: partialName must be at least 2 characters long"
      );
      return res.status(400).json({
        success: false,
        error: "partialName must be at least 2 characters long",
        received: { partialName, type: typeof partialName }
      });
    }

    // Check if AI searcher is initialized
    if (!aiNameSearcherMSSQL) {
      console.log("❌ AI searcher not initialized");
      return res.status(500).json({
        success: false,
        error:
          "AI Name Database Searcher with MSSQL is not initialized. Please try again in a moment."
      });
    }

    console.log(`🔍 AI Partial Name Search Request (MSSQL):`, {
      partialName: partialName,
      options: options,
      timestamp: new Date().toISOString()
    });

    // Perform AI-powered partial name search in MSSQL database
    const searchResults = await aiNameSearcherMSSQL.searchPartialName(
      partialName,
      options
    );

    // Log the result for debugging
    console.log(`✅ AI Partial Name Search Result (MSSQL):`, {
      query: searchResults.query,
      resultsFound: searchResults.results.length,
      totalProcessed: searchResults.totalProcessed,
      topMatch:
        searchResults.results.length > 0
          ? {
              name: searchResults.results[0].fullName,
              similarity: searchResults.results[0].similarity
            }
          : null
    });

    // Return the result
    res.json({
      success: true,
      data: searchResults,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("❌ AI Partial Name Search Error (MSSQL):", error);
    res.status(500).json({
      success: false,
      error:
        "Internal server error during AI partial name search in MSSQL database",
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// GET endpoint for MSSQL database statistics
app.get("/aiSearchStatsMSSQL", async (req, res) => {
  try {
    if (!aiNameSearcherMSSQL) {
      return res.status(500).json({
        success: false,
        error: "AI Name Database Searcher with MSSQL is not initialized"
      });
    }

    const stats = aiNameSearcherMSSQL.getSearchStats();
    const dbStats = await aiNameSearcherMSSQL.getDatabaseStats();

    res.json({
      success: true,
      data: {
        isInitialized: stats.isInitialized,
        batchSize: stats.batchSize,
        similarityThreshold: stats.similarityThreshold,
        embeddingsCacheSize: stats.embeddingsCacheSize,
        memoryUsage: {
          heapUsed: Math.round(stats.memoryUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(stats.memoryUsage.heapTotal / 1024 / 1024),
          external: Math.round(stats.memoryUsage.external / 1024 / 1024),
          rss: Math.round(stats.memoryUsage.rss / 1024 / 1024)
        },
        databaseStats: dbStats
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("❌ AI Search Stats Error (MSSQL):", error);
    res.status(500).json({
      success: false,
      error: "Internal server error getting AI search statistics for MSSQL",
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// POST endpoint to test MSSQL database connection
app.post("/aiSearchTestConnectionMSSQL", async (req, res) => {
  try {
    if (!aiNameSearcherMSSQL) {
      return res.status(500).json({
        success: false,
        error: "AI Name Database Searcher with MSSQL is not initialized"
      });
    }

    const isConnected = await aiNameSearcherMSSQL.testDatabaseConnection();

    res.json({
      success: true,
      data: {
        connected: isConnected,
        message: isConnected
          ? "Database connection successful"
          : "Database connection failed"
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("❌ AI Search Test Connection Error (MSSQL):", error);
    res.status(500).json({
      success: false,
      error: "Internal server error testing MSSQL database connection",
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    message: "String Similarity Server is running",
    port: PORT
  });
});

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "String Similarity Server",
    version: "1.0.0",
    endpoints: {
      "POST /compare": "Compare string similarity",
      "POST /findAfaks": "Extract 4-5 digit AFKAS numbers from filenames",
      "POST /correctGreekName":
        "Correct and process Greek names with declension",
      "POST /aiNameSearch": "AI-powered semantic search for Greek names",
      "POST /aiPartialNameSearch": "AI-powered partial name search",
      "GET /aiSearchStats": "Get AI searcher statistics and memory usage",
      "POST /aiSearchClearCache": "Clear AI searcher cache",
      "POST /aiNameSearchMSSQL": "AI-powered semantic search in MSSQL database",
      "POST /aiPartialNameSearchMSSQL":
        "AI-powered partial name search in MSSQL database",
      "GET /aiSearchStatsMSSQL":
        "Get AI searcher statistics for MSSQL database",
      "POST /aiSearchTestConnectionMSSQL": "Test MSSQL database connection",
      "GET /health": "Health check"
    },
    usage: {
      compare: {
        method: "POST",
        url: "/compare",
        body: {
          inputObject: "object containing the data to compare",
          inputElement: "property name in inputObject to use for comparison",
          arrayOfObjects: "array of objects to search in",
          elementToCheck: "property name to compare against"
        }
      },
      findAfaks: {
        method: "POST",
        url: "/findAfaks",
        body: {
          filename: "filename string to extract AFKAS numbers from",
          ignoreStrings:
            "optional array of strings to ignore when found in filename"
        }
      },
      correctGreekName: {
        method: "POST",
        url: "/correctGreekName",
        body: {
          name: "Greek name to correct (string)",
          options: "optional object with correction options",
          options_targetCase:
            "target case: 'nominative', 'genitive', 'accusative', 'vocative'",
          options_fixCommonErrors: "boolean to enable error correction"
        }
      },
      aiNameSearch: {
        method: "POST",
        url: "/aiNameSearch",
        body: {
          firstName: "First name to search for (string, optional)",
          lastName: "Last name to search for (string, optional)",
          databaseRecords:
            "Array of database records with Firstname and Lastname properties",
          options: "optional object with search options",
          options_gender: "filter by gender: 'masculine', 'feminine'",
          options_minSimilarity: "minimum similarity threshold (0-1)",
          options_maxResults: "maximum number of results to return"
        }
      },
      aiPartialNameSearch: {
        method: "POST",
        url: "/aiPartialNameSearch",
        body: {
          partialName: "Partial name to search for (string, min 2 characters)",
          databaseRecords:
            "Array of database records with Firstname and Lastname properties",
          options: "optional object with search options"
        }
      },
      aiSearchStats: {
        method: "GET",
        url: "/aiSearchStats",
        description: "Get AI searcher statistics and memory usage"
      },
      aiSearchClearCache: {
        method: "POST",
        url: "/aiSearchClearCache",
        description: "Clear AI searcher cache to free memory"
      },
      aiNameSearchMSSQL: {
        method: "POST",
        url: "/aiNameSearchMSSQL",
        body: {
          firstName: "First name to search for (string, optional)",
          lastName: "Last name to search for (string, optional)",
          options: "optional object with search options",
          options_gender: "filter by gender: 'masculine', 'feminine'",
          options_minSimilarity: "minimum similarity threshold (0-1)",
          options_maxResults: "maximum number of results to return",
          options_limit: "limit number of database records to process"
        }
      },
      aiPartialNameSearchMSSQL: {
        method: "POST",
        url: "/aiPartialNameSearchMSSQL",
        body: {
          partialName: "Partial name to search for (string, min 2 characters)",
          options: "optional object with search options"
        }
      },
      aiSearchStatsMSSQL: {
        method: "GET",
        url: "/aiSearchStatsMSSQL",
        description:
          "Get AI searcher statistics and database information for MSSQL"
      },
      aiSearchTestConnectionMSSQL: {
        method: "POST",
        url: "/aiSearchTestConnectionMSSQL",
        description: "Test MSSQL database connection"
      }
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 String Similarity Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔍 Compare endpoint: POST http://localhost:${PORT}/compare`);
  console.log(
    `🔢 Find AFKAS endpoint: POST http://localhost:${PORT}/findAfaks`
  );
  console.log(
    `🇬🇷 Greek Name Correction endpoint: POST http://localhost:${PORT}/correctGreekName`
  );
  console.log(
    `🤖 AI Name Search endpoint: POST http://localhost:${PORT}/aiNameSearch`
  );
  console.log(
    `🔍 AI Partial Name Search endpoint: POST http://localhost:${PORT}/aiPartialNameSearch`
  );
  console.log(
    `📊 AI Search Stats endpoint: GET http://localhost:${PORT}/aiSearchStats`
  );
  console.log(
    `🧹 AI Search Clear Cache endpoint: POST http://localhost:${PORT}/aiSearchClearCache`
  );
  console.log(
    `🗄️ AI Name Search MSSQL endpoint: POST http://localhost:${PORT}/aiNameSearchMSSQL`
  );
  console.log(
    `🔍 AI Partial Name Search MSSQL endpoint: POST http://localhost:${PORT}/aiPartialNameSearchMSSQL`
  );
  console.log(
    `📊 AI Search Stats MSSQL endpoint: GET http://localhost:${PORT}/aiSearchStatsMSSQL`
  );
  console.log(
    `🔗 AI Search Test Connection MSSQL endpoint: POST http://localhost:${PORT}/aiSearchTestConnectionMSSQL`
  );
});

module.exports = app;
