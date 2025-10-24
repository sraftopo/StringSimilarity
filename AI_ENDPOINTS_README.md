# AI Name Database Checker API Endpoints

This document describes the new AI-powered endpoints added to the String Similarity Server for intelligent Greek name database searching.

## Overview

The AI Name Database Checker uses TensorFlow.js and advanced semantic search algorithms to provide intelligent name matching across large Greek name databases (50k+ records) with memory-efficient batching.

## Endpoints

### 1. POST /aiNameSearch

**Description**: AI-powered semantic search for Greek names using first name and last name.

**Request Body**:
```json
{
  "firstName": "Γιάννης",           // Optional: First name to search for
  "lastName": "Παπαδόπουλος",       // Optional: Last name to search for
  "databaseRecords": [              // Required: Array of database records
    {
      "Firstname": "Γιάννης",
      "Lastname": "Παπαδόπουλος"
    }
    // ... more records
  ],
  "options": {                      // Optional: Search options
    "gender": "masculine",          // Filter by gender: 'masculine', 'feminine'
    "minSimilarity": 0.7,           // Minimum similarity threshold (0-1)
    "maxResults": 50                // Maximum number of results
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "query": {
      "original": {
        "firstName": "Γιάννης",
        "lastName": "Παπαδόπουλος"
      },
      "corrected": {
        "firstName": "Γιάννης",
        "lastName": "Παπαδόπουλος"
      },
      "processed": "Γιάννης Παπαδόπουλος"
    },
    "results": [
      {
        "Firstname": "Γιάννης",
        "Lastname": "Παπαδόπουλος",
        "similarity": 0.95,
        "fullName": "Γιάννης Παπαδόπουλος"
      }
      // ... more results
    ],
    "totalProcessed": 1000,
    "searchTime": 1234567890
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### 2. POST /aiPartialNameSearch

**Description**: AI-powered partial name search for fuzzy matching.

**Request Body**:
```json
{
  "partialName": "Μαρ",             // Required: Partial name (min 2 characters)
  "databaseRecords": [              // Required: Array of database records
    {
      "Firstname": "Μαρία",
      "Lastname": "Κωνσταντίνου"
    }
    // ... more records
  ],
  "options": {                      // Optional: Search options
    "similarityThreshold": 0.5,     // Lower threshold for partial matches
    "maxResults": 20                // Maximum number of results
  }
}
```

**Response**: Same format as `/aiNameSearch`

### 3. GET /aiSearchStats

**Description**: Get AI searcher statistics and memory usage.

**Response**:
```json
{
  "success": true,
  "data": {
    "isInitialized": true,
    "batchSize": 1000,
    "similarityThreshold": 0.7,
    "embeddingsCacheSize": 150,
    "memoryUsage": {
      "heapUsed": 45,
      "heapTotal": 67,
      "external": 12,
      "rss": 89
    }
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### 4. POST /aiSearchClearCache

**Description**: Clear AI searcher cache to free memory.

**Response**:
```json
{
  "success": true,
  "message": "AI searcher cache cleared successfully",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## Usage Examples

### Basic Name Search

```javascript
const axios = require('axios');

const searchRequest = {
  firstName: 'Γιάννης',
  lastName: 'Παπαδόπουλος',
  databaseRecords: yourDatabaseRecords,
  options: {
    maxResults: 10
  }
};

const response = await axios.post('http://localhost:3031/aiNameSearch', searchRequest);
console.log(`Found ${response.data.data.results.length} matches`);
```

### Latin Transliteration Search

```javascript
const searchRequest = {
  firstName: 'Giannis',        // Latin transliteration
  lastName: 'Papadopoulos',   // Latin transliteration
  databaseRecords: yourDatabaseRecords
};

const response = await axios.post('http://localhost:3031/aiNameSearch', searchRequest);
```

### Gender-Filtered Search

```javascript
const searchRequest = {
  firstName: '',
  lastName: '',
  databaseRecords: yourDatabaseRecords,
  options: {
    gender: 'feminine',
    maxResults: 20
  }
};

const response = await axios.post('http://localhost:3031/aiNameSearch', searchRequest);
```

### Partial Name Search

```javascript
const searchRequest = {
  partialName: 'Μαρ',
  databaseRecords: yourDatabaseRecords,
  options: {
    maxResults: 10
  }
};

const response = await axios.post('http://localhost:3031/aiPartialNameSearch', searchRequest);
```

### Performance Monitoring

```javascript
// Get statistics
const statsResponse = await axios.get('http://localhost:3031/aiSearchStats');
console.log(`Memory usage: ${statsResponse.data.data.memoryUsage.heapUsed}MB`);

// Clear cache if needed
await axios.post('http://localhost:3031/aiSearchClearCache');
```

## Error Handling

### Common Error Responses

**400 Bad Request**:
```json
{
  "success": false,
  "error": "At least one name (first or last) must be provided",
  "received": {
    "firstName": "",
    "lastName": ""
  }
}
```

**500 Internal Server Error**:
```json
{
  "success": false,
  "error": "AI Name Database Searcher is not initialized. Please try again in a moment."
}
```

## Performance Considerations

### Batch Size Configuration

The AI searcher processes records in batches to manage memory efficiently:

- **Small datasets (< 10k)**: Default batch size of 1000 works well
- **Large datasets (50k+)**: Consider reducing batch size to 500-800
- **Very large datasets (100k+)**: Use batch size of 200-500

### Memory Management

- Monitor memory usage with `/aiSearchStats`
- Clear cache with `/aiSearchClearCache` when memory usage is high
- The searcher automatically cleans up tensors to prevent memory leaks

### Similarity Thresholds

- **High precision**: Use threshold 0.8-0.9
- **Balanced**: Use threshold 0.6-0.7 (default)
- **High recall**: Use threshold 0.3-0.5

## Database Integration

### MySQL Integration

```javascript
const mysql = require('mysql2/promise');

async function searchInDatabase(firstName, lastName) {
  // Connect to database
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'your_username',
    password: 'your_password',
    database: 'your_database'
  });

  // Fetch records
  const [rows] = await connection.execute(
    'SELECT Firstname, Lastname FROM names LIMIT 10000'
  );

  // Perform AI search
  const searchRequest = {
    firstName,
    lastName,
    databaseRecords: rows
  };

  const response = await axios.post('http://localhost:3031/aiNameSearch', searchRequest);
  
  await connection.end();
  return response.data;
}
```

### SQLite Integration

```javascript
const sqlite3 = require('sqlite3').verbose();

