const axios = require('axios');

const SERVER_URL = 'http://localhost:3031';

async function testLogging() {
    console.log('🧪 Testing Server Logging...\n');
    
    try {
        // Test 1: Valid request
        console.log('1. Testing valid request...');
        const validRequest = {
            inputString: "Hello world",
            arrayOfObjects: [
                { id: 1, text: "Hello world" },
                { id: 2, text: "Hi there" }
            ],
            elementToCheck: "text"
        };
        
        await axios.post(`${SERVER_URL}/compare`, validRequest);
        console.log('✅ Valid request completed\n');
        
        // Test 2: Invalid request - missing inputString
        console.log('2. Testing invalid request (missing inputString)...');
        try {
            await axios.post(`${SERVER_URL}/compare`, {
                arrayOfObjects: [{ id: 1, text: "Hello" }],
                elementToCheck: "text"
            });
        } catch (error) {
            console.log('✅ Invalid request properly rejected\n');
        }
        
        // Test 3: Invalid request - wrong elementToCheck
        console.log('3. Testing invalid request (wrong elementToCheck)...');
        try {
            await axios.post(`${SERVER_URL}/compare`, {
                inputString: "Hello world",
                arrayOfObjects: [{ id: 1, text: "Hello world" }],
                elementToCheck: "nonexistent"
            });
        } catch (error) {
            console.log('✅ Invalid elementToCheck properly rejected\n');
        }
        
        // Test 4: Health check
        console.log('4. Testing health check...');
        const healthResponse = await axios.get(`${SERVER_URL}/health`);
        console.log('✅ Health check:', healthResponse.data.status);
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testLogging();
