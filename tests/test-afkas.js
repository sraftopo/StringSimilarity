const axios = require('axios');

const BASE_URL = 'http://localhost:3031';

// Test cases based on the provided examples
const testCases = [
    {
        filename: "40220-40221_diavalkaniko_ΝομΕκπρ_trop.pdf",
        expected: [40220, 40221]
    },
    {
        filename: "40100_ΓΝΑ ΑΛΕΞΑΝΔΡΑ_Βραχυθεραπεία άδεια_τροπ.pdf",
        expected: [40100]
    },
    {
        filename: "40220-40221-40222_ΔΙΑΒΑΛΚΑΝΙΚΟ_Ακτινοθεραπεία_Βραχυθεραπεία άδεια_τροπ.pdf",
        expected: [40220, 40221, 40222]
    },
    {
        filename: "40490_ΓΣΝΕ 424_Ακτινοθεραπεία άδεια_τροπ.pdf",
        expected: [40490]
    },
    {
        filename: "ΓΝΑ ΓΕΝΝΗΜΑΤΑΣ_40312 Ru106.pdf",
        expected: [40312]
    },
    {
        filename: "ΓΝΘ ΠΑΠΑΓΕΩΡΓΙΟΥ_40140_40142 trop άδειας.pdf",
        expected: [40140, 40142]
    },
    {
        filename: "ΙΑΣΩ_40180 Βραχυθεραπεία άδεια.pdf",
        expected: [40180]
    },
    {
        filename: "ΚΟΡΓΙΑΛΕΝΕΙΟ ΜΠΕΝΑΚΕΙΟ_40570 Ru106 άδεια.pdf",
        expected: [40570]
    }
];

// Test cases with ignoreStrings
const testCasesWithIgnore = [
    {
        filename: "40220-40221_diavalkaniko_ΝομΕκπρ_trop.pdf",
        ignoreStrings: ["40220"],
        expected: [40221]
    },
    {
        filename: "40490_ΓΣΝΕ 424_Ακτινοθεραπεία άδεια_τροπ.pdf",
        ignoreStrings: ["424"],
        expected: [40490]
    },
    {
        filename: "40220-40221-40222_ΔΙΑΒΑΛΚΑΝΙΚΟ_Ακτινοθεραπεία_Βραχυθεραπεία άδεια_τροπ.pdf",
        ignoreStrings: ["40220", "40221"],
        expected: [40222]
    },
    {
        filename: "ΓΝΘ ΠΑΠΑΓΕΩΡΓΙΟΥ_40140_40142 trop άδειας.pdf",
        ignoreStrings: ["40140"],
        expected: [40142]
    },
    {
        filename: "test_12345_67890_12345.pdf",
        ignoreStrings: ["12345"],
        expected: [67890]
    }
];

async function testFindAfaks() {
    console.log('🧪 Testing findAfaks endpoint...\n');
    
    // Test basic functionality
    console.log('📋 Basic Tests (without ignoreStrings):');
    for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        console.log(`Test ${i + 1}: ${testCase.filename}`);
        
        try {
            const response = await axios.post(`${BASE_URL}/findAfaks`, {
                filename: testCase.filename
            });
            
            const result = response.data;
            const actual = result.afkasNumbers;
            const expected = testCase.expected;
            
            console.log(`  Expected: [${expected.join(', ')}]`);
            console.log(`  Actual:   [${actual.join(', ')}]`);
            
            // Check if arrays are equal
            const isEqual = JSON.stringify(actual.sort()) === JSON.stringify(expected.sort());
            console.log(`  Result: ${isEqual ? '✅ PASS' : '❌ FAIL'}`);
            
            if (!isEqual) {
                console.log(`  ❌ Mismatch detected!`);
            }
            
        } catch (error) {
            console.log(`  ❌ ERROR: ${error.message}`);
            if (error.response) {
                console.log(`  Response: ${JSON.stringify(error.response.data, null, 2)}`);
            }
        }
        
        console.log('');
    }
    
    // Test ignoreStrings functionality
    console.log('🚫 Tests with ignoreStrings:');
    for (let i = 0; i < testCasesWithIgnore.length; i++) {
        const testCase = testCasesWithIgnore[i];
        console.log(`Ignore Test ${i + 1}: ${testCase.filename}`);
        console.log(`  Ignoring: [${testCase.ignoreStrings.join(', ')}]`);
        
        try {
            const response = await axios.post(`${BASE_URL}/findAfaks`, {
                filename: testCase.filename,
                ignoreStrings: testCase.ignoreStrings
            });
            
            const result = response.data;
            const actual = result.afkasNumbers;
            const expected = testCase.expected;
            
            console.log(`  Expected: [${expected.join(', ')}]`);
            console.log(`  Actual:   [${actual.join(', ')}]`);
            
            // Check if arrays are equal
            const isEqual = JSON.stringify(actual.sort()) === JSON.stringify(expected.sort());
            console.log(`  Result: ${isEqual ? '✅ PASS' : '❌ FAIL'}`);
            
            if (!isEqual) {
                console.log(`  ❌ Mismatch detected!`);
            }
            
        } catch (error) {
            console.log(`  ❌ ERROR: ${error.message}`);
            if (error.response) {
                console.log(`  Response: ${JSON.stringify(error.response.data, null, 2)}`);
            }
        }
        
        console.log('');
    }
}

// Run the test
testFindAfaks().catch(console.error);

