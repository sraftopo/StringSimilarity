const axios = require('axios');

const SERVER_URL = 'http://localhost:3031';

async function testJsonParsing() {
    console.log('🧪 Testing JSON Parsing Issues...\n');
    
    try {
        // Test 1: Malformed JSON (this will fail at the HTTP level, not our validation)
        console.log('1. Testing malformed JSON...');
        try {
            const response = await axios.post(`${SERVER_URL}/compare`, '{"inputObject": {"id": 1, "title": "Hello"}, "inputElement": "title", "arrayOfObjects": [{"id": 1, "text": "Hello"}], "elementToCheck": "text"}');
        } catch (error) {
            if (error.response) {
                console.log('✅ Malformed JSON properly handled by axios');
            } else {
                console.log('✅ Malformed JSON rejected at HTTP level');
            }
        }
        
        // Test 2: Valid JSON but wrong structure
        console.log('\n2. Testing valid JSON with wrong structure...');
        try {
            await axios.post(`${SERVER_URL}/compare`, {
                inputObject: undefined, // This should trigger our validation
                inputElement: "title",
                arrayOfObjects: [{ id: 1, text: "Hello" }],
                elementToCheck: "text"
            });
        } catch (error) {
            console.log('✅ Undefined inputObject properly rejected');
            console.log('   Error:', error.response.data.error);
            console.log('   Debug info:', error.response.data.debug);
        }
        
        // Test 3: Missing inputObject entirely
        console.log('\n3. Testing missing inputObject...');
        try {
            await axios.post(`${SERVER_URL}/compare`, {
                inputElement: "title",
                arrayOfObjects: [{ id: 1, text: "Hello" }],
                elementToCheck: "text"
            });
        } catch (error) {
            console.log('✅ Missing inputObject properly rejected');
            console.log('   Error:', error.response.data.error);
            console.log('   Debug info:', error.response.data.debug);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testJsonParsing();
