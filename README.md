# String Similarity Server

A Node.js Express server that provides string similarity comparison using multiple algorithms including TF-IDF, Jaro-Winkler, Levenshtein distance, Jaccard similarity, and cosine similarity.

## Features

- **Multiple Similarity Algorithms**: Combines 5 different similarity metrics for accurate results
- **Weighted Scoring**: Uses weighted combination of different similarity measures
- **RESTful API**: Simple POST endpoint for string comparison
- **Flexible Input**: Works with arrays of objects and custom property selection
- **JSON String Parsing**: Automatically parses JSON strings sent as inputObject
- **Nested Object Access**: Supports dot notation for accessing nested properties (e.g., 'practicetypes.practicetype_title')
- **Detailed Results**: Returns similarity scores with detailed breakdowns

## Installation

```bash
npm install
```

## Usage

### Start the Server

```bash
npm start
```

The server will start on port 3031.

### API Endpoints

#### POST /compare

Compare a string against an array of objects.

**Request Body:**
```json
{
  "inputObject": {
    "id": 1,
    "title": "Hello world, this is a test",
    "category": "Sample"
  },
  "inputElement": "title",
  "arrayOfObjects": [
    { "id": 1, "text": "Hello world, this is a test" },
    { "id": 2, "text": "Hello world, this is a sample" },
    { "id": 3, "text": "Hi there, this is a test" }
  ],
  "elementToCheck": "text"
}
```

**Alternative: JSON String as inputObject:**
```json
{
  "inputObject": "{\"id\": 1, \"title\": \"Hello world, this is a test\", \"category\": \"Sample\"}",
  "inputElement": "title",
  "arrayOfObjects": [
    { "id": 1, "text": "Hello world, this is a test" },
    { "id": 2, "text": "Hello world, this is a sample" },
    { "id": 3, "text": "Hi there, this is a test" }
  ],
  "elementToCheck": "text"
}
```

**Nested Object Access with Dot Notation:**
```json
{
  "inputObject": {
    "practicetypes": {
      "practicetype_title": "Εξωτερική ακτινοθεραπεία με ακτίνες Χ",
      "practicetype_number": 1
    },
    "practice_number": 1,
    "practice_code": "Γ1"
  },
  "inputElement": "practicetypes.practicetype_title",
  "arrayOfObjects": [
    { "PracticeTypeTitle": "Εξωτερική ακτινοθεραπεία με ακτίνες Χ" },
    { "PracticeTypeTitle": "Διαγνωστική ακτινοσκόπηση" }
  ],
  "elementToCheck": "PracticeTypeTitle"
}
```

**Response:**
```json
{
  "inputObject": {
    "id": 1,
    "title": "Hello world, this is a test",
    "category": "Sample"
  },
  "inputString": "Hello world, this is a test",
  "totalCompared": 3,
  "resultsReturned": 3,
  "results": [
    {
      "index": 0,
      "score": 1.0,
      "targetString": "Hello world, this is a test",
      "originalObject": { "id": 1, "text": "Hello world, this is a test" }
    },
    {
      "index": 2,
      "score": 0.7234,
      "targetString": "Hi there, this is a test",
      "originalObject": { "id": 3, "text": "Hi there, this is a test" }
    },
    {
      "index": 1,
      "score": 0.6789,
      "targetString": "Hello world, this is a sample",
      "originalObject": { "id": 2, "text": "Hello world, this is a sample" }
    }
  ],
  "topMatch": {
    "index": 0,
    "score": 1.0,
    "targetString": "Hello world, this is a test",
    "originalObject": { "id": 1, "text": "Hello world, this is a test" }
  }
}
```

#### GET /health

Health check endpoint.

#### GET /

Server information and usage instructions.

## Similarity Algorithms Used

1. **String Similarity (Dice Coefficient)**: 30% weight
2. **Jaro-Winkler Distance**: 20% weight
3. **Levenshtein Distance**: 20% weight
4. **Jaccard Similarity**: 15% weight
5. **TF-IDF Cosine Similarity**: 15% weight

## Testing

Run the test script to verify the server functionality:

```bash
node test-server.js
```

## Development

For development with auto-restart:

```bash
npm run dev
```

## Example Usage with curl

```bash
curl -X POST http://localhost:3031/compare \
  -H "Content-Type: application/json" \
  -d '{
    "inputObject": {
      "id": 1,
      "title": "Hello world",
      "category": "Greeting"
    },
    "inputElement": "title",
    "arrayOfObjects": [
      {"id": 1, "text": "Hello world"},
      {"id": 2, "text": "Hi there"},
      {"id": 3, "text": "Goodbye world"}
    ],
    "elementToCheck": "text"
  }'
```

## Error Handling

The server includes comprehensive error handling for:
- Missing or invalid input parameters
- Empty arrays
- Invalid object structures
- Server errors

All errors return appropriate HTTP status codes and descriptive error messages.
