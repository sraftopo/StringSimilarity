// Load environment variables from .env file
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const natural = require("natural");
const stringSimilarity = require("string-similarity");
const { distance } = require("ml-distance");
const { Matrix } = require("ml-matrix");
const axios = require("axios");
const { exec } = require("child_process");
const { promisify } = require("util");
const path = require("path");
const fs = require("fs");
const GreekNameCorrector = require("./greeknames_rules.js");
const AINameDBSearcherMSSQL = require("./ai_name_db_checker_standalone.js");
const AISimilaritySearch = require("./ai_similarity_search.js");

const execAsync = promisify(exec);

const app = express();
const PORT = 3031;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path} - IP: ${req.ip || req.connection.remoteAddress}`);

  if (req.method === "POST" && req.path === "/compare") {
    console.log(`📝 Request Body Summary:`, {
      inputObject: req.body.inputObject ? "Object provided" : "undefined",
      inputElement: req.body.inputElement || "undefined",
      inputString:
        req.body.inputObject && req.body.inputElement && req.body.inputObject[req.body.inputElement]
          ? `${req.body.inputObject[req.body.inputElement].substring(0, 50)}${
              req.body.inputObject[req.body.inputElement].length > 50 ? "..." : ""
            }`
          : "undefined",
      arrayOfObjects: req.body.arrayOfObjects ? `${req.body.arrayOfObjects.length} objects` : "undefined",
      elementToCheck: req.body.elementToCheck || "undefined"
    });

    // Debug logging for object parsing
    console.log(`🔍 Debug - Raw inputObject:`, req.body.inputObject);
    console.log(`🔍 Debug - inputObject type:`, typeof req.body.inputObject);
    console.log(`🔍 Debug - inputObject constructor:`, req.body.inputObject?.constructor?.name);
    console.log(`🔍 Debug - inputObject keys:`, req.body.inputObject ? Object.keys(req.body.inputObject) : "N/A");
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
  scores.stringSimilarity = stringSimilarity.compareTwoStrings(inputText, targetText);

  // 2. Jaro-Winkler distance
  scores.jaroWinkler = natural.JaroWinklerDistance(inputText, targetText);

  // 3. Levenshtein distance (normalized)
  const levenshtein = natural.LevenshteinDistance(inputText, targetText);
  const maxLength = Math.max(inputText.length, targetText.length);
  scores.levenshtein = maxLength === 0 ? 1 : 1 - levenshtein / maxLength;

  // 4. Jaccard similarity
  const inputWords = new Set(inputText.toLowerCase().split(/\s+/));
  const targetWords = new Set(targetText.toLowerCase().split(/\s+/));
  const intersection = new Set([...inputWords].filter((x) => targetWords.has(x)));
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
    const { inputObject, inputElement, arrayOfObjects, elementToCheck } = req.body;

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
        console.log("❌ Failed to parse inputObject string as JSON:", parseError.message);
        console.log("❌ Raw string value:", inputObject.substring(0, 100) + (inputObject.length > 100 ? "..." : ""));
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

    if (!parsedInputObject || typeof parsedInputObject !== "object" || Array.isArray(parsedInputObject)) {
      console.log("❌ Validation Error: inputObject is required and must be an object");
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
      console.log("❌ Validation Error: inputElement is required and must be a string");
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
      console.log("❌ Validation Error: inputObject does not have the specified inputElement path");
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
      console.log("❌ Validation Error: arrayOfObjects is required and must be an array");
      return res.status(400).json({
        error: "arrayOfObjects is required and must be an array"
      });
    }

    if (!elementToCheck || typeof elementToCheck !== "string") {
      console.log("❌ Validation Error: elementToCheck is required and must be a string");
      return res.status(400).json({
        error: "elementToCheck is required and must be a string"
      });
    }

    // Filter out objects that don't have the specified element
    const validObjects = arrayOfObjects.filter(
      (obj) => obj && typeof obj === "object" && obj.hasOwnProperty(elementToCheck)
    );

    if (validObjects.length === 0) {
      console.log("❌ Validation Error: No valid objects found with the specified elementToCheck");
      return res.status(400).json({
        error: "No valid objects found with the specified elementToCheck"
      });
    }

    // Perform similarity comparison
    const comparisonResults = compareStrings(inputString, validObjects, elementToCheck);

    // Filter results with score > 0 (optional threshold)
    const filteredResults = comparisonResults.filter((result) => result.score > 0);

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
    console.log(`✅ Response: ${response.resultsReturned}/${response.totalCompared} matches found`);
    if (response.topMatch) {
      console.log(
        `🎯 Top match: Score ${response.topMatch.score} - "${response.topMatch.targetString.substring(0, 50)}${
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
      console.log("❌ Validation Error: filename is required and must be a string");
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
      const invalidElements = ignoreStrings.filter((item) => typeof item !== "string");
      if (invalidElements.length > 0) {
        console.log("❌ Validation Error: All elements in ignoreStrings must be strings");
        return res.status(400).json({
          error: "All elements in ignoreStrings must be strings"
        });
      }
    }

    let autoIgnoreNumbers = [];
    let afkasNumbers = [];

    // Step 1: Detect year patterns and extract AFKs that appear after them
    // Pattern 1: number_year_AFKs... (e.g., "11668_2025_40450", "9304_2025_40140_40142")
    const pattern1 = /^(\d+)_(\d{4})_(.+)/;
    const match1 = filename.match(pattern1);

    // Pattern 2: _year_AFKs... (e.g., "_2025_40450", "_2025_40140-40142")
    const pattern2 = /^_(\d{4})_(.+)/;
    const match2 = filename.match(pattern2);

    if (match1) {
      const beforeYearNumber = parseInt(match1[1], 10);
      const year = parseInt(match1[2], 10);
      const afterYearPart = match1[3];

      autoIgnoreNumbers.push(beforeYearNumber);
      autoIgnoreNumbers.push(year);
      console.log(`🔢 Auto-detected number before year: ${beforeYearNumber}`);
      console.log(`🗓️ Auto-detected year (pattern 1): ${year}`);

      // Extract AFKs from the part after the year
      // AFKs can be separated by underscores or hyphens
      // Match sequences like: 40450, 40140_40142, 40140-40142, 40220-40221-40222
      // Extract all 4-5 digit numbers that appear immediately after the year
      // Use pattern that works with underscores and hyphens (not word boundaries)
      const afkasPattern = /(?:^|[^0-9])(\d{4,5})(?![0-9])/g;
      const afkasMatches = [...afterYearPart.matchAll(afkasPattern)];

      if (afkasMatches && afkasMatches.length > 0) {
        afkasNumbers = [...new Set(afkasMatches.map((match) => parseInt(match[1], 10)))];
        console.log(`🔍 Extracted AFKs from pattern 1: [${afkasNumbers.join(", ")}]`);
      }
    } else if (match2) {
      const year = parseInt(match2[1], 10);
      const afterYearPart = match2[2];

      autoIgnoreNumbers.push(year);
      console.log(`🗓️ Auto-detected year (pattern 2): ${year}`);

      // Extract AFKs from the part after the year
      // Use pattern that works with underscores and hyphens (not word boundaries)
      const afkasPattern = /(?:^|[^0-9])(\d{4,5})(?![0-9])/g;
      const afkasMatches = [...afterYearPart.matchAll(afkasPattern)];

      if (afkasMatches && afkasMatches.length > 0) {
        afkasNumbers = [...new Set(afkasMatches.map((match) => parseInt(match[1], 10)))];
        console.log(`🔍 Extracted AFKs from pattern 2: [${afkasNumbers.join(", ")}]`);
      }
    } else {
      // No year pattern found - check if there are any AFKs at all
      // Only extract if they appear in sequences (separated by underscores/hyphens)
      // This handles cases where there might be AFKs without a year pattern
      // But we're more conservative here - if no year pattern, likely no AFKs
      // (This handles edge cases, but most examples have year patterns)

      // Look for sequences of 4-5 digit numbers separated by underscores or hyphens
      // But exclude standalone numbers at the start (like "10713_" which is not an AFK)
      const standaloneAfkasPattern = /(?:_|^)(\d{4,5})(?:[-_](\d{4,5}))+/;
      const standaloneMatch = filename.match(standaloneAfkasPattern);

      if (standaloneMatch) {
        // Extract all numbers from the sequence
        const sequencePart = standaloneMatch[0];
        const numbersPattern = /(?:^|[^0-9])(\d{4,5})(?![0-9])/g;
        const numbersMatches = [...sequencePart.matchAll(numbersPattern)];
        if (numbersMatches && numbersMatches.length > 0) {
          afkasNumbers = [...new Set(numbersMatches.map((match) => parseInt(match[1], 10)))];
          // Filter out years
          afkasNumbers = afkasNumbers.filter((num) => num < 2000 || num > 2099);
          if (afkasNumbers.length > 0) {
            console.log(`🔍 Extracted AFKs from standalone pattern: [${afkasNumbers.join(", ")}]`);
          }
        }
      }
    }

    // Step 2: Combine user-provided ignoreStrings with auto-detected ones
    const allIgnoreNumbers = [...autoIgnoreNumbers];
    if (ignoreStrings && ignoreStrings.length > 0) {
      console.log(`🔍 User-provided ignoreStrings: [${ignoreStrings.join(", ")}]`);
      allIgnoreNumbers.push(...ignoreStrings.map((str) => parseInt(str, 10)).filter((num) => !isNaN(num)));
    }

    // Step 3: Filter out numbers that should be ignored
    if (allIgnoreNumbers.length > 0) {
      console.log(`🔍 Filtering with all ignore numbers: [${allIgnoreNumbers.join(", ")}]`);

      afkasNumbers = afkasNumbers.filter((number) => {
        const shouldIgnore = allIgnoreNumbers.includes(number);

        if (shouldIgnore) {
          console.log(`🚫 Filtering out ${number} (in ignore list)`);
        }

        return !shouldIgnore;
      });
    }

    // Step 4: Final validation - ensure we only return valid AFKs
    // AFKs should be 4-5 digit numbers, exclude years
    afkasNumbers = afkasNumbers.filter((num) => {
      // Must be 4-5 digits
      if (num < 1000 || num > 99999) {
        return false;
      }
      // Exclude years (2000-2099)
      if (num >= 2000 && num <= 2099) {
        return false;
      }
      return true;
    });

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

    console.log(`🔍 AFKAS Search: "${filename}" -> [${afkasNumbers.join(", ")}]`);

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
    console.log("🤖 AI Name Database Searcher (Standalone) initialized successfully");
  } catch (error) {
    console.error("❌ Failed to initialize AI Name Database Searcher:", error);
  }
}

