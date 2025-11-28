const axios = require('axios');

const SERVER_URL = 'http://localhost:3031';

async function testDebugLogging() {
    console.log('🧪 Testing Debug Logging for Object Parsing...\n');
    
    try {
        // Test 1: Valid request (should work)
        console.log('1. Testing valid request...');
        const validRequest = {
            inputObject: {
                id: 1,
                title: "Hello world",
                category: "Test"
            },
            inputElement: "title",
            arrayOfObjects: [
                { id: 1, text: "Hello world" },
                { id: 2, text: "Hi there" }
            ],
            elementToCheck: "text"
        };
        
        await axios.post(`${SERVER_URL}/compare`, validRequest);
        console.log('✅ Valid request completed\n');
        
        // Test 2: Invalid request - inputObject is array instead of object
        console.log('2. Testing invalid request (inputObject is array)...');
        try {
            await axios.post(`${SERVER_URL}/compare`, {
                inputObject: ["item1", "item2"], // This is an array, not an object
                inputElement: "0",
                arrayOfObjects: [{ id: 1, text: "Hello" }],
                elementToCheck: "text"
            });
        } catch (error) {
            console.log('✅ Array inputObject properly rejected');
            console.log('   Error:', error.response.data.error);
            console.log('   Debug info:', error.response.data.debug);
        }
        
        // Test 3: Invalid request - inputObject is null
        console.log('\n3. Testing invalid request (inputObject is null)...');
        try {
            await axios.post(`${SERVER_URL}/compare`, {
                inputObject: null,
                inputElement: "title",
                arrayOfObjects: [{ id: 1, text: "Hello" }],
                elementToCheck: "text"
            });
        } catch (error) {
            console.log('✅ Null inputObject properly rejected');
            console.log('   Error:', error.response.data.error);
            console.log('   Debug info:', error.response.data.debug);
        }
        
        // Test 4: Invalid request - inputObject is string
        console.log('\n4. Testing invalid request (inputObject is string)...');
        try {
            await axios.post(`${SERVER_URL}/compare`, {
                inputObject: "This is a string, not an object",
                inputElement: "title",
                arrayOfObjects: [{ id: 1, text: "Hello" }],
                elementToCheck: "text"
            });
        } catch (error) {
            console.log('✅ String inputObject properly rejected');
            console.log('   Error:', error.response.data.error);
            console.log('   Debug info:', error.response.data.debug);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

testDebugLogging();

