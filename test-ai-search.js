/**
 * Test script for AI Name Database Checker
 * Demonstrates the library functionality with various test scenarios
 */

const AINameDBSearcher = require("./ai_name_db_checker.js");

async function runTests() {
  console.log("🧪 AI Name Database Checker - Test Suite");
  console.log("========================================\n");

  // Initialize searcher with test configuration
  const searcher = new AINameDBSearcher({
    batchSize: 100, // Small batch for testing
    similarityThreshold: 0.6, // Lower threshold for testing
    maxResults: 10, // Limit results for testing
    useGPU: false // Use CPU for compatibility
  });

  // Test dataset with various Greek names
  const testData = [
    // Exact matches
    { Firstname: "Γιάννης", Lastname: "Παπαδόπουλος" },
    { Firstname: "Μαρία", Lastname: "Κωνσταντίνου" },
    { Firstname: "Νίκος", Lastname: "Αντωνίου" },

    // Similar names
    { Firstname: "Ιωάννης", Lastname: "Παπαδόπουλος" },
    { Firstname: "Γιάννη", Lastname: "Παπαδόπουλος" },
    { Firstname: "Μαρία", Lastname: "Κωνσταντίνου" },

    // Different genders
    { Firstname: "Ελένη", Lastname: "Δημητρίου" },
    { Firstname: "Κώστας", Lastname: "Γεωργίου" },
    { Firstname: "Σοφία", Lastname: "Μιχαήλ" },
    { Firstname: "Δημήτρης", Lastname: "Αλεξάνδρου" },
    { Firstname: "Αναστασία", Lastname: "Βασιλείου" },
    { Firstname: "Γεώργιος", Lastname: "Νικολάου" },
    { Firstname: "Κατερίνα", Lastname: "Παύλου" },
    { Firstname: "Ευαγγελία", Lastname: "Κωνσταντίνου" },
    { Firstname: "Μιχάλης", Lastname: "Αντωνίου" },
    { Firstname: "Αλέξανδρος", Lastname: "Δημητρίου" },
    { Firstname: "Βασίλης", Lastname: "Γεωργίου" },
    { Firstname: "Χριστίνα", Lastname: "Παπαγιάννη" },
    { Firstname: "Παναγιώτης", Lastname: "Δημητρίου" },
    { Firstname: "Αγγελική", Lastname: "Αλεξάνδρου" },
    { Firstname: "Σπύρος", Lastname: "Βασιλείου" }
  ];

  const tests = [
    {
      name: "Test 1: Exact Name Search",
      test: async () => {
        const results = await searcher.searchNames(
          "Γιάννης",
          "Παπαδόπουλος",
          testData
        );
        console.log(`✅ Found ${results.results.length} matches`);
        return results.results.length > 0;
      }
    },
    {
      name: "Test 2: Latin Transliteration",
      test: async () => {
        const results = await searcher.searchNames(
          "Giannis",
          "Papadopoulos",
          testData
        );
        console.log(
          `✅ Found ${results.results.length} matches for Latin input`
        );
        return results.results.length > 0;
      }
    },
    {
      name: "Test 3: Partial Name Search",
      test: async () => {
        const results = await searcher.searchPartialName("Μαρ", testData);
        console.log(`✅ Found ${results.results.length} partial matches`);
        return results.results.length > 0;
      }
    },
    {
      name: "Test 4: Gender Filtering",
      test: async () => {
        const results = await searcher.searchNames("", "", testData, {
          gender: "feminine"
        });
        console.log(`✅ Found ${results.results.length} female names`);
        return results.results.length > 0;
      }
    },
    {
      name: "Test 5: Low Similarity Threshold",
      test: async () => {
        const results = await searcher.searchNames("Γιάννης", "", testData, {
          similarityThreshold: 0.3
        });
        console.log(`✅ Found ${results.results.length} broad matches`);
        return results.results.length > 0;
      }
    },
    {
      name: "Test 6: Empty Search Handling",
      test: async () => {
        try {
          await searcher.searchNames("", "", testData);
          console.log("❌ Should have thrown error for empty search");
          return false;
        } catch (error) {
          console.log("✅ Correctly handled empty search");
          return true;
        }
      }
    },
    {
      name: "Test 7: Invalid Data Handling",
      test: async () => {
        try {
          await searcher.searchNames("Γιάννης", "Παπαδόπουλος", []);
          console.log("❌ Should have thrown error for empty dataset");
          return false;
        } catch (error) {
          console.log("✅ Correctly handled empty dataset");
          return true;
        }
      }
    }
  ];

  let passedTests = 0;
  let totalTests = tests.length;

  console.log("Running test suite...\n");

  for (const test of tests) {
    try {
      console.log(`\n${test.name}`);
      console.log("-".repeat(test.name.length));

      const startTime = Date.now();
      const passed = await test.test();
      const endTime = Date.now();

      if (passed) {
        passedTests++;
        console.log(`✅ PASSED (${endTime - startTime}ms)`);
      } else {
        console.log(`❌ FAILED (${endTime - startTime}ms)`);
      }
    } catch (error) {
      console.log(`❌ ERROR: ${error.message}`);
    }
  }

  // Performance test
  console.log("\n\nPerformance Test");
  console.log("================");

  try {
    const largeDataset = generateLargeDataset(5000);
    console.log(`Generated ${largeDataset.length} test records`);

    const startTime = Date.now();
    const results = await searcher.searchNames(
      "Γιάννης",
      "Παπαδόπουλος",
      largeDataset
    );
    const endTime = Date.now();

    console.log(
      `✅ Processed ${largeDataset.length} records in ${endTime - startTime}ms`
    );
    console.log(`✅ Found ${results.results.length} matches`);
    console.log(
      `✅ Performance: ${Math.round(
        largeDataset.length / ((endTime - startTime) / 1000)
      )} records/second`
    );
  } catch (error) {
    console.log(`❌ Performance test failed: ${error.message}`);
  }

  // Memory usage test
  console.log("\n\nMemory Usage Test");
  console.log("=================");

  const stats = searcher.getSearchStats();
  console.log(
    `✅ Memory usage: ${Math.round(stats.memoryUsage.heapUsed / 1024 / 1024)}MB`
  );
  console.log(`✅ Cache size: ${stats.embeddingsCacheSize} entries`);
  console.log(`✅ Initialized: ${stats.isInitialized}`);

  // Test results summary
  console.log("\n\nTest Results Summary");
  console.log("====================");
  console.log(`✅ Passed: ${passedTests}/${totalTests} tests`);
  console.log(
    `📊 Success rate: ${Math.round((passedTests / totalTests) * 100)}%`
  );

  if (passedTests === totalTests) {
    console.log("🎉 All tests passed!");
  } else {
    console.log(`⚠️  ${totalTests - passedTests} tests failed`);
  }

  // Cleanup
  searcher.dispose();
  console.log("\n🧹 Cleanup completed");
}

// Helper function to generate large dataset
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
    "Σπύρος",
    "Ευαγγελία",
    "Κωνσταντίνος",
    "Αντώνης",
    "Δημήτριος",
    "Γεώργιος",
    "Μιχαήλ"
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
    "Αλεξάνδρου",
    "Βασιλείου",
    "Νικολάου",
    "Παύλου",
    "Κωνσταντίνου",
    "Παπαγιάννη"
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

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests };
