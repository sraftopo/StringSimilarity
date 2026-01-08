const axios = require('axios');

const SERVER_URL = 'http://localhost:3031';

async function testJsonParsingFeature() {
    console.log('🧪 Testing JSON String Parsing Feature...\n');
    
    try {
        // Test 1: Valid JSON string as inputObject
        console.log('1. Testing valid JSON string as inputObject...');
        const jsonStringRequest = {
            inputObject: JSON.stringify({
                id: 1,
                title: "Ακτινοθεραπεία καθοδηγούμενη απεικονιστικά (IGRT)",
                category: "Radiotherapy",
                description: "Image-guided radiation therapy"
            }),
            inputElement: "title",
            arrayOfObjects: [
                {"PracticeTypeID": 20, "PracticeTypeTitle": "Εξωτερική ακτινοθεραπεία με ακτίνες Χ"},
                {"PracticeTypeID": 21, "PracticeTypeTitle": "Διαγνωστική ακτινοσκόπηση"},
                {"PracticeTypeID": 22, "PracticeTypeTitle": "Ακτινοθεραπεία καθοδηγούμενη απεικονιστικά (IGRT)"}
            ],
            elementToCheck: "PracticeTypeTitle"
        };
        
        const response1 = await axios.post(`${SERVER_URL}/compare`, jsonStringRequest);
        const result1 = response1.data;
        
        console.log(`✅ Successfully parsed JSON string!`);
        console.log(`📝 Input Object:`, result1.inputObject);
        console.log(`📝 Input String: "${result1.inputString}"`);
        console.log(`📊 Found ${result1.resultsReturned} matches out of ${result1.totalCompared} practices\n`);
        
        console.log('Top matches:');
        result1.results.slice(0, 2).forEach((match, index) => {
            console.log(`${index + 1}. Score: ${match.score} - "${match.targetString}"`);
        });
        
        // Test 2: Invalid JSON string
        console.log('\n2. Testing invalid JSON string...');
        try {
            await axios.post(`${SERVER_URL}/compare`, {
                inputObject: '{"id": 1, "title": "Hello", "category": "Test",}', // Invalid JSON (trailing comma)
                inputElement: "title",
                arrayOfObjects: [{ id: 1, text: "Hello" }],
                elementToCheck: "text"
            });
        } catch (error) {
            console.log('✅ Invalid JSON string properly rejected');
            console.log('   Error:', error.response.data.error);
            console.log('   Parse Error:', error.response.data.debug.parseError);
        }
        
        // Test 3: Regular object (should still work)
        console.log('\n3. Testing regular object (backward compatibility)...');
        const regularObjectRequest = {
            inputObject: {
                id: 2,
                name: "iPhone 15 Pro Max",
                description: "Latest iPhone with advanced camera system"
            },
            inputElement: "description",
            arrayOfObjects: [
                { id: 1, name: "iPhone 15 Pro Max 256GB", description: "Latest iPhone with advanced camera system" },
                { id: 2, name: "iPhone 15 Pro 128GB", description: "Pro iPhone with titanium design" }
            ],
            elementToCheck: "description"
        };
        
        const response3 = await axios.post(`${SERVER_URL}/compare`, regularObjectRequest);
        const result3 = response3.data;
        
        console.log(`✅ Regular object still works!`);
        console.log(`📝 Input Object:`, result3.inputObject);
        console.log(`📊 Found ${result3.resultsReturned} matches\n`);
        
        // Test 4: Non-JSON string
        console.log('\n4. Testing non-JSON string...');
        try {
            await axios.post(`${SERVER_URL}/compare`, {
                inputObject: 'This is just a regular string, not JSON',
                inputElement: "title",
                arrayOfObjects: [{ id: 1, text: "Hello" }],
                elementToCheck: "text"
            });
        } catch (error) {
            console.log('✅ Non-JSON string properly rejected');
            console.log('   Error:', error.response.data.error);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

testJsonParsingFeature();

