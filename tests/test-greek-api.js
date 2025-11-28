/**
 * Test file for the Greek Name Correction API endpoint
 * Demonstrates how to use the /correctGreekName endpoint
 */

const axios = require("axios");

const API_BASE_URL = "http://localhost:3031";

// Test cases for the Greek Name Correction API
const testCases = [
  {
    name: "Basic Greek name correction",
    request: {
      name: "Γιάννης"
    }
  },
  {
    name: "Latin transliteration",
    request: {
      name: "Giannis"
    }
  },
  {
    name: "Case transformation to genitive",
    request: {
      name: "Γιάννης",
      options: {
        targetCase: "genitive"
      }
    }
  },
  {
    name: "Case transformation to vocative",
    request: {
      name: "Γιάννης",
      options: {
        targetCase: "vocative"
      }
    }
  },
  {
    name: "Latin to Greek with case transformation",
    request: {
      name: "Maria",
      options: {
        targetCase: "genitive"
      }
    }
  },
  {
    name: "Error correction enabled",
    request: {
      name: "Γιάννι", // Missing final sigma
      options: {
        fixCommonErrors: true
      }
    }
  },
  {
    name: "Feminine name with case transformation",
    request: {
      name: "Ελένη",
      options: {
        targetCase: "genitive"
      }
    }
  }
];

// Function to test the API endpoint
async function testGreekNameAPI() {
  console.log("🇬🇷 Testing Greek Name Correction API");
  console.log("=====================================\n");

  for (const testCase of testCases) {
    try {
      console.log(`📝 Test: ${testCase.name}`);
      console.log(`Request: ${JSON.stringify(testCase.request, null, 2)}`);

      const response = await axios.post(
        `${API_BASE_URL}/correctGreekName`,
        testCase.request
      );

      console.log(`✅ Success Response:`);
      console.log(`  Original: ${response.data.data.original}`);
      console.log(`  Corrected: ${response.data.data.corrected}`);
      console.log(`  Greek Script: ${response.data.data.greekScript}`);
      console.log(`  Gender: ${response.data.data.gender}`);
      console.log(`  Case: ${response.data.data.currentCase}`);
      console.log(
        `  Confidence: ${(response.data.data.confidence * 100).toFixed(1)}%`
      );
      console.log(`  Is Greek Script: ${response.data.data.isGreekScript}`);
      console.log("");
    } catch (error) {
      console.log(`❌ Error in test "${testCase.name}":`);
      if (error.response) {
        console.log(`  Status: ${error.response.status}`);
        console.log(`  Error: ${JSON.stringify(error.response.data, null, 2)}`);
      } else {
        console.log(`  Error: ${error.message}`);
      }
      console.log("");
    }
  }
}

// Function to test error handling
async function testErrorHandling() {
  console.log("🚨 Testing Error Handling");
  console.log("========================\n");

  const errorTestCases = [
    { name: "null name", request: { name: null } },
    { name: "empty string", request: { name: "" } },
    { name: "number instead of string", request: { name: 123 } },
    { name: "object instead of string", request: { name: {} } },
    { name: "missing name field", request: {} }
  ];

  for (const testCase of errorTestCases) {
    try {
      console.log(`📝 Error Test: ${testCase.name}`);
      console.log(`Request: ${JSON.stringify(testCase.request)}`);

      const response = await axios.post(
        `${API_BASE_URL}/correctGreekName`,
        testCase.request
      );
      console.log(`⚠️  Unexpected success: ${JSON.stringify(response.data)}`);
    } catch (error) {
      if (error.response) {
        console.log(`✅ Expected error handled correctly:`);
        console.log(`  Status: ${error.response.status}`);
        console.log(`  Error: ${error.response.data.error}`);
      } else {
        console.log(`❌ Network error: ${error.message}`);
      }
      console.log("");
    }
  }
}

// Function to test server health
async function testServerHealth() {
  try {
    console.log("🏥 Testing Server Health");
    console.log("========================\n");

    const response = await axios.get(`${API_BASE_URL}/health`);
    console.log("✅ Server is healthy:");
    console.log(`  Status: ${response.data.status}`);
    console.log(`  Message: ${response.data.message}`);
    console.log(`  Port: ${response.data.port}\n`);
  } catch (error) {
    console.log("❌ Server health check failed:");
    console.log(`  Error: ${error.message}\n`);
  }
}

// Function to get API documentation
async function getAPIDocumentation() {
  try {
    console.log("📚 API Documentation");
    console.log("===================\n");

    const response = await axios.get(`${API_BASE_URL}/`);
    console.log("Available endpoints:");
    Object.entries(response.data.endpoints).forEach(
      ([endpoint, description]) => {
        console.log(`  ${endpoint}: ${description}`);
      }
    );
    console.log("\nUsage examples:");
    console.log(JSON.stringify(response.data.usage.correctGreekName, null, 2));
    console.log("");
  } catch (error) {
    console.log("❌ Failed to get API documentation:");
    console.log(`  Error: ${error.message}\n`);
  }
}

// Main test function
async function runAllTests() {
  try {
    await testServerHealth();
    await getAPIDocumentation();
    await testGreekNameAPI();
    await testErrorHandling();

    console.log("🎉 All tests completed!");
    console.log("\n💡 Usage Examples:");
    console.log("  Basic correction:");
    console.log("    POST /correctGreekName");
    console.log('    Body: { "name": "Γιάννης" }');
    console.log("");
    console.log("  With options:");
    console.log("    POST /correctGreekName");
    console.log(
      '    Body: { "name": "Giannis", "options": { "targetCase": "genitive" } }'
    );
  } catch (error) {
    console.error("❌ Test suite failed:", error.message);
  }
}

// Run the tests
if (require.main === module) {
  runAllTests();
}

module.exports = {
  testGreekNameAPI,
  testErrorHandling,
  testServerHealth,
  getAPIDocumentation,
  runAllTests
};

