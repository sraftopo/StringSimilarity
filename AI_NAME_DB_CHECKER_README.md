# AI Name Database Checker

An intelligent semantic search library for Greek names using TensorFlow.js. This library provides advanced AI-powered search capabilities for large Greek name databases (50k+ records) with memory-efficient batching and semantic similarity matching.

## Features

- **Intelligent Semantic Search**: Uses TensorFlow.js and sentence transformers for truly intelligent name matching
- **Greek Language Support**: Specialized for Greek names with transliteration support (Greek ↔ Latin)
- **Memory Efficient**: Batching system for processing large datasets (50k+ records) without memory issues
- **Flexible Search**: Supports exact names, partial names, and fuzzy matching
- **Gender Detection**: Built-in Greek name gender detection and filtering
- **High Performance**: Optimized for speed with GPU/CPU backend options
- **Database Integration**: Ready-to-use database integration helpers

## Installation

```bash
npm install @tensorflow/tfjs @tensorflow/tfjs-node sentence-transformers sqlite3 mysql2
```

## Quick Start

```javascript
const AINameDBSearcher = require('./ai_name_db_checker.js');

// Initialize the searcher
const searcher = new AINameDBSearcher({
  batchSize: 1000,           // Process 1000 records at a time
  similarityThreshold: 0.7,   // 70% similarity threshold
  maxResults: 50,            // Return top 50 results
  useGPU: false              // Use CPU for better compatibility
});

// Sample database records
const databaseRecords = [
  { Firstname: 'Γιάννης', Lastname: 'Παπαδόπουλος' },
  { Firstname: 'Μαρία', Lastname: 'Κωνσταντίνου' },
  { Firstname: 'Νίκος', Lastname: 'Αντωνίου' },
  // ... more records
];

// Search for names
const results = await searcher.searchNames('Γιάννης', 'Παπαδόπουλος', databaseRecords);

console.log(`Found ${results.results.length} matches:`);
results.results.forEach((result, index) => {
  console.log(`${index + 1}. ${result.fullName} (${(result.similarity * 100).toFixed(1)}% similarity)`);
});
```

## API Reference

### AINameDBSearcher Class

#### Constructor Options

```javascript
const searcher = new AINameDBSearcher({
  batchSize: 1000,                    // Records per batch (default: 1000)
  similarityThreshold: 0.7,           // Minimum similarity score (default: 0.7)
  maxResults: 50,                     // Maximum results to return (default: 50)
  useGPU: false,                      // Use GPU acceleration (default: false)
  modelPath: 'path/to/model'          // Custom model path (optional)
});
```

#### Main Methods

##### `searchNames(firstName, lastName, databaseRecords, options)`

The primary search function that accepts first name and last name parameters.

**Parameters:**
- `firstName` (string): First name to search for
- `lastName` (string): Last name to search for  
- `databaseRecords` (Array): Array of database records with `Firstname` and `Lastname` properties
- `options` (Object): Additional search options

**Options:**
```javascript
{
  gender: 'masculine' | 'feminine',   // Filter by gender
  minSimilarity: 0.8,                // Minimum similarity threshold
  maxResults: 20,                     // Limit results
  similarityThreshold: 0.6            // Override default threshold
}
```

**Returns:**
```javascript
{
  query: {
    original: { firstName, lastName },
    corrected: { firstName: correctedFirstName, lastName: correctedLastName },
    processed: "processed query text"
  },
  results: [
    {
      Firstname: "Γιάννης",
      Lastname: "Παπαδόπουλος", 
      similarity: 0.95,
      fullName: "Γιάννης Παπαδόπουλος"
    }
    // ... more results
  ],
  totalProcessed: 50000,
  searchTime: 1234567890
}
```

##### `searchPartialName(partialName, databaseRecords, options)`

Search using partial names for fuzzy matching.

```javascript
const results = await searcher.searchPartialName('Μαρ', databaseRecords);
```

##### `getSearchStats()`

Get performance and configuration statistics.

```javascript
const stats = searcher.getSearchStats();
console.log(stats);
// {
//   isInitialized: true,
//   batchSize: 1000,
//   similarityThreshold: 0.7,
//   embeddingsCacheSize: 150,
//   memoryUsage: { heapUsed: 123456789, ... }
// }
```