// Initialize the AI searcher on startup
initializeAISearcherMSSQL();

// Initialize AI Similarity Search
let aiSimilaritySearch = null;

async function initializeAISimilaritySearch() {
  try {
    aiSimilaritySearch = new AISimilaritySearch({
      batchSize: 1000,
      similarityThreshold: 0.7,
      maxResults: 50
    });
    // Initialize database connection (will be lazy-loaded when first used)
    // Don't initialize connection at startup to avoid loading Azure dependencies
    console.log("🤖 AI Similarity Search instance created (connection will be established on first use)");
  } catch (error) {
    console.error("❌ Failed to create AI Similarity Search instance:", error);
    console.error("   The server will continue, but /aiSimilaritySearch endpoints may not work");
  }
}

// Initialize on startup (non-blocking)
initializeAISimilaritySearch();

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
      console.log("❌ Validation Error: At least one name (first or last) must be provided");
      return res.status(400).json({
        success: false,
        error: "At least one name (first or last) must be provided",
        received: { firstName, lastName }
      });
    }

    if (!Array.isArray(databaseRecords) || databaseRecords.length === 0) {
      console.log("❌ Validation Error: databaseRecords is required and must not be empty");
      return res.status(400).json({
        success: false,
        error: "databaseRecords is required and must not be empty",
        received: {
          databaseRecords: Array.isArray(databaseRecords) ? databaseRecords.length : "not an array"
        }
      });
    }

    // Check if AI searcher is initialized
    if (!aiNameSearcher) {
      console.log("❌ AI searcher not initialized");
      return res.status(500).json({
        success: false,
        error: "AI Name Database Searcher is not initialized. Please try again in a moment."
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
    const searchResults = await aiNameSearcher.searchNames(firstName || "", lastName || "", databaseRecords, options);

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
    if (!partialName || typeof partialName !== "string" || partialName.trim().length < 2) {
      console.log("❌ Validation Error: partialName must be at least 2 characters long");
      return res.status(400).json({
        success: false,
        error: "partialName must be at least 2 characters long",
        received: { partialName, type: typeof partialName }
      });
    }

    if (!Array.isArray(databaseRecords) || databaseRecords.length === 0) {
      console.log("❌ Validation Error: databaseRecords is required and must not be empty");
      return res.status(400).json({
        success: false,
        error: "databaseRecords is required and must not be empty",
        received: {
          databaseRecords: Array.isArray(databaseRecords) ? databaseRecords.length : "not an array"
        }
      });
    }

    // Check if AI searcher is initialized
    if (!aiNameSearcher) {
      console.log("❌ AI searcher not initialized");
      return res.status(500).json({
        success: false,
        error: "AI Name Database Searcher is not initialized. Please try again in a moment."
      });
    }

    console.log(`🔍 AI Partial Name Search Request:`, {
      partialName: partialName,
      databaseRecordsCount: databaseRecords.length,
      options: options,
      timestamp: new Date().toISOString()
    });

    // Perform AI-powered partial name search
    const searchResults = await aiNameSearcher.searchPartialName(partialName, databaseRecords, options);

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
      console.log("❌ Validation Error: At least one name (first or last) must be provided");
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
        error: "AI Name Database Searcher with MSSQL is not initialized. Please try again in a moment."
      });
    }

    console.log(`🤖 AI Name Search Request (MSSQL):`, {
      firstName: firstName || "not provided",
      lastName: lastName || "not provided",
      options: options,
      timestamp: new Date().toISOString()
    });

    // Perform AI-powered semantic search in MSSQL database
    const searchResults = await aiNameSearcherMSSQL.searchNames(firstName || "", lastName || "", options);

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
    if (!partialName || typeof partialName !== "string" || partialName.trim().length < 2) {
      console.log("❌ Validation Error: partialName must be at least 2 characters long");
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
        error: "AI Name Database Searcher with MSSQL is not initialized. Please try again in a moment."
      });
    }

    console.log(`🔍 AI Partial Name Search Request (MSSQL):`, {
      partialName: partialName,
      options: options,
      timestamp: new Date().toISOString()
    });

    // Perform AI-powered partial name search in MSSQL database
    const searchResults = await aiNameSearcherMSSQL.searchPartialName(partialName, options);

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
      error: "Internal server error during AI partial name search in MSSQL database",
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
        message: isConnected ? "Database connection successful" : "Database connection failed"
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

