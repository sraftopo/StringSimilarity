const axios = require('axios');

const SERVER_URL = 'http://localhost:3031';

async function testNestedObjects() {
    console.log('🧪 Testing Nested Object Access with Dot Notation...\n');
    
    try {
        // Test 1: Nested object with dot notation
        console.log('1. Testing nested object access...');
        const nestedRequest = {
            inputObject: {
                practicetypes: {
                    practicetype_title: 'Εξωτερική ακτινοθεραπεία με ακτίνες Χ',
                    practicetype_number: 1
                },
                practice_number: 1,
                practice_code: 'Γ1',
                practice_id: 20,
                uniqueId: '19318',
                r: [
                    {
                        PracticeTypeTitle: 'Μαστογραφίες τομοσύνθεσης και στερεοτακτικής βιοψίας εντός τμημάτων ιατρικής απεικόνισης, νοσοκομείου ή ιδιωτικής κλινικής/διαγνωστικού κέντρου',
                        PracticeID: 20,
                        PracticeTypeID: 20,
                        ApplicationCategoryID: 3
                    },
                    {
                        PracticeTypeTitle: 'Διαγνωστική και επεμβατική ακτινοσκόπηση εντός τμήματος ιατρικής απεικόνισης νοσοκομείου ή ιδιωτικής κλινικής',
                        PracticeID: 20,
                        PracticeTypeID: 21,
                        ApplicationCategoryID: 3
                    },
                    {
                        PracticeTypeTitle: 'Εξωτερική ακτινοθεραπεία με (α) ακτίνες Χ (β) δέσμες ηλεκτρονίων',
                        PracticeID: 20,
                        PracticeTypeID: 27,
                        ApplicationCategoryID: 3
                    },
                    {
                        PracticeTypeTitle: '(α) Εξωτερική ακτινοθεραπεία διαμορφούμενης έντασης ακτινοβόλησης (IMRT), (β) ακτινοθεραπεία καθοδηγούμενη απεικονιστικά (IGRT), (γ) ογκομετρική ακτινοθεραπεία διαμορφούμενης έντασης (VMAT), (δ) στερεοτακτική– ακτινοχειρουργική (SRS , SBRT) με δέσμες ακτίνων Χ',
                        PracticeID: 20,
                        PracticeTypeID: 28,
                        ApplicationCategoryID: 3
                    }
                ]
            },
            inputElement: 'practicetypes.practicetype_title',
            arrayOfObjects: [
                {
                    PracticeTypeTitle: 'Εξωτερική ακτινοθεραπεία με ακτίνες Χ',
                    PracticeID: 20,
                    PracticeTypeID: 27,
                    ApplicationCategoryID: 3
                },
                {
                    PracticeTypeTitle: 'Διαγνωστική και επεμβατική ακτινοσκόπηση εντός τμήματος ιατρικής απεικόνισης νοσοκομείου ή ιδιωτικής κλινικής',
                    PracticeID: 20,
                    PracticeTypeID: 21,
                    ApplicationCategoryID: 3
                },
                {
                    PracticeTypeTitle: 'Ακτινοθεραπεία καθοδηγούμενη απεικονιστικά (IGRT)',
                    PracticeID: 20,
                    PracticeTypeID: 28,
                    ApplicationCategoryID: 3
                }
            ],
            elementToCheck: 'PracticeTypeTitle'
        };
        
        const response1 = await axios.post(`${SERVER_URL}/compare`, nestedRequest);
        const result1 = response1.data;
        
        console.log(`✅ Successfully accessed nested property!`);
        console.log(`📝 Input Object:`, result1.inputObject);
        console.log(`📝 Input String: "${result1.inputString}"`);
        console.log(`📊 Found ${result1.resultsReturned} matches out of ${result1.totalCompared} practices\n`);
        
        console.log('Top matches:');
        result1.results.slice(0, 3).forEach((match, index) => {
            console.log(`${index + 1}. Score: ${match.score} - "${match.targetString.substring(0, 60)}..."`);
        });
        
        // Test 2: Deeply nested object
        console.log('\n2. Testing deeply nested object...');
        const deepNestedRequest = {
            inputObject: {
                data: {
                    medical: {
                        practice: {
                            title: 'Ακτινοθεραπεία καθοδηγούμενη απεικονιστικά (IGRT)',
                            type: 'Radiotherapy'
                        }
                    }
                }
            },
            inputElement: 'data.medical.practice.title',
            arrayOfObjects: [
                { id: 1, text: 'Ακτινοθεραπεία καθοδηγούμενη απεικονιστικά (IGRT)' },
                { id: 2, text: 'Εξωτερική ακτινοθεραπεία με ακτίνες Χ' }
            ],
            elementToCheck: 'text'
        };
        
        const response2 = await axios.post(`${SERVER_URL}/compare`, deepNestedRequest);
        const result2 = response2.data;
        
        console.log(`✅ Successfully accessed deeply nested property!`);
        console.log(`📝 Input String: "${result2.inputString}"`);
        console.log(`📊 Found ${result2.resultsReturned} matches\n`);
        
        // Test 3: Invalid nested path
        console.log('\n3. Testing invalid nested path...');
        try {
            await axios.post(`${SERVER_URL}/compare`, {
                inputObject: {
                    practicetypes: {
                        practicetype_title: 'Test'
                    }
                },
                inputElement: 'practicetypes.nonexistent.property',
                arrayOfObjects: [{ id: 1, text: 'Hello' }],
                elementToCheck: 'text'
            });
        } catch (error) {
            console.log('✅ Invalid nested path properly rejected');
            console.log('   Error:', error.response.data.error);
            console.log('   Debug - Searched path:', error.response.data.debug.searchedPath);
            console.log('   Debug - Available keys:', error.response.data.debug.availableKeys);
        }
        
        // Test 4: Regular property (backward compatibility)
        console.log('\n4. Testing regular property (backward compatibility)...');
        const regularRequest = {
            inputObject: {
                title: 'Regular property access',
                category: 'Test'
            },
            inputElement: 'title',
            arrayOfObjects: [
                { id: 1, text: 'Regular property access' },
                { id: 2, text: 'Different text' }
            ],
            elementToCheck: 'text'
        };
        
        const response4 = await axios.post(`${SERVER_URL}/compare`, regularRequest);
        const result4 = response4.data;
        
        console.log(`✅ Regular property access still works!`);
        console.log(`📝 Input String: "${result4.inputString}"`);
        console.log(`📊 Found ${result4.resultsReturned} matches\n`);
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

testNestedObjects();

