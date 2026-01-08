const axios = require('axios');

const SERVER_URL = 'http://localhost:3031';

// Test data
const testData = {
    inputString: "Hello world, this is a test",
    arrayOfObjects: [
        { id: 1, text: "Hello world, this is a test", category: "exact" },
        { id: 2, text: "Hello world, this is a sample", category: "similar" },
        { id: 3, text: "Hi there, this is a test", category: "partial" },
        { id: 4, text: "Goodbye world, this is different", category: "different" },
        { id: 5, text: "Hello world", category: "subset" },
        { id: 6, text: "Completely different text here", category: "unrelated" }
    ],
    elementToCheck: "text"
};

async function testServer() {
    try {
        console.log('🧪 Testing String Similarity Server...\n');
        
        // Test health endpoint
        console.log('1. Testing health endpoint...');
        const healthResponse = await axios.get(`${SERVER_URL}/health`);
        console.log('✅ Health check:', healthResponse.data);
        console.log('');
        
        // Test comparison endpoint
        console.log('2. Testing string comparison...');
        console.log('Input string:', testData.inputString);
        console.log('Array of objects:', testData.arrayOfObjects.length, 'items');
        console.log('Element to check:', testData.elementToCheck);
        console.log('');
        
        const comparisonResponse = await axios.post(`${SERVER_URL}/compare`, testData);
        const result = comparisonResponse.data;
        
        console.log('📊 Results:');
        console.log(`- Input String: ${result.inputString}`);
        console.log(`- Total Compared: ${result.totalCompared}`);
        console.log(`- Results Returned: ${result.resultsReturned}`);
        console.log('');
        
        console.log('🎯 Top Match:');
        if (result.topMatch) {
            console.log(`- Index: ${result.topMatch.index}`);
            console.log(`- Score: ${result.topMatch.score}`);
            console.log(`- Target String: "${result.topMatch.targetString}"`);
            console.log(`- Category: ${result.topMatch.originalObject.category}`);
        }
        console.log('');
        
        console.log('📋 All Results (sorted by similarity):');
        result.results.forEach((match, index) => {
            console.log(`${index + 1}. Score: ${match.score} | "${match.targetString}" | Category: ${match.originalObject.category}`);
        });
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

// Run the test
testServer();

