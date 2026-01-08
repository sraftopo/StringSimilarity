/**
 * Example usage of the Greek Names Correction Library
 * This file demonstrates various use cases and capabilities
 */

const GreekNameCorrector = require("./greeknames_rules.js");

// Initialize the corrector
const corrector = new GreekNameCorrector();

console.log("🇬🇷 Greek Names Correction Library - Usage Examples");
console.log("==================================================\n");

// Example 1: Basic name correction
console.log("📝 Example 1: Basic Name Correction");
console.log("-----------------------------------");
const basicResult = corrector.correctName("Γιάννης");
console.log(`Input: ${basicResult.original}`);
console.log(`Gender: ${basicResult.gender}`);
console.log(`Case: ${basicResult.currentCase}`);
console.log(`Confidence: ${(basicResult.confidence * 100).toFixed(1)}%\n`);

// Example 2: Latin to Greek transliteration
console.log("📝 Example 2: Latin to Greek Transliteration");
console.log("--------------------------------------------");
const latinNames = ["Giannis", "Maria", "Nikos", "Eleni"];
latinNames.forEach((name) => {
  const result = corrector.correctName(name);
  console.log(`${name} → ${result.greekScript} (${result.gender})`);
});
console.log();

// Example 3: Case transformation
console.log("📝 Example 3: Case Transformation");
console.log("---------------------------------");
const name = "Γιάννης";
const cases = ["nominative", "genitive", "accusative", "vocative"];
cases.forEach((targetCase) => {
  const result = corrector.correctName(name, { targetCase });
  console.log(`${name} (${targetCase}) → ${result.corrected}`);
});
console.log();

// Example 4: Advanced correction with options
console.log("📝 Example 4: Advanced Correction with Options");
console.log("---------------------------------------------");
const advancedResult = corrector.correctName("Giannis", {
  targetCase: "genitive",
  fixCommonErrors: true
});
console.log('Input: "Giannis" with genitive case transformation');
console.log(`Greek Script: ${advancedResult.greekScript}`);
console.log(`Corrected: ${advancedResult.corrected}`);
console.log(`Gender: ${advancedResult.gender}`);
console.log(`Confidence: ${(advancedResult.confidence * 100).toFixed(1)}%\n`);

// Example 5: Batch processing
console.log("📝 Example 5: Batch Processing");
console.log("------------------------------");
const batchNames = ["Γιάννης", "Μαρία", "Νίκος", "Ελένη", "Κώστας"];
console.log("Processing multiple names:");
batchNames.forEach((name) => {
  const result = corrector.correctName(name);
  console.log(`  ${name} → ${result.gender} (${result.currentCase})`);
});
console.log();

// Example 6: Error handling
console.log("📝 Example 6: Error Handling");
console.log("----------------------------");
const errorCases = [null, "", "   ", 123, {}];
errorCases.forEach((testCase) => {
  const result = corrector.correctName(testCase);
  if (result.error) {
    console.log(`Input: ${JSON.stringify(testCase)} → Error: ${result.error}`);
  } else {
    console.log(`Input: ${JSON.stringify(testCase)} → Valid`);
  }
});
console.log();

// Example 7: Real-world use case
console.log("📝 Example 7: Real-world Use Case");
console.log("---------------------------------");
console.log("Scenario: Processing a list of names from a database");
const databaseNames = [
  "Giannis", // Latin transliteration
  "Μαρία", // Greek script
  "Nikos", // Latin transliteration
  "Ελένη", // Greek script
  "Kostas" // Latin transliteration
];

console.log("Original database entries:");
databaseNames.forEach((name) => console.log(`  - ${name}`));

console.log("\nProcessed and standardized:");
databaseNames.forEach((name) => {
  const result = corrector.correctName(name, {
    fixCommonErrors: true
  });
  console.log(`  ${name} → ${result.greekScript} (${result.gender})`);
});

console.log("\n🎉 All examples completed!");
console.log("\n💡 Tips for using the library:");
console.log("  - Always check the confidence score for accuracy");
console.log("  - Use targetCase for proper Greek declension");
console.log("  - Enable fixCommonErrors for better results");
console.log("  - The library works with both Greek and Latin scripts");

