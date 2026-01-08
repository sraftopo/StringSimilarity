/**
 * Example usage of AI Name Database Checker API endpoints
 * Demonstrates how to use the new AI-powered search endpoints
 */

const axios = require("axios");

const BASE_URL = "http://localhost:3031";

// Sample database records for testing
const sampleDatabaseRecords = [
  { Firstname: "Γιάννης", Lastname: "Παπαδόπουλος" },
  { Firstname: "Μαρία", Lastname: "Κωνσταντίνου" },
  { Firstname: "Νίκος", Lastname: "Αντωνίου" },
  { Firstname: "Ελένη", Lastname: "Δημητρίου" },
  { Firstname: "Κώστας", Lastname: "Γεωργίου" },
  { Firstname: "Σοφία", Lastname: "Μιχαήλ" },
  { Firstname: "Δημήτρης", Lastname: "Αλεξάνδρου" },
  { Firstname: "Αναστασία", Lastname: "Βασιλείου" },
  { Firstname: "Γεώργιος", Lastname: "Νικολάου" },
  { Firstname: "Κατερίνα", Lastname: "Παύλου" },
  { Firstname: "Ιωάννης", Lastname: "Παπαδόπουλος" },
  { Firstname: "Ευαγγελία", Lastname: "Κωνσταντίνου" },
  { Firstname: "Μιχάλης", Lastname: "Αντωνίου" },
  { Firstname: "Αλέξανδρος", Lastname: "Δημητρίου" },
  { Firstname: "Βασίλης", Lastname: "Γεωργίου" },
  { Firstname: "Χριστίνα", Lastname: "Παπαγιάννη" },
  { Firstname: "Παναγιώτης", Lastname: "Δημητρίου" },
  { Firstname: "Αγγελική", Lastname: "Αλεξάνδρου" },
  { Firstname: "Σπύρος", Lastname: "Βασιλείου" }
];

async function testAIEndpoints() {
  console.log("🤖 AI Name Database Checker - API Endpoint Examples");
  console.log("==================================================\n");

  try {
    // Test 1: AI Name Search - Exact match
    console.log("1. AI Name Search - Exact Match");
    console.log("--------------------------------");

    const searchRequest1 = {
      firstName: "Γιάννης",
      lastName: "Παπαδόπουλος",
      databaseRecords: sampleDatabaseRecords,
      options: {
        maxResults: 5
      }
    };

    const response1 = await axios.post(
      `${BASE_URL}/aiNameSearch`,
      searchRequest1
    );
    console.log(`✅ Found ${response1.data.data.results.length} matches`);
    response1.data.data.results.forEach((result, index) => {
      console.log(
        `  ${index + 1}. ${result.fullName} (${(
          result.similarity * 100
        ).toFixed(1)}% similarity)`
      );
    });

    // Test 2: AI Name Search - Latin transliteration
    console.log("\n2. AI Name Search - Latin Transliteration");
    console.log("------------------------------------------");

    const searchRequest2 = {
      firstName: "Giannis",
      lastName: "Papadopoulos",
      databaseRecords: sampleDatabaseRecords,
      options: {
        maxResults: 5
      }
    };

    const response2 = await axios.post(
      `${BASE_URL}/aiNameSearch`,
      searchRequest2
    );
    console.log(
      `✅ Found ${response2.data.data.results.length} matches for Latin input`
    );
    response2.data.data.results.forEach((result, index) => {
      console.log(
        `  ${index + 1}. ${result.fullName} (${(
          result.similarity * 100
        ).toFixed(1)}% similarity)`
      );
    });

    // Test 3: AI Name Search - Gender filtering
    console.log("\n3. AI Name Search - Gender Filtering");
    console.log("------------------------------------");

    const searchRequest3 = {
      firstName: "",
      lastName: "",
      databaseRecords: sampleDatabaseRecords,
      options: {
        gender: "feminine",
        maxResults: 10
      }
    };

    const response3 = await axios.post(
      `${BASE_URL}/aiNameSearch`,
      searchRequest3
    );
    console.log(`✅ Found ${response3.data.data.results.length} female names`);
    response3.data.data.results.forEach((result, index) => {
      console.log(
        `  ${index + 1}. ${result.fullName} (${(
          result.similarity * 100
        ).toFixed(1)}% similarity)`
      );
    });

    // Test 4: AI Partial Name Search
    console.log("\n4. AI Partial Name Search");
    console.log("-------------------------");

    const partialSearchRequest = {
      partialName: "Μαρ",
      databaseRecords: sampleDatabaseRecords,
      options: {
        maxResults: 5
      }
    };

    const response4 = await axios.post(
      `${BASE_URL}/aiPartialNameSearch`,
      partialSearchRequest
    );
    console.log(
      `✅ Found ${response4.data.data.results.length} partial matches for "Μαρ"`
    );
    response4.data.data.results.forEach((result, index) => {
      console.log(
        `  ${index + 1}. ${result.fullName} (${(
          result.similarity * 100
        ).toFixed(1)}% similarity)`
      );
    });

    // Test 5: AI Search Statistics
    console.log("\n5. AI Search Statistics");
    console.log("----------------------");

    const statsResponse = await axios.get(`${BASE_URL}/aiSearchStats`);
    const stats = statsResponse.data.data;
    console.log(`✅ AI Searcher Status:`);
    console.log(`  - Initialized: ${stats.isInitialized}`);
    console.log(`  - Batch Size: ${stats.batchSize}`);
    console.log(`  - Similarity Threshold: ${stats.similarityThreshold}`);
    console.log(`  - Cache Size: ${stats.embeddingsCacheSize} entries`);
    console.log(
      `  - Memory Usage: ${stats.memoryUsage.heapUsed}MB heap, ${stats.memoryUsage.rss}MB RSS`
    );

    // Test 6: Clear Cache
    console.log("\n6. Clear AI Search Cache");
    console.log("-----------------------");

    const clearCacheResponse = await axios.post(
      `${BASE_URL}/aiSearchClearCache`
    );
    console.log(`✅ ${clearCacheResponse.data.message}`);

    // Test 7: Error handling - Invalid request
    console.log("\n7. Error Handling - Invalid Request");
    console.log("-----------------------------------");

    try {
      const invalidRequest = {
        firstName: "",
        lastName: "",
        databaseRecords: []
      };

      await axios.post(`${BASE_URL}/aiNameSearch`, invalidRequest);
    } catch (error) {
      console.log(
        `✅ Correctly handled invalid request: ${error.response.data.error}`
      );
    }

    // Test 8: Performance test with larger dataset
    console.log("\n8. Performance Test");
    console.log("------------------");

    // Generate larger dataset
    const largeDataset = generateLargeDataset(1000);
    console.log(`Generated ${largeDataset.length} test records`);

    const startTime = Date.now();
    const performanceRequest = {
      firstName: "Γιάννης",
      lastName: "Παπαδόπουλος",
      databaseRecords: largeDataset,
      options: {
        maxResults: 10
      }
    };

    const performanceResponse = await axios.post(
      `${BASE_URL}/aiNameSearch`,
      performanceRequest
    );
    const endTime = Date.now();

    console.log(`✅ Performance test completed in ${endTime - startTime}ms`);
    console.log(
      `✅ Found ${performanceResponse.data.data.results.length} matches`
    );
    console.log(
      `✅ Processed ${performanceResponse.data.data.totalProcessed} records`
    );
    console.log(
      `✅ Performance: ${Math.round(
        largeDataset.length / ((endTime - startTime) / 1000)
      )} records/second`
    );

    console.log("\n🎉 All AI endpoint tests completed successfully!");
  } catch (error) {
    console.error("❌ Test failed:", error.response?.data || error.message);
  }
}

