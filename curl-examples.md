# Greek Name Correction API - cURL Examples

## Basic Usage

### 1. Basic Greek Name Correction
```bash
curl -X POST http://localhost:3031/correctGreekName \
  -H "Content-Type: application/json" \
  -d '{"name": "Γιάννης"}'
```

### 2. Latin Transliteration
```bash
curl -X POST http://localhost:3031/correctGreekName \
  -H "Content-Type: application/json" \
  -d '{"name": "Giannis"}'
```

### 3. Case Transformation to Genitive
```bash
curl -X POST http://localhost:3031/correctGreekName \
  -H "Content-Type: application/json" \
  -d '{"name": "Γιάννης", "options": {"targetCase": "genitive"}}'
```

### 4. Case Transformation to Vocative
```bash
curl -X POST http://localhost:3031/correctGreekName \
  -H "Content-Type: application/json" \
  -d '{"name": "Γιάννης", "options": {"targetCase": "vocative"}}'
```

### 5. Latin to Greek with Case Transformation
```bash
curl -X POST http://localhost:3031/correctGreekName \
  -H "Content-Type: application/json" \
  -d '{"name": "Maria", "options": {"targetCase": "genitive"}}'
```

### 6. Error Correction Enabled
```bash
curl -X POST http://localhost:3031/correctGreekName \
  -H "Content-Type: application/json" \
  -d '{"name": "Γιάννι", "options": {"fixCommonErrors": true}}'
```

## Expected Response Format

```json
{
  "success": true,
  "data": {
    "original": "Γιάννης",
    "corrected": "Γιάννης",
    "greekScript": "Γιάννης",
    "latinTransliteration": "Giannis",
    "gender": "masculine",
    "currentCase": "nominative",
    "isGreekScript": true,
    "confidence": 1.0
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Error Response Format

```json
{
  "success": false,
  "error": "Invalid name provided. Name must be a non-empty string.",
  "received": {
    "name": null,
    "type": "object"
  }
}
```

## Server Health Check

```bash
curl http://localhost:3031/health
```

## API Documentation

```bash
curl http://localhost:3031/
```