async function searchInSQLite(firstName, lastName) {
  const db = new sqlite3.Database('names.db');
  
  return new Promise((resolve, reject) => {
    db.all("SELECT Firstname, Lastname FROM names", async (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      
      const searchRequest = {
        firstName,
        lastName,
        databaseRecords: rows
      };
      
      try {
        const response = await axios.post('http://localhost:3031/aiNameSearch', searchRequest);
        resolve(response.data);
      } catch (error) {
        reject(error);
      }
    });
  });
}
```

## Testing

Run the example endpoint tests:

```bash
node example-ai-endpoints.js
```

This will test all AI endpoints with sample data and demonstrate proper usage.

## Requirements

- Node.js 14+
- TensorFlow.js 4.15+
- At least 2GB RAM for large datasets
- Optional: CUDA-compatible GPU for GPU acceleration

## Troubleshooting

### Common Issues

1. **"AI searcher not initialized"**: Wait a moment for initialization to complete
2. **Memory errors**: Reduce batch size or clear cache
3. **Low similarity scores**: Adjust similarity threshold or check data quality
4. **Slow performance**: Enable GPU acceleration or reduce batch size

### Debug Information

Check the server logs for detailed information about:
- Search requests and responses
- Memory usage
- Performance metrics
- Error details

## Support

For issues and questions, check the server logs and use the `/aiSearchStats` endpoint to monitor system status.
