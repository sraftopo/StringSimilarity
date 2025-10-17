const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const natural = require('natural');
const stringSimilarity = require('string-similarity');
const { distance } = require('ml-distance');
const { Matrix } = require('ml-matrix');

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
    
    if (req.method === 'POST' && req.path === '/compare') {
        console.log(`📝 Request Body Summary:`, {
            inputObject: req.body.inputObject ? 'Object provided' : 'undefined',
            inputElement: req.body.inputElement || 'undefined',
            inputString: req.body.inputObject && req.body.inputElement && req.body.inputObject[req.body.inputElement] ? 
                `${req.body.inputObject[req.body.inputElement].substring(0, 50)}${req.body.inputObject[req.body.inputElement].length > 50 ? '...' : ''}` : 'undefined',
            arrayOfObjects: req.body.arrayOfObjects ? `${req.body.arrayOfObjects.length} objects` : 'undefined',
            elementToCheck: req.body.elementToCheck || 'undefined'
        });
        
        // Debug logging for object parsing
        console.log(`🔍 Debug - Raw inputObject:`, req.body.inputObject);
        console.log(`🔍 Debug - inputObject type:`, typeof req.body.inputObject);
        console.log(`🔍 Debug - inputObject constructor:`, req.body.inputObject?.constructor?.name);
        console.log(`🔍 Debug - inputObject keys:`, req.body.inputObject ? Object.keys(req.body.inputObject) : 'N/A');
        console.log(`🔍 Debug - Full request body keys:`, Object.keys(req.body));
        console.log(`🔍 Debug - Content-Type:`, req.get('Content-Type'));
    }
    
    next();
});

// Initialize TF-IDF for better text similarity
const tfidf = new natural.TfIdf();

// Text preprocessing function
function preprocessText(text) {
    return text
        .toLowerCase()
        .replace(/[^\w\s]/g, '') // Remove punctuation
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
}