// POST endpoint to calculate similarity between two strings
app.post("/calculateStringSimilarity", async (req, res) => {
  try {
    const { string1, string2, uniqueId, eq_number } = req.body;

    // Validation
    if (!string1 || typeof string1 !== "string") {
      console.log("❌ Validation Error: string1 is required and must be a string");
      return res.status(400).json({
        success: false,
        error: "string1 is required and must be a non-empty string",
        received: { string1, type: typeof string1 }
      });
    }

    if (!string2 || typeof string2 !== "string") {
      console.log("❌ Validation Error: string2 is required and must be a string");
      return res.status(400).json({
        success: false,
        error: "string2 is required and must be a non-empty string",
        received: { string2, type: typeof string2 }
      });
    }

    // Check if AI similarity search is initialized (we need it for the similarity methods)
    if (!aiSimilaritySearch) {
      console.log("❌ AI Similarity Search not initialized");
      return res.status(500).json({
        success: false,
        error: "AI Similarity Search is not initialized. Please try again in a moment."
      });
    }

    console.log(`🔍 String Similarity Calculation Request:`, {
      string1: string1.substring(0, 100),
      string2: string2.substring(0, 100),
      uniqueId: uniqueId || "not provided",
      eq_number: eq_number || "not provided",
      timestamp: new Date().toISOString()
    });

    try {
      // Normalize strings to lowercase for consistent matching
      const normalizedString1 = String(string1 || "")
        .toLowerCase()
        .trim();
      const normalizedString2 = String(string2 || "")
        .toLowerCase()
        .trim();

      // Generate embeddings for both strings
      const embedding1 = aiSimilaritySearch.createEmbedding(normalizedString1);
      const embedding2 = aiSimilaritySearch.createEmbedding(normalizedString2);

      // Calculate combined similarity using the same method as the search
      const similarityScores = aiSimilaritySearch.calculateCombinedSimilarity(
        normalizedString1,
        normalizedString2,
        embedding1,
        embedding2
      );

      // Build result object
      const result = {
        string1: string1,
        string2: string2,
        normalized: {
          string1: normalizedString1,
          string2: normalizedString2
        },
        similarity: Math.round(similarityScores.combined * 10000) / 10000,
        detailedScores: {
          embedding: Math.round(similarityScores.embedding * 10000) / 10000,
          word: Math.round(similarityScores.word * 10000) / 10000,
          substring: Math.round(similarityScores.substring * 10000) / 10000
        }
      };

      // Include uniqueId if provided
      if (uniqueId !== null && uniqueId !== undefined) {
        result.uniqueId = uniqueId;
      }

      // Include eq_number if provided
      if (eq_number !== null && eq_number !== undefined) {
        result.eq_number = eq_number;
      }

      console.log(`✅ String Similarity Calculation Result:`, {
        similarity: result.similarity,
        wordScore: result.detailedScores.word,
        substringScore: result.detailedScores.substring,
        embeddingScore: result.detailedScores.embedding
      });

      // Return the result
      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      });
    } catch (calcError) {
      console.error("❌ Error calculating similarity:", calcError);
      res.status(500).json({
        success: false,
        error: "Internal server error during similarity calculation",
        message: calcError.message,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error("❌ String Similarity Calculation Error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error during string similarity calculation",
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// POST endpoint for AI-powered similarity search in database table/column
app.post("/aiSimilaritySearch", async (req, res) => {
  try {
    const { searchString, tableName, columnName, options = {} } = req.body;

    // Validation
    if (!searchString || typeof searchString !== "string") {
      console.log("❌ Validation Error: searchString is required and must be a string");
      return res.status(400).json({
        success: false,
        error: "searchString is required and must be a non-empty string",
        received: { searchString, type: typeof searchString }
      });
    }

    if (!tableName || typeof tableName !== "string") {
      console.log("❌ Validation Error: tableName is required and must be a string");
      return res.status(400).json({
        success: false,
        error: "tableName is required and must be a non-empty string",
        received: { tableName, type: typeof tableName }
      });
    }

    if (!columnName || typeof columnName !== "string") {
      console.log("❌ Validation Error: columnName is required and must be a string");
      return res.status(400).json({
        success: false,
        error: "columnName is required and must be a non-empty string",
        received: { columnName, type: typeof columnName }
      });
    }

    // Check if AI similarity search is initialized
    if (!aiSimilaritySearch) {
      console.log("❌ AI Similarity Search not initialized");
      return res.status(500).json({
        success: false,
        error: "AI Similarity Search is not initialized. Please try again in a moment."
      });
    }

    // Ensure database connection is established (lazy initialization)
    try {
      if (!aiSimilaritySearch.isInitialized) {
        await aiSimilaritySearch.initialize();
      }
    } catch (initError) {
      console.error("❌ Failed to initialize database connection:", initError);
      return res.status(500).json({
        success: false,
        error: "Failed to establish database connection",
        message: initError.message
      });
    }

    console.log(`🔍 AI Similarity Search Request:`, {
      searchString: searchString,
      tableName: tableName,
      columnName: columnName,
      options: options,
      timestamp: new Date().toISOString()
    });

    // Perform AI-powered similarity search
    const searchResults = await aiSimilaritySearch.search(searchString, tableName, columnName, options);

    // Log the result for debugging
    console.log(`✅ AI Similarity Search Result:`, {
      searchString: searchResults.searchString,
      totalEntries: searchResults.totalEntries,
      resultsFound: searchResults.resultsReturned,
      searchTime: searchResults.searchTime,
      topMatch:
        searchResults.results.length > 0
          ? {
              value: searchResults.results[0].value,
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
    console.error("❌ AI Similarity Search Error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error during AI similarity search",
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Get embeddings from Ollama API
 */
async function getOllamaEmbedding(text, ollamaConfig) {
  try {
    const { url, model, prompt } = ollamaConfig;

    // Ensure URL ends with /api/embed (Ollama uses /api/embed, not /api/embeddings)
    const baseUrl = url.endsWith("/") ? url.slice(0, -1) : url;
    const embeddingsUrl = `${baseUrl}/api/embed`;

    // If prompt is provided, use it as a template to format the text
    // Replace {text} or {{text}} with the actual text value
    let inputText = text;
    if (prompt && typeof prompt === "string" && prompt.trim().length > 0) {
      // Replace {text} or {{text}} placeholders with the actual text
      inputText = prompt.replace(/\{\{text\}\}|\{text\}/g, text);
    }

    const response = await axios.post(
      embeddingsUrl,
      {
        model: model || "llama2",
        input: inputText // Ollama uses "input", not "prompt"
      },
      {
        timeout: 30000, // 30 second timeout
        headers: {
          "Content-Type": "application/json"
        }
      }
    );

    if (response.data && response.data.embedding) {
      return response.data.embedding;
    } else {
      throw new Error("Invalid response from Ollama API: missing embedding");
    }
  } catch (error) {
    console.error("❌ Error getting Ollama embedding:", error.message);

    // Handle specific error cases
    if (error.response) {
      const status = error.response.status;
      const responseData = error.response.data;

      console.error("   Response status:", status);
      console.error("   Response data:", responseData);

      // Check if the error indicates the model doesn't support embeddings
      const errorMessage = responseData?.error || responseData?.message || "";
      const errorString = JSON.stringify(responseData || {}).toLowerCase();

      if (
        errorString.includes("does not support embeddings") ||
        errorString.includes("doesn't support embeddings") ||
        errorString.includes("embedding not supported") ||
        errorMessage.toLowerCase().includes("embedding")
      ) {
        const modelName = ollamaConfig.model || "the specified model";
        throw new Error(
          `Model "${modelName}" does not support embeddings. Please use an embedding-capable model like "nomic-embed-text", "all-minilm", "mxbai-embed-large", or check the Ollama model library for embedding models.`
        );
      }

      // Handle other HTTP errors
      if (status === 404) {
        throw new Error(
          `Ollama API endpoint not found. Please verify the URL "${ollamaConfig.url}" and ensure the Ollama server is running.`
        );
      }

      if (status === 400) {
        throw new Error(`Bad request to Ollama API: ${errorMessage || "Invalid request parameters"}`);
      }
    }

    // Re-throw the original error if it's not handled above
    throw error;
  }
}

/**
 * Calculate cosine similarity between two embedding vectors
 */
function calculateCosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) {
    throw new Error("Embeddings must have the same length");
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

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (normA * normB);
}

// POST endpoint for AI-powered similarity search using Ollama
app.post("/aiSimilaritySearchOllama", async (req, res) => {
  try {
    const { searchString, tableName, columnName, ai_agent = {}, options = {} } = req.body;

    // Validation
    if (!searchString || typeof searchString !== "string") {
      console.log("❌ Validation Error: searchString is required and must be a string");
      return res.status(400).json({
        success: false,
        error: "searchString is required and must be a non-empty string",
        received: { searchString, type: typeof searchString }
      });
    }

    if (!tableName || typeof tableName !== "string") {
      console.log("❌ Validation Error: tableName is required and must be a string");
      return res.status(400).json({
        success: false,
        error: "tableName is required and must be a non-empty string",
        received: { tableName, type: typeof tableName }
      });
    }

    if (!columnName || typeof columnName !== "string") {
      console.log("❌ Validation Error: columnName is required and must be a string");
      return res.status(400).json({
        success: false,
        error: "columnName is required and must be a non-empty string",
        received: { columnName, type: typeof columnName }
      });
    }

    // Validate ai_agent parameters
    if (!ai_agent.url || typeof ai_agent.url !== "string") {
      console.log("❌ Validation Error: ai_agent.url is required and must be a string");
      return res.status(400).json({
        success: false,
        error: "ai_agent.url is required and must be a non-empty string",
        received: { ai_agent }
      });
    }

    if (!ai_agent.model || typeof ai_agent.model !== "string") {
      console.log("❌ Validation Error: ai_agent.model is required and must be a string");
      return res.status(400).json({
        success: false,
        error: "ai_agent.model is required and must be a non-empty string",
        received: { ai_agent }
      });
    }

    // Check if AI similarity search is initialized (for database access)
    if (!aiSimilaritySearch) {
      console.log("❌ AI Similarity Search not initialized");
      return res.status(500).json({
        success: false,
        error: "AI Similarity Search is not initialized. Please try again in a moment."
      });
    }

    // Ensure database connection is established (lazy initialization)
    try {
      if (!aiSimilaritySearch.isInitialized) {
        await aiSimilaritySearch.initialize();
      }
    } catch (initError) {
      console.error("❌ Failed to initialize database connection:", initError);
      return res.status(500).json({
        success: false,
        error: "Failed to establish database connection",
        message: initError.message
      });
    }

    console.log(`🔍 AI Similarity Search with Ollama Request:`, {
      searchString: searchString,
      tableName: tableName,
      columnName: columnName,
      ai_agent: {
        url: ai_agent.url,
        model: ai_agent.model,
        sampling_temperature: ai_agent.sampling_temperature,
        max_iterations: ai_agent.max_iterations,
        prompt: ai_agent.prompt ? "provided" : "not provided"
      },
      options: options,
      timestamp: new Date().toISOString()
    });

    const startTime = Date.now();

    try {
      // Get Ollama embedding for the search string
      console.log(`🤖 Getting Ollama embedding for search string...`);
      const searchEmbedding = await getOllamaEmbedding(searchString, {
        url: ai_agent.url,
        model: ai_agent.model,
        sampling_temperature: ai_agent.sampling_temperature,
        prompt: ai_agent.prompt
      });
      console.log(`✅ Search embedding obtained (dimension: ${searchEmbedding.length})`);

      // Fetch all entries from the specified column using existing AISimilaritySearch
      const entries = await aiSimilaritySearch.fetchColumnData(
        tableName,
        columnName,
        options.schema,
        options.clauses,
        options.joins,
        options.returnColumns
      );

      if (entries.length === 0) {
        console.log("⚠️ No entries found in the specified column");
        return res.json({
          success: true,
          data: {
            searchString: searchString,
            tableName: tableName,
            columnName: columnName,
            query: {
              original: searchString,
              normalized: aiSimilaritySearch.normalizeText(searchString)
            },
            results: [],
            totalEntries: 0,
            resultsReturned: 0,
            searchTime: Date.now() - startTime
          },
          timestamp: new Date().toISOString()
        });
      }

      console.log(`📊 Processing ${entries.length} entries with Ollama embeddings...`);

      // Process entries in batches
      const batchSize = options.batchSize || 1000;
      const maxResults = options.maxResults || 50;
      const minSimilarity = options.minSimilarity || 0.5;
      const results = [];
      const embeddingsCache = new Map();

      // Process in batches
      for (let i = 0; i < entries.length; i += batchSize) {
        const batch = entries.slice(i, i + batchSize);
        console.log(
          `   Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(entries.length / batchSize)} (${
            batch.length
          } entries)`
        );

        // Get embeddings for batch entries
        const batchEmbeddings = await Promise.all(
          batch.map(async (entry) => {
            const normalizedValue = String(entry.value || "")
              .toLowerCase()
              .trim();
            const cacheKey = normalizedValue;

            // Check cache first
            if (embeddingsCache.has(cacheKey)) {
              return embeddingsCache.get(cacheKey);
            }

            try {
              const embedding = await getOllamaEmbedding(normalizedValue, {
                url: ai_agent.url,
                model: ai_agent.model,
                sampling_temperature: ai_agent.sampling_temperature,
                prompt: ai_agent.prompt
              });
              embeddingsCache.set(cacheKey, embedding);
              return embedding;
            } catch (error) {
              console.error(
                `   ⚠️ Failed to get embedding for entry "${normalizedValue.substring(0, 50)}...":`,
                error.message
              );
              return null; // Skip this entry
            }
          })
        );

        // Calculate similarities
        for (let j = 0; j < batch.length; j++) {
          if (batchEmbeddings[j] === null) {
            continue; // Skip entries that failed to get embeddings
          }

          const similarity = calculateCosineSimilarity(searchEmbedding, batchEmbeddings[j]);

          if (similarity >= minSimilarity) {
            const normalizedValue = String(batch[j].value || "")
              .toLowerCase()
              .trim();
            const normalizedSearch = String(searchString || "")
              .toLowerCase()
              .trim();

            // Check if the value exists as a complete word in the search string
            const wordBoundaryRegex = new RegExp(
              `\\b${normalizedValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
              "i"
            );
            const wordExists = wordBoundaryRegex.test(searchString) ? 1 : 0;

            // Calculate total_similarity: 50% similarity + 50% word_exist
            const totalSimilarity = 0.5 * similarity + 0.5 * wordExists;

            const resultItem = {
              value: batch[j].originalValue || batch[j].value,
              similarity: Math.round(similarity * 10000) / 10000,
              word_exist: wordExists,
              total_similarity: Math.round(totalSimilarity * 10000) / 10000,
              occurrenceCount: batch[j].occurrenceCount || 1
            };

            // Include return columns if they exist
            if (batch[j].returnColumns && Object.keys(batch[j].returnColumns).length > 0) {
              Object.assign(resultItem, batch[j].returnColumns);
            }

            // Include uniqueId if provided
            if (options.uniqueId !== null && options.uniqueId !== undefined) {
              resultItem.uniqueId = options.uniqueId;
            }

            // Include eq_number if provided
            if (options.eq_number !== null && options.eq_number !== undefined) {
              resultItem.eq_number = options.eq_number;
            }

            results.push(resultItem);
          }
        }

        // Periodic cache cleanup if it gets too large
        if (embeddingsCache.size > 10000) {
          const entriesToKeep = Array.from(embeddingsCache.entries()).slice(-5000);
          embeddingsCache.clear();
          entriesToKeep.forEach(([key, value]) => {
            embeddingsCache.set(key, value);
          });
        }
      }

      // Sort by similarity score (highest first)
      results.sort((a, b) => b.similarity - a.similarity);

      // Limit results
      const finalResults = results.slice(0, maxResults);

      const searchTime = Date.now() - startTime;
      console.log(`✅ Ollama search completed: Found ${finalResults.length} matches in ${searchTime}ms`);

      // Build response object
      const response = {
        searchString: searchString,
        tableName: tableName,
        columnName: columnName,
        query: {
          original: searchString,
          normalized: aiSimilaritySearch.normalizeText(searchString)
        },
        results: finalResults,
        totalEntries: entries.length,
        resultsReturned: finalResults.length,
        searchTime: searchTime
      };

      // Include uniqueId and eq_number at top level if provided
      if (options.uniqueId !== null && options.uniqueId !== undefined) {
        response.uniqueId = options.uniqueId;
      }

      if (options.eq_number !== null && options.eq_number !== undefined) {
        response.eq_number = options.eq_number;
      }

      // Return the result
      res.json({
        success: true,
        data: response,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("❌ Error in Ollama similarity search:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error during Ollama similarity search",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error("❌ AI Similarity Search with Ollama Error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error during AI similarity search with Ollama",
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// GET endpoint for AI Similarity Search statistics
app.get("/aiSimilaritySearchStats", async (req, res) => {
  try {
    if (!aiSimilaritySearch) {
      return res.status(500).json({
        success: false,
        error: "AI Similarity Search is not initialized"
      });
    }

    const stats = aiSimilaritySearch.getStats();

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
    console.error("❌ AI Similarity Search Stats Error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error getting AI similarity search statistics",
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// POST endpoint to clear AI Similarity Search cache
app.post("/aiSimilaritySearchClearCache", async (req, res) => {
  try {
    if (!aiSimilaritySearch) {
      return res.status(500).json({
        success: false,
        error: "AI Similarity Search is not initialized"
      });
    }

    aiSimilaritySearch.clearCache();

    res.json({
      success: true,
      message: "AI Similarity Search cache cleared successfully",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("❌ AI Similarity Search Clear Cache Error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error clearing AI similarity search cache",
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// POST endpoint to test AI Similarity Search database connection
app.post("/aiSimilaritySearchTestConnection", async (req, res) => {
  try {
    if (!aiSimilaritySearch) {
      return res.status(500).json({
        success: false,
        error: "AI Similarity Search is not initialized"
      });
    }

    const isConnected = await aiSimilaritySearch.testConnection();

    res.json({
      success: true,
      data: {
        connected: isConnected,
        message: isConnected ? "Database connection successful" : "Database connection failed"
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("❌ AI Similarity Search Test Connection Error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error testing database connection",
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// POST endpoint to execute SQL queries on Ingres database
// Java wrapper class for Ingres JDBC queries (will be created dynamically)
const createJavaWrapper = () => {
  return `import java.sql.*;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONObject;

public class IngresQueryExecutor {
    public static void main(String[] args) {
        if (args.length < 6) {
            System.err.println("Usage: java IngresQueryExecutor <host> <port> <schema> <username> <password> <query_or_file> [is_file]");
            System.exit(1);
        }
        
        String host = args[0];
        String port = args[1];
        String schema = args[2];
        String username = args[3];
        String password = args[4];
        String queryOrFile = args[5];
        boolean isFile = args.length > 6 && "true".equalsIgnoreCase(args[6]);
        
        String query;
        if (isFile) {
            try {
                query = new String(Files.readAllBytes(Paths.get(queryOrFile)), "UTF-8");
            } catch (Exception e) {
                JSONObject error = new JSONObject();
                error.put("success", false);
                error.put("error", "Failed to read query file: " + e.getMessage());
                System.err.println(error.toString());
                System.exit(1);
                return;
            }
        } else {
            query = queryOrFile;
        }
        
        String url = "jdbc:ingres://" + host + ":" + port + "/" + schema + ";char_encode=GREEK";
        
        // Set system properties for UTF-8 encoding to handle Greek characters
        System.setProperty("file.encoding", "UTF-8");
        
        try {
            Class.forName("com.ingres.jdbc.IngresDriver");
            
            // Create connection properties with explicit character encoding
            java.util.Properties props = new java.util.Properties();
            props.setProperty("user", username);
            props.setProperty("password", password);
            props.setProperty("char_encode", "GREEK");
            // Note: Ingres uses ISO-8859-7 for GREEK encoding
            
            Connection conn = DriverManager.getConnection(url, props);
            
            Statement stmt = conn.createStatement();
            ResultSet rs = stmt.executeQuery(query);
            ResultSetMetaData rsmd = rs.getMetaData();
            int columnCount = rsmd.getColumnCount();
            
            JSONArray results = new JSONArray();
            
            while (rs.next()) {
                JSONObject row = new JSONObject();
                for (int i = 1; i <= columnCount; i++) {
                    String columnName = rsmd.getColumnName(i);
                    int columnType = rsmd.getColumnType(i);
                    
                    // Handle different data types and ensure proper encoding for Greek characters
                    // For character types, read as bytes to preserve GREEK encoding (ISO-8859-7)
                    if (columnType == java.sql.Types.VARCHAR || columnType == java.sql.Types.CHAR || 
                        columnType == java.sql.Types.LONGVARCHAR || columnType == java.sql.Types.NVARCHAR ||
                        columnType == java.sql.Types.NCHAR || columnType == java.sql.Types.LONGNVARCHAR) {
                        // Character types - read as bytes to get raw GREEK encoded data
                        try {
                            // Read as bytes directly from ResultSet to preserve encoding
                            byte[] bytes = rs.getBytes(i);
                            if (bytes == null) {
                                row.put(columnName, JSONObject.NULL);
                            } else {
                                // Decode bytes as ISO-8859-7 (GREEK encoding) to get correct Greek text
                                String greekText = new String(bytes, "ISO-8859-7");
                                row.put(columnName, greekText);
                            }
                        } catch (Exception e) {
                            // Fallback: try getString and attempt conversion
                            try {
                                String strValue = rs.getString(i);
                                if (strValue == null) {
                                    row.put(columnName, JSONObject.NULL);
                                } else {
                                    // Get raw bytes using ISO-8859-1 (preserves byte values)
                                    byte[] bytes = strValue.getBytes("ISO-8859-1");
                                    // Decode as ISO-8859-7 (GREEK encoding)
                                    String fixed = new String(bytes, "ISO-8859-7");
                                    row.put(columnName, fixed);
                                }
                            } catch (Exception e2) {
                                // Last resort: use getString as-is
                                Object value = rs.getObject(i);
                                row.put(columnName, value != null ? value.toString() : JSONObject.NULL);
                            }
                        }
                    } else {
                        // Non-character types - use standard getObject
                        Object value = rs.getObject(i);
                        if (value == null) {
                            // Use JSONObject.NULL instead of null to avoid ambiguous method call
                            row.put(columnName, JSONObject.NULL);
                        } else if (value instanceof String) {
                            // String from non-character column - still might need conversion
                            String strValue = (String)value;
                            try {
                                byte[] bytes = strValue.getBytes("ISO-8859-1");
                                String fixed = new String(bytes, "ISO-8859-7");
                                row.put(columnName, fixed);
                            } catch (Exception e) {
                                row.put(columnName, strValue);
                            }
                        } else if (value instanceof byte[]) {
                            // BLOB/BINARY data - convert to string with UTF-8 encoding
                            try {
                                row.put(columnName, new String((byte[])value, "UTF-8"));
                            } catch (java.io.UnsupportedEncodingException e) {
                                row.put(columnName, new String((byte[])value));
                            }
                        } else if (value instanceof java.math.BigDecimal) {
                            // BigDecimal - convert to double to avoid precision issues
                            row.put(columnName, ((java.math.BigDecimal)value).doubleValue());
                        } else if (value instanceof java.sql.Date || value instanceof java.sql.Time || value instanceof java.sql.Timestamp) {
                            // SQL date/time types - convert to string
                            row.put(columnName, value.toString());
                        } else {
                            // Other types (numbers, dates, etc.)
                            row.put(columnName, value);
                        }
                    }
                }
                results.put(row);
            }
            
            JSONObject output = new JSONObject();
            output.put("success", true);
            output.put("rowsReturned", results.length());
            output.put("results", results);
            
            // Output JSON with UTF-8 encoding
            // Use PrintWriter with UTF-8 to ensure proper encoding for Greek characters
            java.io.PrintWriter pw = new java.io.PrintWriter(new java.io.OutputStreamWriter(System.out, java.nio.charset.StandardCharsets.UTF_8), true);
            pw.print(output.toString());
            pw.flush();
            
            rs.close();
            stmt.close();
            conn.close();
        } catch (Exception e) {
            JSONObject error = new JSONObject();
            error.put("success", false);
            error.put("error", e.getMessage());
            error.put("stack", getStackTrace(e));
            System.err.println(error.toString());
            System.exit(1);
        }
    }
    
    private static String getStackTrace(Exception e) {
        java.io.StringWriter sw = new java.io.StringWriter();
        java.io.PrintWriter pw = new java.io.PrintWriter(sw);
        e.printStackTrace(pw);
        return sw.toString();
    }
}`;
};

// POST endpoint to execute SQL queries on Ingres database
app.post("/executeIngresQuery", async (req, res) => {
  console.log("🔌 Executing Ingres query:", req.body.query);
  try {
    const { query, password, jdbcDriverPath, javaPath, jsonLibPath } = req.body;

    // Validation
    if (!query || typeof query !== "string" || query.trim().length === 0) {
      console.log("❌ Validation Error: query is required and must be a non-empty string");
      return res.status(400).json({
        success: false,
        error: "query is required and must be a non-empty string",
        received: { query, type: typeof query }
      });
    }

    // Database connection configuration
    const dbConfig = {
      host: "10.1.3.2",
      port: "I27", // Ingres port format
      schema: "eeaedb",
      username: "drikos",
      password: password || "rocol2",
      char_encode: "GREEK"
    };

    console.log(`🗄️ Ingres Query Execution Request:`, {
      query: query.substring(0, 100) + (query.length > 100 ? "..." : ""),
      host: dbConfig.host,
      port: dbConfig.port,
      schema: dbConfig.schema,
      username: dbConfig.username,
      timestamp: new Date().toISOString()
    });

    // Find Java executable (for running)
    const javaExecutable =
      javaPath || (process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, "bin", "java") : "java");

    // Find Java compiler (javac) - needed for compilation
    // Try to use JDK if JAVA_HOME points to JDK, otherwise try to find javac in common locations
    let javacExecutable;
    if (process.env.JAVA_HOME) {
      const javacPath = path.join(process.env.JAVA_HOME, "bin", "javac");
      if (fs.existsSync(javacPath + ".exe") || fs.existsSync(javacPath)) {
        javacExecutable = javacPath;
      } else {
        // JAVA_HOME points to JRE, try to find JDK in common locations
        const javaHomeDir = path.dirname(process.env.JAVA_HOME);
        const possibleJdkPaths = [
          // Try replacing jre with jdk in the same directory
          process.env.JAVA_HOME.replace(
            /jre[^\\/]*$/i,
            "jdk" + (process.env.JAVA_HOME.match(/jre([^\\/]*)$/i)?.[1] || "")
          ),
          // Try common JDK locations
          path.join(javaHomeDir, "jdk-25"),
          path.join(javaHomeDir, "jdk-21"),
          path.join(javaHomeDir, "jdk-17"),
          path.join(javaHomeDir, "jdk-11"),
          path.join(javaHomeDir, "jdk1.8.0_471"),
          "C:\\Program Files\\Java\\jdk-25",
          "C:\\Program Files\\Java\\jdk-21",
          "C:\\Program Files\\Java\\jdk-17",
          "C:\\Program Files\\Java\\jdk-11",
          "C:\\Program Files (x86)\\Java\\jdk-25",
          "C:\\Program Files (x86)\\Java\\jdk-21",
          "C:\\Program Files (x86)\\Java\\jdk-17",
          "C:\\Program Files (x86)\\Java\\jdk-11"
        ];

        let foundJdk = false;
        for (const jdkPath of possibleJdkPaths) {
          const testJavacPath = path.join(jdkPath, "bin", "javac");
          if (fs.existsSync(testJavacPath + ".exe") || fs.existsSync(testJavacPath)) {
            javacExecutable = testJavacPath;
            foundJdk = true;
            console.log(`✅ Found JDK at: ${jdkPath}`);
            break;
          }
        }

        if (!foundJdk) {
          javacExecutable = "javac"; // Fallback to PATH
        }
      }
    } else {
      javacExecutable = "javac"; // Fallback to PATH
    }

    // Check if Java runtime is available
    try {
      await execAsync(`"${javaExecutable}" -version`);
    } catch (javaError) {
      console.error("❌ Java runtime not found or not accessible");
      return res.status(500).json({
        success: false,
        error: "Java runtime is required but not found",
        message: "Please ensure Java is installed and accessible, or provide javaPath in request",
        javaPath: javaExecutable,
        note: "Java is required to execute JDBC queries"
      });
    }

    // Check if Java compiler (javac) is available
    try {
      await execAsync(`"${javacExecutable}" -version`);
      console.log(`✅ Java compiler found at: ${javacExecutable}`);
    } catch (javacError) {
      console.error("❌ Java compiler (javac) not found");

      // Provide helpful error message with suggestions
      const currentJavaHome = process.env.JAVA_HOME || "not set";
      const suggestions = [];

      if (currentJavaHome.includes("jre")) {
        suggestions.push(`Current JAVA_HOME points to JRE: ${currentJavaHome}`);
        suggestions.push("JRE cannot compile Java code - you need JDK (Java Development Kit)");
        suggestions.push("Please install JDK or update JAVA_HOME in .env file to point to JDK directory");
      }

      suggestions.push(
        "Download JDK from: https://adoptium.net/ or https://www.oracle.com/java/technologies/downloads/"
      );
      suggestions.push("After installing JDK, update .env file: JAVA_HOME=C:\\Program Files\\Java\\jdk-11");

      return res.status(500).json({
        success: false,
        error: "Java Development Kit (JDK) is required for compilation",
        message: "javac compiler not found. JDK (not just JRE) is required to compile the Java wrapper class.",
        currentJavaHome: currentJavaHome,
        javaRuntimePath: javaExecutable,
        javacPath: javacExecutable,
        suggestions: suggestions,
        note: "JRE can run Java programs but cannot compile them. You need JDK which includes the javac compiler."
      });
    }

    // JDBC driver path
    const driverPath = jdbcDriverPath || process.env.INGRES_JDBC_DRIVER_PATH || "./jdbc/iijdbc-12.0-4.4.4.jar";

    // Check if JDBC driver exists
    if (!fs.existsSync(driverPath)) {
      console.error(`❌ JDBC driver not found at: ${driverPath}`);
      return res.status(500).json({
        success: false,
        error: "Ingres JDBC driver JAR file not found",
        driverPath: driverPath,
        note: "Please provide the path to the Ingres JDBC driver JAR file (iijdbc.jar or ingres-jdbc-driver.jar) via jdbcDriverPath parameter or INGRES_JDBC_DRIVER_PATH environment variable"
      });
    }

    // JSON library path (org.json)
    const jsonLib = jsonLibPath || process.env.JSON_LIB_PATH || "./json.jar";

    // Create temporary directory for Java class if it doesn't exist
    const tempDir = path.join(__dirname, "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const javaClassPath = path.join(tempDir, "IngresQueryExecutor.java");
    const javaClassFile = path.join(tempDir, "IngresQueryExecutor.class");

    // Write Java wrapper class
    fs.writeFileSync(javaClassPath, createJavaWrapper());

    // Build classpath (include JDBC driver and JSON library if it exists)
    let classpath = `"${tempDir}"`;
    if (fs.existsSync(driverPath)) {
      classpath += `;"${driverPath}"`;
    }
    if (fs.existsSync(jsonLib)) {
      classpath += `;"${jsonLib}"`;
    }

    // Compile Java class (if not already compiled or if source is newer)
    // Use javac (Java compiler) instead of java (Java runtime)
    const compileCommand = `"${javacExecutable}" -cp ${classpath} -d "${tempDir}" "${javaClassPath}"`;
    try {
      await execAsync(compileCommand);
      console.log("✅ Java wrapper class compiled successfully");
    } catch (compileError) {
      console.error("❌ Failed to compile Java wrapper:", compileError);
      return res.status(500).json({
        success: false,
        error: "Failed to compile Java wrapper class",
        message: compileError.message,
        stderr: compileError.stderr,
        compileCommand: compileCommand,
        note: "Ensure you have the Ingres JDBC driver JAR file and org.json library (json.jar) in the classpath. You can download json.jar from https://mvnrepository.com/artifact/org.json/json"
      });
    }

    // Use file-based approach for queries longer than 1000 characters or containing special characters
    const useFile = query.length > 1000 || query.includes("\n") || query.includes("\r") || query.includes('"');
    let executeCommand;

    if (useFile) {
      // Write query to temporary file with UTF-8 encoding
      const queryFile = path.join(tempDir, "query.txt");
      fs.writeFileSync(queryFile, query, "utf8");
      // Add UTF-8 encoding flags for proper Greek character handling
      executeCommand = `"${javaExecutable}" -Dfile.encoding=UTF-8 -Dconsole.encoding=UTF-8 -cp ${classpath} IngresQueryExecutor "${dbConfig.host}" "${dbConfig.port}" "${dbConfig.schema}" "${dbConfig.username}" "${dbConfig.password}" "${queryFile}" "true"`;
    } else {
      // Escape query for command line (handle special characters)
      const escapedQuery = query.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      // Add UTF-8 encoding flags for proper Greek character handling
      executeCommand = `"${javaExecutable}" -Dfile.encoding=UTF-8 -Dconsole.encoding=UTF-8 -cp ${classpath} IngresQueryExecutor "${dbConfig.host}" "${dbConfig.port}" "${dbConfig.schema}" "${dbConfig.username}" "${dbConfig.password}" "${escapedQuery}" "false"`;
    }

    console.log(`🔌 Executing query via Java JDBC...`);

    try {
      const { stdout, stderr } = await execAsync(executeCommand, {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large result sets
        encoding: "utf8" // Ensure UTF-8 encoding for Greek characters
      });

      if (stderr && stderr.trim().length > 0 && !stderr.includes("Picked up")) {
        // Check if stderr contains JSON error
        try {
          const errorObj = JSON.parse(stderr);
          console.error("❌ Database Error:", errorObj);
          return res.status(500).json({
            success: false,
            error: "Database query execution failed",
            message: errorObj.error || "Unknown error",
            details: errorObj.stack || errorObj.details,
            timestamp: new Date().toISOString()
          });
        } catch (parseError) {
          // Not JSON, might be Java warnings
          console.warn("⚠️ Java warnings:", stderr);
        }
      }

      // Parse JSON output from Java program
      const result = JSON.parse(stdout);
      console.log(`✅ Query executed successfully. Rows returned: ${result.rowsReturned || 0}`);

      res.json({
        success: true,
        data: {
          query: query,
          rowsReturned: result.rowsReturned || 0,
          results: result.results || [],
          executedAt: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      });
    } catch (execError) {
      console.error("❌ Query execution error:", execError);

      // Try to parse error output
      let errorMessage = execError.message;
      let errorDetails = execError.stderr || "";

      try {
        if (execError.stderr) {
          const errorObj = JSON.parse(execError.stderr);
          errorMessage = errorObj.error || errorMessage;
          errorDetails = errorObj.stack || errorDetails;
        }
      } catch (parseError) {
        // Not JSON, use raw error
      }

      res.status(500).json({
        success: false,
        error: "Database query execution failed",
        message: errorMessage,
        details: errorDetails,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error("❌ Ingres Query Execution Error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error during Ingres query execution",
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
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
      "POST /correctGreekName": "Correct and process Greek names with declension",
      "POST /aiNameSearch": "AI-powered semantic search for Greek names",
      "POST /aiPartialNameSearch": "AI-powered partial name search",
      "GET /aiSearchStats": "Get AI searcher statistics and memory usage",
      "POST /aiSearchClearCache": "Clear AI searcher cache",
      "POST /aiNameSearchMSSQL": "AI-powered semantic search in MSSQL database",
      "POST /aiPartialNameSearchMSSQL": "AI-powered partial name search in MSSQL database",
      "GET /aiSearchStatsMSSQL": "Get AI searcher statistics for MSSQL database",
      "POST /aiSearchTestConnectionMSSQL": "Test MSSQL database connection",
      "POST /calculateStringSimilarity": "Calculate similarity score between two strings",
      "POST /aiSimilaritySearch": "AI-powered similarity search in any database table/column",
      "POST /aiSimilaritySearchOllama": "AI-powered similarity search using Ollama embeddings",
      "GET /aiSimilaritySearchStats": "Get AI Similarity Search statistics",
      "POST /aiSimilaritySearchClearCache": "Clear AI Similarity Search cache",
      "POST /aiSimilaritySearchTestConnection": "Test AI Similarity Search database connection",
      "POST /executeIngresQuery": "Execute SQL queries on Ingres database via JDBC",
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
          ignoreStrings: "optional array of strings to ignore when found in filename"
        }
      },
      correctGreekName: {
        method: "POST",
        url: "/correctGreekName",
        body: {
          name: "Greek name to correct (string)",
          options: "optional object with correction options",
          options_targetCase: "target case: 'nominative', 'genitive', 'accusative', 'vocative'",
          options_fixCommonErrors: "boolean to enable error correction"
        }
      },
      aiNameSearch: {
        method: "POST",
        url: "/aiNameSearch",
        body: {
          firstName: "First name to search for (string, optional)",
          lastName: "Last name to search for (string, optional)",
          databaseRecords: "Array of database records with Firstname and Lastname properties",
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
          databaseRecords: "Array of database records with Firstname and Lastname properties",
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
        description: "Get AI searcher statistics and database information for MSSQL"
      },
      aiSearchTestConnectionMSSQL: {
        method: "POST",
        url: "/aiSearchTestConnectionMSSQL",
        description: "Test MSSQL database connection"
      },
      calculateStringSimilarity: {
        method: "POST",
        url: "/calculateStringSimilarity",
        body: {
          string1: "First string to compare (required)",
          string2: "Second string to compare (required)",
          uniqueId: "optional unique ID value to pass through in results",
          eq_number: "optional equipment number value to pass through in results"
        },
        description: "Calculate similarity score between two strings using AI-powered similarity algorithms"
      },
      aiSimilaritySearch: {
        method: "POST",
        url: "/aiSimilaritySearch",
        body: {
          searchString: "String to search for (required)",
          tableName: "Name of the database table to search in (required)",
          columnName: "Name of the column to search in (required)",
          options: "optional object with search options",
          options_schema: "optional database schema name",
          options_clauses:
            "optional WHERE clause conditions as string (e.g., 'ApplicationCategoryId = 10' or '[Categories].[ApplicationCategoryId] = 10' for joined tables)",
          options_joins:
            "optional array of JOIN definitions [{type: 'INNER', table: 'Table2', schema: 'Migration', condition: 'Table1.Id = Table2.Id'}]",
          options_returnColumns:
            "optional array of additional column names to return in results (e.g., ['Id', 'CategoryId', '[Practice].[Name]'])",
          options_uniqueId: "optional unique ID value to pass through in results (not from database)",
          options_eq_number: "optional equipment number value to pass through in results (not from database)",
          options_minSimilarity: "minimum similarity threshold (0-1, default: 0.5)",
          options_maxResults: "maximum number of results to return (default: 50)",
          options_batchSize: "batch size for processing (default: 1000)"
        },
        description: "AI-powered similarity search that finds similar strings in any database table column"
      },
      aiSimilaritySearchOllama: {
        method: "POST",
        url: "/aiSimilaritySearchOllama",
        body: {
          searchString: "String to search for (required)",
          tableName: "Name of the database table to search in (required)",
          columnName: "Name of the column to search in (required)",
          ai_agent: "object with Ollama configuration (required)",
          ai_agent_url: "The Base URL of the Ollama server (required)",
          ai_agent_model:
            "The model which will generate the embeddings (required). Note: Not all Ollama models support embeddings. Use embedding-capable models like 'nomic-embed-text', 'all-minilm', 'mxbai-embed-large', etc. Check Ollama's model library for embedding models.",
          ai_agent_sampling_temperature: "Controls the randomness of the generated embeddings (optional)",
          ai_agent_max_iterations: "The maximum number of iterations the agent will run before stopping (optional)",
          ai_agent_prompt:
            "Optional prompt template for formatting the input text. Use {text} or {{text}} as a placeholder for the actual text (optional)",
          options: "optional object with search options",
          options_schema: "optional database schema name",
          options_clauses:
            "optional WHERE clause conditions as string (e.g., 'ApplicationCategoryId = 10' or '[Categories].[ApplicationCategoryId] = 10' for joined tables)",
          options_joins:
            "optional array of JOIN definitions [{type: 'INNER', table: 'Table2', schema: 'Migration', condition: 'Table1.Id = Table2.Id'}]",
          options_returnColumns:
            "optional array of additional column names to return in results (e.g., ['Id', 'CategoryId', '[Practice].[Name]'])",
          options_uniqueId: "optional unique ID value to pass through in results (not from database)",
          options_eq_number: "optional equipment number value to pass through in results (not from database)",
          options_minSimilarity: "minimum similarity threshold (0-1, default: 0.5)",
          options_maxResults: "maximum number of results to return (default: 50)",
          options_batchSize: "batch size for processing (default: 1000)"
        },
        description:
          "AI-powered similarity search using Ollama embeddings to find similar strings in any database table column"
      },
      aiSimilaritySearchStats: {
        method: "GET",
        url: "/aiSimilaritySearchStats",
        description: "Get AI Similarity Search statistics and memory usage"
      },
      aiSimilaritySearchClearCache: {
        method: "POST",
        url: "/aiSimilaritySearchClearCache",
        description: "Clear AI Similarity Search cache to free memory"
      },
      aiSimilaritySearchTestConnection: {
        method: "POST",
        url: "/aiSimilaritySearchTestConnection",
        description: "Test AI Similarity Search database connection"
      },
      executeIngresQuery: {
        method: "POST",
        url: "/executeIngresQuery",
        body: {
          query: "SQL query to execute (required)",
          password: "Database password (optional, defaults to 'rocol2')",
          jdbcDriverPath:
            "Path to Ingres JDBC driver JAR file (optional, can also be set via INGRES_JDBC_DRIVER_PATH environment variable, defaults to './ingres-jdbc-driver.jar')",
          javaPath: "Path to Java executable (optional, uses JAVA_HOME or 'java' from PATH)",
          jsonLibPath:
            "Path to org.json JAR file (optional, can also be set via JSON_LIB_PATH environment variable, defaults to './json.jar')"
        },
        description:
          "Execute SQL queries on Ingres database via JDBC using Java. Requires Java runtime, Ingres JDBC driver JAR file, and org.json library (json.jar).",
        requirements: [
          "Java runtime (JRE or JDK) installed and accessible",
          "Ingres JDBC driver JAR file (iijdbc.jar or ingres-jdbc-driver.jar)",
          "org.json library JAR file (json.jar) - download from https://mvnrepository.com/artifact/org.json/json"
        ],
        note: "Database connection: host=10.1.3.2, port=I27, schema=eeaedb, username=drikos, char_encode=GREEK"
      }
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 String Similarity Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔍 Compare endpoint: POST http://localhost:${PORT}/compare`);
  console.log(`🔢 Find AFAKS endpoint: POST http://localhost:${PORT}/findAfaks`);
  console.log(`🇬🇷 Greek Name Correction endpoint: POST http://localhost:${PORT}/correctGreekName`);
  console.log(`🤖 AI Name Search endpoint: POST http://localhost:${PORT}/aiNameSearch`);
  console.log(`🔍 AI Partial Name Search endpoint: POST http://localhost:${PORT}/aiPartialNameSearch`);
  console.log(`📊 AI Search Stats endpoint: GET http://localhost:${PORT}/aiSearchStats`);
  console.log(`🧹 AI Search Clear Cache endpoint: POST http://localhost:${PORT}/aiSearchClearCache`);
  console.log(`🗄️ AI Name Search MSSQL endpoint: POST http://localhost:${PORT}/aiNameSearchMSSQL`);
  console.log(`🔍 AI Partial Name Search MSSQL endpoint: POST http://localhost:${PORT}/aiPartialNameSearchMSSQL`);
  console.log(`📊 AI Search Stats MSSQL endpoint: GET http://localhost:${PORT}/aiSearchStatsMSSQL`);
  console.log(`🔗 AI Search Test Connection MSSQL endpoint: POST http://localhost:${PORT}/aiSearchTestConnectionMSSQL`);
  console.log(`🔍 Calculate String Similarity endpoint: POST http://localhost:${PORT}/calculateStringSimilarity`);
  console.log(`🔍 AI Similarity Search endpoint: POST http://localhost:${PORT}/aiSimilaritySearch`);
  console.log(`🤖 AI Similarity Search with Ollama endpoint: POST http://localhost:${PORT}/aiSimilaritySearchOllama`);
  console.log(`📊 AI Similarity Search Stats endpoint: GET http://localhost:${PORT}/aiSimilaritySearchStats`);
  console.log(
    `🧹 AI Similarity Search Clear Cache endpoint: POST http://localhost:${PORT}/aiSimilaritySearchClearCache`
  );
  console.log(
    `🔗 AI Similarity Search Test Connection endpoint: POST http://localhost:${PORT}/aiSimilaritySearchTestConnection`
  );
  console.log(`🗄️ Execute Ingres Query endpoint: POST http://localhost:${PORT}/executeIngresQuery`);
});

module.exports = app;
