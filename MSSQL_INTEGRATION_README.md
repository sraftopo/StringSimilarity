# AI Name Database Checker - MSSQL Integration

This document describes the MSSQL database integration for the AI Name Database Checker, allowing you to search directly in your MSSQL database using intelligent semantic search.

## Overview

The MSSQL integration provides AI-powered semantic search capabilities that connect directly to your MSSQL database, eliminating the need to fetch all records into memory. It supports:

- **Direct Database Search**: Searches directly in MSSQL database
- **Memory Efficient**: Processes records in batches without loading everything into memory
- **Intelligent Matching**: Uses TensorFlow.js for semantic similarity
- **Greek Language Support**: Handles both Greek script and Latin transliteration
- **Performance Optimized**: Designed for large databases (50k+ records)

## Setup

### 1. Install Dependencies

```bash
npm install mssql dotenv
```

### 2. Environment Configuration

Create a `.env` file in your project root with the following configuration:

```env
# MSSQL Database Configuration
DB_HOST=localhost
DB_PORT=1433
DB_NAME=TIASuite
DB_SCHEMA=Core
DB_TABLE=Person
DB_USERNAME=your_username
DB_PASSWORD=your_password

# AI Search Configuration
AI_BATCH_SIZE=1000
AI_SIMILARITY_THRESHOLD=0.7
AI_MAX_RESULTS=50
AI_USE_GPU=false
```

### 3. Database Schema

Ensure your MSSQL database has the following table structure:

```sql
-- Example table structure
CREATE TABLE [Core].[Person] (
    [Id] int IDENTITY(1,1) PRIMARY KEY,
    [Firstname] nvarchar(100),
    [Lastname] nvarchar(100),
    -- Add other columns as needed
);
```

## API Endpoints

### 1. POST /aiNameSearchMSSQL

**Description**: AI-powered semantic search for Greek names in MSSQL database.

**Request Body**:
```json
{
  "firstName": "Γιάννης",           // Optional: First name to search for
  "lastName": "Παπαδόπουλος",       // Optional: Last name to search for
  "options": {                      // Optional: Search options
    "gender": "masculine",          // Filter by gender: 'masculine', 'feminine'
    "minSimilarity": 0.7,           // Minimum similarity threshold (0-1)
    "maxResults": 50,               // Maximum number of results
    "limit": 10000                  // Limit database records to process
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
    ],
    "totalProcessed": 1000,
    "searchTime": 1234567890
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### 2. POST /aiPartialNameSearchMSSQL

**Description**: AI-powered partial name search in MSSQL database.

**Request Body**:
```json
{
  "partialName": "Μαρ",             // Required: Partial name (min 2 characters)
  "options": {                      // Optional: Search options
    "similarityThreshold": 0.5,     // Lower threshold for partial matches
    "maxResults": 20,               // Maximum number of results
    "limit": 5000                   // Limit database records to process
  }
}
```

### 3. GET /aiSearchStatsMSSQL

**Description**: Get AI searcher statistics and database information.

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
    },
    "databaseStats": {
      "total_records": 50000,
      "unique_firstnames": 15000,
      "unique_lastnames": 12000
    }
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### 4. POST /aiSearchTestConnectionMSSQL

**Description**: Test MSSQL database connection.

**Response**:
```json
{
  "success": true,
  "data": {
    "connected": true,
    "message": "Database connection successful"
  },
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
  options: {
    maxResults: 10
  }
};

const response = await axios.post('http://localhost:3031/aiNameSearchMSSQL', searchRequest);
console.log(`Found ${response.data.data.results.length} matches`);
```

### Latin Transliteration Search

```javascript
const searchRequest = {
  firstName: 'Giannis',        // Latin transliteration
  lastName: 'Papadopoulos',   // Latin transliteration
  options: {
    maxResults: 10
  }
};

const response = await axios.post('http://localhost:3031/aiNameSearchMSSQL', searchRequest);
```

### Gender-Filtered Search

```javascript
const searchRequest = {
  firstName: '',
  lastName: '',
  options: {
    gender: 'feminine',
    maxResults: 20
  }
};

const response = await axios.post('http://localhost:3031/aiNameSearchMSSQL', searchRequest);
```

### Partial Name Search

```javascript
const searchRequest = {
  partialName: 'Μαρ',
  options: {
    maxResults: 10
  }
};

const response = await axios.post('http://localhost:3031/aiPartialNameSearchMSSQL', searchRequest);
```

### Performance Monitoring

```javascript
// Test database connection
const connectionResponse = await axios.post('http://localhost:3031/aiSearchTestConnectionMSSQL');
console.log('Database connected:', connectionResponse.data.data.connected);

// Get statistics
const statsResponse = await axios.get('http://localhost:3031/aiSearchStatsMSSQL');
console.log('Total records:', statsResponse.data.data.databaseStats.total_records);
console.log('Memory usage:', statsResponse.data.data.memoryUsage.heapUsed + 'MB');
```

## Performance Optimization

### Batch Size Configuration

Adjust batch size based on your database size and available memory:

- **Small databases (< 10k)**: `AI_BATCH_SIZE=1000`
- **Medium databases (10k-50k)**: `AI_BATCH_SIZE=500`
- **Large databases (50k+)**: `AI_BATCH_SIZE=200-500`

### Memory Management

- Monitor memory usage with `/aiSearchStatsMSSQL`
- Use `limit` option to process only a subset of records for testing
- The system automatically manages memory with batching

### Database Optimization

Ensure your database has proper indexes:

```sql
-- Recommended indexes for better performance
CREATE INDEX IX_Person_Firstname ON [Core].[Person] ([Firstname]);
CREATE INDEX IX_Person_Lastname ON [Core].[Person] ([Lastname]);
CREATE INDEX IX_Person_Names ON [Core].[Person] ([Firstname], [Lastname]);
```

## Error Handling

### Common Error Responses

**Database Connection Error**:
```json
{
  "success": false,
  "error": "AI Name Database Searcher with MSSQL is not initialized. Please try again in a moment."
}
```

**Invalid Request**:
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

## Testing

Run the MSSQL endpoint tests:

```bash
node example-mssql-endpoints.js
```

This will test all MSSQL endpoints with your database and demonstrate proper usage.

## Troubleshooting

### Common Issues

1. **Database Connection Failed**:
   - Check your `.env` file configuration
   - Verify database server is running
   - Ensure user has proper permissions

2. **Slow Performance**:
   - Reduce batch size in `.env` file
   - Add database indexes
   - Use `limit` option to process fewer records

3. **Memory Issues**:
   - Reduce `AI_BATCH_SIZE` in `.env` file
   - Use `limit` option to process fewer records
   - Monitor memory usage with `/aiSearchStatsMSSQL`

4. **No Results Found**:
   - Check if database has data
   - Lower similarity threshold
   - Verify name format in database

### Debug Information

Check the server logs for detailed information about:
- Database connection status
- Query execution times
- Memory usage
- Error details

## Security Considerations

- Store database credentials securely in `.env` file
- Use environment variables for production
- Consider using connection pooling for high-traffic applications
- Implement proper authentication and authorization

## Production Deployment

For production deployment:

1. **Environment Variables**: Use proper environment variable management
2. **Connection Pooling**: Configure appropriate pool settings
3. **Monitoring**: Set up monitoring for database performance
4. **Backup**: Ensure proper database backup procedures
5. **Security**: Implement proper security measures

## Support

For issues and questions:
1. Check the server logs for error details
2. Use `/aiSearchTestConnectionMSSQL` to verify database connectivity
3. Use `/aiSearchStatsMSSQL` to monitor system status
4. Review the troubleshooting section above