// Calculate cosine similarity between two vectors
function cosineSimilarity(vecA, vecB) {
    if (vecA.length !== vecB.length) {
        throw new Error('Vectors must have the same length');
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
    corpus.forEach(doc => tfidf.addDocument(doc));
    
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
    scores.levenshtein = maxLength === 0 ? 1 : 1 - (levenshtein / maxLength);
    
    // 4. Jaccard similarity
    const inputWords = new Set(inputText.toLowerCase().split(/\s+/));
    const targetWords = new Set(targetText.toLowerCase().split(/\s+/));
    const intersection = new Set([...inputWords].filter(x => targetWords.has(x)));
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
        if (!targetString || typeof targetString !== 'string') {
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
app.post('/compare', (req, res) => {
    try {
        const { inputObject, inputElement, arrayOfObjects, elementToCheck } = req.body;
        
        // Validation with detailed logging
        console.log('🔍 Validation Debug:');
        console.log('  - inputObject exists:', !!inputObject);
        console.log('  - inputObject type:', typeof inputObject);
        console.log('  - inputObject value:', inputObject);
        console.log('  - inputObject is null:', inputObject === null);
        console.log('  - inputObject is array:', Array.isArray(inputObject));
        
        let parsedInputObject = inputObject;
        
        // Try to parse inputObject if it's a string
        if (typeof inputObject === 'string') {
            console.log('🔄 Attempting to parse inputObject string as JSON...');
            try {
                parsedInputObject = JSON.parse(inputObject);
                console.log('✅ Successfully parsed inputObject string to object');
                console.log('  - Parsed type:', typeof parsedInputObject);
                console.log('  - Parsed keys:', Object.keys(parsedInputObject));
            } catch (parseError) {
                console.log('❌ Failed to parse inputObject string as JSON:', parseError.message);
                console.log('❌ Raw string value:', inputObject.substring(0, 100) + (inputObject.length > 100 ? '...' : ''));
                return res.status(400).json({
                    error: 'inputObject string could not be parsed as valid JSON',
                    debug: {
                        received: inputObject,
                        type: typeof inputObject,
                        parseError: parseError.message
                    }
                });
            }
        }
        
        if (!parsedInputObject || typeof parsedInputObject !== 'object' || Array.isArray(parsedInputObject)) {
            console.log('❌ Validation Error: inputObject is required and must be an object');
            console.log('❌ Debug - inputObject details:', {
                exists: !!parsedInputObject,
                type: typeof parsedInputObject,
                isArray: Array.isArray(parsedInputObject),
                isNull: parsedInputObject === null,
                value: parsedInputObject
            });
            return res.status(400).json({
                error: 'inputObject is required and must be an object',
                debug: {
                    received: parsedInputObject,
                    type: typeof parsedInputObject,
                    isArray: Array.isArray(parsedInputObject)
                }
            });
        }
        
        // Update inputObject to use the parsed version
        const finalInputObject = parsedInputObject;
        
        if (!inputElement || typeof inputElement !== 'string') {
            console.log('❌ Validation Error: inputElement is required and must be a string');
            return res.status(400).json({
                error: 'inputElement is required and must be a string'
            });
        }
        
        // Helper function to get nested property using dot notation
        function getNestedProperty(obj, path) {
            return path.split('.').reduce((current, key) => {
                return current && current[key] !== undefined ? current[key] : undefined;
            }, obj);
        }
        
        // Check if inputElement exists (supports dot notation)
        const inputString = getNestedProperty(finalInputObject, inputElement);
        
        if (inputString === undefined) {
            console.log('❌ Validation Error: inputObject does not have the specified inputElement path');
            console.log('❌ Debug - Searched path:', inputElement);
            console.log('❌ Debug - Available keys:', Object.keys(finalInputObject));
            return res.status(400).json({
                error: 'inputObject does not have the specified inputElement path',
                debug: {
                    searchedPath: inputElement,
                    availableKeys: Object.keys(finalInputObject)
                }
            });
        }
        if (!inputString || typeof inputString !== 'string') {
            console.log('❌ Validation Error: inputElement value must be a string');
            return res.status(400).json({
                error: 'inputElement value must be a string'
            });
        }
        
        if (!Array.isArray(arrayOfObjects)) {
            console.log('❌ Validation Error: arrayOfObjects is required and must be an array');
            return res.status(400).json({
                error: 'arrayOfObjects is required and must be an array'
            });
        }
        
        if (!elementToCheck || typeof elementToCheck !== 'string') {
            console.log('❌ Validation Error: elementToCheck is required and must be a string');
            return res.status(400).json({
                error: 'elementToCheck is required and must be a string'
            });
        }
        
        // Filter out objects that don't have the specified element
        const validObjects = arrayOfObjects.filter(obj => 
            obj && typeof obj === 'object' && obj.hasOwnProperty(elementToCheck)
        );
        
        if (validObjects.length === 0) {
            console.log('❌ Validation Error: No valid objects found with the specified elementToCheck');
            return res.status(400).json({
                error: 'No valid objects found with the specified elementToCheck'
            });
        }
        
        // Perform similarity comparison
        const comparisonResults = compareStrings(inputString, validObjects, elementToCheck);
        
        // Filter results with score > 0 (optional threshold)
        const filteredResults = comparisonResults.filter(result => result.score > 0);
        
        // Format response
        const response = {
            inputObject: finalInputObject,
            inputString: inputString,
            totalCompared: validObjects.length,
            resultsReturned: filteredResults.length,
            results: filteredResults.map(result => ({
                index: result.index,
                score: Math.round(result.score * 10000) / 10000, // Round to 4 decimal places
                targetString: result.targetString,
                originalObject: result.originalObject
            })),
            topMatch: filteredResults.length > 0 ? {
                index: filteredResults[0].index,
                score: Math.round(filteredResults[0].score * 10000) / 10000,
                targetString: filteredResults[0].targetString,
                originalObject: filteredResults[0].originalObject
            } : null
        };
        
        // Log response summary
        console.log(`✅ Response: ${response.resultsReturned}/${response.totalCompared} matches found`);
        if (response.topMatch) {
            console.log(`🎯 Top match: Score ${response.topMatch.score} - "${response.topMatch.targetString.substring(0, 50)}${response.topMatch.targetString.length > 50 ? '...' : ''}"`);
        }
        
        res.json(response);
        
    } catch (error) {
        console.error('❌ Error in comparison:', error.message);
        console.error('Stack trace:', error.stack);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message 
        });
    }
});

// POST endpoint for finding AFKAS numbers in filenames
app.post('/findAfaks', (req, res) => {
    try {
        const { filename, ignoreStrings } = req.body;
        
        // Validation
        if (!filename || typeof filename !== 'string') {
            console.log('❌ Validation Error: filename is required and must be a string');
            return res.status(400).json({
                error: 'filename is required and must be a string'
            });
        }
        
        // Validate ignoreStrings if provided
        if (ignoreStrings !== undefined) {
            if (!Array.isArray(ignoreStrings)) {
                console.log('❌ Validation Error: ignoreStrings must be an array');
                return res.status(400).json({
                    error: 'ignoreStrings must be an array of strings'
                });
            }
            
            // Check if all elements in ignoreStrings are strings
            const invalidElements = ignoreStrings.filter(item => typeof item !== 'string');
            if (invalidElements.length > 0) {
                console.log('❌ Validation Error: All elements in ignoreStrings must be strings');
                return res.status(400).json({
                    error: 'All elements in ignoreStrings must be strings'
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
        const matchValues = matches.map(match => match[1]);
        
        // Convert to numbers and remove duplicates
        let afkasNumbers = matchValues.length > 0 ? 
            [...new Set(matchValues.map(match => parseInt(match, 10)))] : [];
        
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
            console.log(`🔍 User-provided ignoreStrings: [${ignoreStrings.join(', ')}]`);
            allIgnoreNumbers.push(...ignoreStrings.map(str => parseInt(str, 10)).filter(num => !isNaN(num)));
        }
        
        // Filter out numbers that should be ignored
        if (allIgnoreNumbers.length > 0) {
            console.log(`🔍 Filtering with all ignore numbers: [${allIgnoreNumbers.join(', ')}]`);
            
            afkasNumbers = afkasNumbers.filter(number => {
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
        
        console.log(`🔍 AFKAS Search: "${filename}" -> [${afkasNumbers.join(', ')}]`);
        
        res.json(response);
        
    } catch (error) {
        console.error('❌ Error in findAfaks:', error.message);
        console.error('Stack trace:', error.stack);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'String Similarity Server is running',
        port: PORT
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'String Similarity Server',
        version: '1.0.0',
        endpoints: {
            'POST /compare': 'Compare string similarity',
            'POST /findAfaks': 'Extract 4-5 digit AFKAS numbers from filenames',
            'GET /health': 'Health check'
        },
        usage: {
            compare: {
                method: 'POST',
                url: '/compare',
                body: {
                    inputObject: 'object containing the data to compare',
                    inputElement: 'property name in inputObject to use for comparison',
                    arrayOfObjects: 'array of objects to search in',
                    elementToCheck: 'property name to compare against'
                }
            },
            findAfaks: {
                method: 'POST',
                url: '/findAfaks',
                body: {
                    filename: 'filename string to extract AFKAS numbers from',
                    ignoreStrings: 'optional array of strings to ignore when found in filename'
                }
            }
        }
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 String Similarity Server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🔍 Compare endpoint: POST http://localhost:${PORT}/compare`);
    console.log(`🔢 Find AFKAS endpoint: POST http://localhost:${PORT}/findAfaks`);
});

module.exports = app;
