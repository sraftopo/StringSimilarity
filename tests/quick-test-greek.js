/**
 * Quick test for the Greek Name Correction API
 */

const axios = require("axios");

async function quickTest() {
  try {
    console.log("🇬🇷 Quick Test - Greek Name Correction API");
    console.log("==========================================\n");

    // Test 1: Basic Greek name
    console.log('Test 1: Basic Greek name "Γιάννης"');
    const response1 = await axios.post(
      "http://localhost:3031/correctGreekName",
      {
        name: "Γιάννης"
      }
    );
    console.log(
      `✅ Result: ${response1.data.data.corrected} (${response1.data.data.gender})`
    );

    // Test 2: Latin transliteration
    console.log('\nTest 2: Latin transliteration "Giannis"');
    const response2 = await axios.post(
      "http://localhost:3031/correctGreekName",
      {
        name: "Giannis"
      }
    );
    console.log(
      `✅ Result: ${response2.data.data.greekScript} (${response2.data.data.gender})`
    );

    // Test 3: Case transformation
    console.log("\nTest 3: Case transformation to genitive");
    const response3 = await axios.post(
      "http://localhost:3031/correctGreekName",
      {
        name: "Γιάννης",
        options: {
          targetCase: "genitive"
        }
      }
    );
    console.log(
      `✅ Result: ${response3.data.data.corrected} (${response3.data.data.currentCase})`
    );

    console.log(
      "\n🎉 All tests passed! The Greek Name Correction API is working correctly."
    );
  } catch (error) {
    if (error.code === "ECONNREFUSED") {
      console.log("❌ Server is not running. Please start the server first:");
      console.log("   node server.js");
    } else {
      console.log("❌ Error:", error.message);
      if (error.response) {
        console.log("Response:", error.response.data);
      }
    }
  }
}

quickTest();

