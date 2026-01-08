/**
 * Example usage of AI Name Database Checker MSSQL API endpoints
 * Demonstrates how to use the new AI-powered search endpoints with MSSQL database
 */

const axios = require("axios");

const BASE_URL = "http://localhost:3031";

async function testMSSQLEndpoints() {
  console.log("🗄️ AI Name Database Checker - MSSQL API Endpoint Examples");
  console.log("========================================================\n");

  try {
    // Test 1: Test database connection
    console.log("1. Testing MSSQL Database Connection");
    console.log("------------------------------------");

    const connectionResponse = await axios.post(
      `${BASE_URL}/aiSearchTestConnectionMSSQL`
    );
    console.log(
      `✅ Database connection: ${
        connectionResponse.data.data.connected ? "SUCCESS" : "FAILED"
      }`
    );
    console.log(`📝 Message: ${connectionResponse.data.data.message}`);

    if (!connectionResponse.data.data.connected) {
      console.log(
        "❌ Database connection failed. Please check your .env file and database settings."
      );
      return;
    }

    // Test 2: Get database statistics
    console.log("\n2. Getting Database Statistics");
    console.log("-------------------------------");

    const statsResponse = await axios.get(`${BASE_URL}/aiSearchStatsMSSQL`);
    const stats = statsResponse.data.data;
    console.log(`✅ AI Searcher Status:`);
    console.log(`  - Initialized: ${stats.isInitialized}`);
    console.log(`  - Batch Size: ${stats.batchSize}`);
    console.log(`  - Similarity Threshold: ${stats.similarityThreshold}`);
    console.log(`  - Cache Size: ${stats.embeddingsCacheSize} entries`);
    console.log(
      `  - Memory Usage: ${stats.memoryUsage.heapUsed}MB heap, ${stats.memoryUsage.rss}MB RSS`
    );

    if (stats.databaseStats) {
      console.log(`✅ Database Statistics:`);
      console.log(`  - Total Records: ${stats.databaseStats.total_records}`);
      console.log(
        `  - Unique First Names: ${stats.databaseStats.unique_firstnames}`
      );
      console.log(
        `  - Unique Last Names: ${stats.databaseStats.unique_lastnames}`
      );
    }

    // Test 3: AI Name Search - Exact match
    console.log("\n3. AI Name Search - Exact Match (MSSQL)");
    console.log("--------------------------------------");

    const searchRequest1 = {
      firstName: "Γιάννης",
      lastName: "Παπαδόπουλος",
      options: {
        maxResults: 5
      }
    };

    const response1 = await axios.post(
      `${BASE_URL}/aiNameSearchMSSQL`,
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

    // Test 4: AI Name Search - Latin transliteration
    console.log("\n4. AI Name Search - Latin Transliteration (MSSQL)");
    console.log("------------------------------------------------");

    const searchRequest2 = {
      firstName: "Giannis",
      lastName: "Papadopoulos",
      options: {
        maxResults: 5
      }
    };

    const response2 = await axios.post(
      `${BASE_URL}/aiNameSearchMSSQL`,
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

    // Test 5: AI Name Search - Gender filtering
    console.log("\n5. AI Name Search - Gender Filtering (MSSQL)");
    console.log("---------------------------------------------");

    const searchRequest3 = {
      firstName: "",
      lastName: "",
      options: {
        gender: "feminine",
        maxResults: 10
      }
    };

    const response3 = await axios.post(
      `${BASE_URL}/aiNameSearchMSSQL`,
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

    // Test 6: AI Partial Name Search
    console.log("\n6. AI Partial Name Search (MSSQL)");
    console.log("---------------------------------");

    const partialSearchRequest = {
      partialName: "Μαρ",
      options: {
        maxResults: 5
      }
    };

    const response4 = await axios.post(
      `${BASE_URL}/aiPartialNameSearchMSSQL`,
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

    // Test 7: Performance test with limited records
    console.log("\n7. Performance Test (MSSQL)");
    console.log("---------------------------");

    const startTime = Date.now();
    const performanceRequest = {
      firstName: "Γιάννης",
      lastName: "Παπαδόπουλος",
      options: {
        maxResults: 10,
        limit: 1000 // Limit to 1000 records for performance test
      }
    };

    const performanceResponse = await axios.post(
      `${BASE_URL}/aiNameSearchMSSQL`,
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
        performanceResponse.data.data.totalProcessed /
          ((endTime - startTime) / 1000)
      )} records/second`
    );

    // Test 8: Error handling - Invalid request
    console.log("\n8. Error Handling - Invalid Request (MSSQL)");
    console.log("--------------------------------------------");

    try {
      const invalidRequest = {
        firstName: "",
        lastName: "",
        options: {}
      };

      await axios.post(`${BASE_URL}/aiNameSearchMSSQL`, invalidRequest);
    } catch (error) {
      console.log(
        `✅ Correctly handled invalid request: ${error.response.data.error}`
      );
    }

    console.log("\n🎉 All MSSQL AI endpoint tests completed successfully!");
  } catch (error) {
    console.error("❌ Test failed:", error.response?.data || error.message);
  }
}

// Example of how to use the MSSQL endpoints in your application
async function exampleUsage() {
  console.log("\n📚 Example Usage with MSSQL Database");
  console.log("====================================");

  const exampleCode = `
// Example: Search for a Greek name in your MSSQL database
const searchRequest = {
  firstName: 'Γιάννης',
  lastName: 'Παπαδόπουλος',
  options: {
    gender: 'masculine',        // Optional: filter by gender
    minSimilarity: 0.7,        // Optional: minimum similarity threshold
    maxResults: 20,            // Optional: limit results
    limit: 5000                // Optional: limit database records to process
  }
};

const response = await axios.post('http://localhost:3031/aiNameSearchMSSQL', searchRequest);
const results = response.data.data.results;

// Process results
results.forEach((result, index) => {
  console.log(\`\${index + 1}. \${result.fullName} (\${(result.similarity * 100).toFixed(1)}% similarity)\`);
});

// Example: Test database connection
const connectionResponse = await axios.post('http://localhost:3031/aiSearchTestConnectionMSSQL');
console.log('Database connected:', connectionResponse.data.data.connected);

// Example: Get database statistics
const statsResponse = await axios.get('http://localhost:3031/aiSearchStatsMSSQL');
console.log('Total records in database:', statsResponse.data.data.databaseStats.total_records);
`;

  console.log(exampleCode);
}

// Run examples if this file is executed directly
if (require.main === module) {
  testMSSQLEndpoints()
    .then(() => exampleUsage())
    .catch(console.error);
}

module.exports = { testMSSQLEndpoints, exampleUsage };