##### `clearCache()`

Clear the embeddings cache to free memory.

```javascript
searcher.clearCache();
```

##### `dispose()`

Clean up resources and dispose of the model.

```javascript
searcher.dispose();
```

## Database Integration

### MySQL Integration

```javascript
const mysql = require('mysql2/promise');
const { DatabaseIntegration } = require('./example-ai-search.js');

const dbConfig = {
  host: 'localhost',
  user: 'your_username', 
  password: 'your_password',
  database: 'your_database'
};

const dbIntegration = new DatabaseIntegration(dbConfig);

// Connect to database
await dbIntegration.connect();

// Search in database
const results = await dbIntegration.searchInDatabase(
  searcher,
  'Γιάννης', 
  'Παπαδόπουλος',
  'names_table',
  { limit: 10000 }
);

await dbIntegration.disconnect();
```

### SQLite Integration

```javascript
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('names.db');

// Fetch records
db.all("SELECT Firstname, Lastname FROM names", async (err, rows) => {
  if (err) throw err;
  
  const results = await searcher.searchNames('Γιάννης', 'Παπαδόπουλος', rows);
  console.log(`Found ${results.results.length} matches`);
});
```

## Advanced Usage Examples

### Gender-Filtered Search

```javascript
// Search only for female names
const femaleResults = await searcher.searchNames('', '', databaseRecords, {
  gender: 'feminine',
  minSimilarity: 0.6
});
```

### Partial Name Matching

```javascript
// Find names starting with "Μαρ"
const partialResults = await searcher.searchPartialName('Μαρ', databaseRecords);
```

### Latin Transliteration Support

```javascript
// Search using Latin transliteration
const latinResults = await searcher.searchNames('Giannis', 'Papadopoulos', databaseRecords);
```

### Performance Optimization

```javascript
// For very large datasets (100k+ records)
const searcher = new AINameDBSearcher({
  batchSize: 500,           // Smaller batches for large datasets
  useGPU: true,            // Use GPU if available
  similarityThreshold: 0.8  // Higher threshold for better performance
});
```

## Memory Management

The library is designed to handle large datasets efficiently:

- **Batching**: Processes records in configurable batches
- **Memory Cleanup**: Automatic tensor disposal to prevent memory leaks
- **Cache Management**: Optional embeddings cache with manual cleanup
- **Garbage Collection**: Automatic memory cleanup when available

```javascript
// Monitor memory usage
const stats = searcher.getSearchStats();
console.log(`Memory usage: ${Math.round(stats.memoryUsage.heapUsed / 1024 / 1024)}MB`);

// Clear cache when needed
searcher.clearCache();
```

## Performance Tips

1. **Batch Size**: Adjust based on available memory
   - Small datasets (< 10k): batchSize: 1000-2000
   - Large datasets (50k+): batchSize: 500-1000
   - Very large datasets (100k+): batchSize: 200-500

2. **GPU Usage**: Enable GPU for faster processing
   ```javascript
   const searcher = new AINameDBSearcher({ useGPU: true });
   ```

3. **Similarity Threshold**: Higher thresholds improve performance
   ```javascript
   const searcher = new AINameDBSearcher({ similarityThreshold: 0.8 });
   ```

4. **Result Limiting**: Limit results for better performance
   ```javascript
   const results = await searcher.searchNames(firstName, lastName, records, {
     maxResults: 20
   });
   ```

## Error Handling

```javascript
try {
  const results = await searcher.searchNames('Γιάννης', 'Παπαδόπουλος', databaseRecords);
} catch (error) {
  if (error.message.includes('At least one name')) {
    console.error('Please provide at least one name to search for');
  } else if (error.message.includes('Database records array')) {
    console.error('Please provide valid database records');
  } else {
    console.error('Search failed:', error.message);
  }
}
```

## Testing

Run the included test suite:

```bash
node ai_name_db_checker.js
```

Or run the comprehensive examples:

```bash
node example-ai-search.js
```

## Requirements

- Node.js 14+
- TensorFlow.js 4.15+
- At least 2GB RAM for large datasets
- Optional: CUDA-compatible GPU for GPU acceleration

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions, please check the documentation or create an issue in the repository.