// Helper function to generate large dataset for testing
function generateLargeDataset(size) {
  const firstNames = [
    "Γιάννης",
    "Μαρία",
    "Νίκος",
    "Ελένη",
    "Κώστας",
    "Σοφία",
    "Δημήτρης",
    "Αναστασία",
    "Γεώργιος",
    "Κατερίνα",
    "Ιωάννης",
    "Ευαγγελία",
    "Μιχάλης",
    "Αλέξανδρος",
    "Βασίλης",
    "Χριστίνα",
    "Παναγιώτης",
    "Αγγελική",
    "Σπύρος"
  ];

  const lastNames = [
    "Παπαδόπουλος",
    "Κωνσταντίνου",
    "Αντωνίου",
    "Δημητρίου",
    "Γεωργίου",
    "Μιχαήλ",
    "Αλεξάνδρου",
    "Βασιλείου",
    "Νικολάου",
    "Παύλου",
    "Κωνσταντίνου",
    "Παπαγιάννη",
    "Δημητρίου",
    "Αντωνίου",
    "Γεωργίου",
    "Μιχαήλ",
    "Αλεξάνδρου"
  ];

  const dataset = [];
  for (let i = 0; i < size; i++) {
    dataset.push({
      Firstname: firstNames[Math.floor(Math.random() * firstNames.length)],
      Lastname: lastNames[Math.floor(Math.random() * lastNames.length)]
    });
  }

  return dataset;
}

// Example of how to use the endpoints in your application
async function exampleUsage() {
  console.log("\n📚 Example Usage in Your Application");
  console.log("====================================");

  const exampleCode = `
// Example: Search for a Greek name in your database
const searchRequest = {
  firstName: 'Γιάννης',
  lastName: 'Παπαδόπουλος',
  databaseRecords: yourDatabaseRecords, // Array of {Firstname, Lastname} objects
  options: {
    gender: 'masculine',        // Optional: filter by gender
    minSimilarity: 0.7,        // Optional: minimum similarity threshold
    maxResults: 20             // Optional: limit results
  }
};

const response = await axios.post('http://localhost:3031/aiNameSearch', searchRequest);
const results = response.data.data.results;

// Process results
results.forEach((result, index) => {
  console.log(\`\${index + 1}. \${result.fullName} (\${(result.similarity * 100).toFixed(1)}% similarity)\`);
});
`;

  console.log(exampleCode);
}

// Run examples if this file is executed directly
if (require.main === module) {
  testAIEndpoints()
    .then(() => exampleUsage())
    .catch(console.error);
}

module.exports = { testAIEndpoints, exampleUsage };

