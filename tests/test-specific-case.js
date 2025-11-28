const axios = require('axios');

const SERVER_URL = 'http://localhost:3031';

async function testSpecificCase() {
    console.log('🧪 Testing Specific Case from Terminal Logs...\n');
    
    try {
        // Test the exact case that was failing in the terminal logs
        console.log('1. Testing the specific JSON string case...');
        const specificCaseRequest = {
            inputObject: `{
"PracticeTypeTitle": "Εξωτερική ακτινοθεραπεία με ακτίνες Χ",
"PracticeTypeNumber": 1,
"PracticeNumber": 1,
"PracticeCode": "Γ1",
"PracticeID": 20,
"UniqueID": 19318
}`,
            inputElement: "PracticeTypeTitle",
            arrayOfObjects: [
                {"PracticeTypeID": 20, "PracticeTypeTitle": "Εξωτερική ακτινοθεραπεία με ακτίνες Χ"},
                {"PracticeTypeID": 21, "PracticeTypeTitle": "Διαγνωστική ακτινοσκόπηση"},
                {"PracticeTypeID": 22, "PracticeTypeTitle": "Ακτινοθεραπεία καθοδηγούμενη απεικονιστικά (IGRT)"}
            ],
            elementToCheck: "PracticeTypeTitle"
        };
        
        const response = await axios.post(`${SERVER_URL}/compare`, specificCaseRequest);
        const result = response.data;
        
        console.log(`✅ Successfully parsed the specific case!`);
        console.log(`📝 Input Object:`, result.inputObject);
        console.log(`📝 Input String: "${result.inputString}"`);
        console.log(`📊 Found ${result.resultsReturned} matches out of ${result.totalCompared} practices\n`);
        
        console.log('Results:');
        result.results.forEach((match, index) => {
            console.log(`${index + 1}. Score: ${match.score} - "${match.targetString}"`);
        });
        
        // Test 2: The problematic case with JavaScript code
        console.log('\n2. Testing JavaScript code string (should fail)...');
        try {
            await axios.post(`${SERVER_URL}/compare`, {
                inputObject: `var obj = {
'PracticeTypeTitle': 'Εξωτερική ακτινοθεραπεία με ακτίνες Χ',
'PracticeTypeNumber': 1,
'PracticeNumber': 1,
'PracticeCode': 'Γ1',
'PracticeID': 20,
'UniqueID': 19318,
}
return obj;`,
                inputElement: "PracticeTypeTitle",
                arrayOfObjects: [{ id: 1, text: "Hello" }],
                elementToCheck: "text"
            });
        } catch (error) {
            console.log('✅ JavaScript code string properly rejected');
            console.log('   Error:', error.response.data.error);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

testSpecificCase();

