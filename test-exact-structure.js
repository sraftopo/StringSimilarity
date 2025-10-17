const axios = require('axios');

const SERVER_URL = 'http://localhost:3031';

async function testExactStructure() {
    console.log('🧪 Testing Exact Structure from User Request...\n');
    
    try {
        // Test with the exact structure provided by the user
        console.log('1. Testing exact user structure...');
        const exactRequest = {
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
                        PracticeTypeTitle: 'Διαγνωστική και επεμβατική ακτινοσκόπηση εκτός τμήματος ιατρικής απεικόνισης εντός νοσοκομείου\r\nή ιδιωτικής κλινικής (όπως ενδεικτικά τμήματα ορθοπαιδικά, γαστρεντερολογικά, ουρολογικά,\r\nχειρουργικά, αγγειοχειρουργικά, κλπ)',
                        PracticeID: 20,
                        PracticeTypeID: 22,
                        ApplicationCategoryID: 3
                    },
                    {
                        PracticeTypeTitle: 'Διαγνωστική και επεμβατική υπολογιστική τομογραφία εντός τμήματος ιατρικής απεικόνισης\r\nνοσοκομείου ή ιδιωτικής κλινικής/διαγνωστικού κέντρου',
                        PracticeID: 20,
                        PracticeTypeID: 23,
                        ApplicationCategoryID: 3
                    },
                    {
                        PracticeTypeTitle: 'Επεμβατικές ακτινολογικές πρακτικές σε αγγειογράφο εντός τμήματος ιατρικής απεικόνισης\r\nνοσοκομείου ή ιδιωτικής κλινικής',
                        PracticeID: 20,
                        PracticeTypeID: 24,
                        ApplicationCategoryID: 3
                    },
                    {
                        PracticeTypeTitle: 'Επεμβατικές καρδιολογικές πρακτικές (όπως ενδεικτικά αιμοδυναμική-ηλεκτροφυσιολογίατοποθέτηση βηματοδοτών/απινιδωτών, αντικατάσταση βαλβίδων) σε στεφανιογράφο εντός\r\nνοσοκομείου ή ιδιωτικής κλινικής',
                        PracticeID: 20,
                        PracticeTypeID: 25,
                        ApplicationCategoryID: 3
                    },
                    {
                        PracticeTypeTitle: 'Λειτουργία εξομοιωτή στην ακτινοθεραπεία',
                        PracticeID: 20,
                        PracticeTypeID: 26,
                        ApplicationCategoryID: 3
                    },
                    {
                        PracticeTypeTitle: 'Εξωτερική ακτινοθεραπεία με (α) ακτίνες Χ (β) δέσμες ηλεκτρονίων',
                        PracticeID: 20,
                        PracticeTypeID: 27,
                        ApplicationCategoryID: 3
                    },
                    {
                        PracticeTypeTitle: '(α) Εξωτερική ακτινοθεραπεία διαμορφούμενης έντασης ακτινοβόλησης (IMRT), (β) ακτινοθεραπεία\r\nκαθοδηγούμενη απεικονιστικά (IGRT), (γ) ογκομετρική ακτινοθεραπεία διαμορφούμενης έντασης (VMAT),\r\n(δ) στερεοτακτική– ακτινοχειρουργική (SRS , SBRT) με δέσμες ακτίνων Χ',
                        PracticeID: 20,
                        PracticeTypeID: 28,
                        ApplicationCategoryID: 3
                    },
                    {
                        PracticeTypeTitle: 'Ολόσωμη ακτινοβόληση (TBI)',
                        PracticeID: 20,
                        PracticeTypeID: 29,
                        ApplicationCategoryID: 3
                    },
                    {
                        PracticeTypeTitle: 'Βραχυθεραπεία με χρήση ακτίνων Χ',
                        PracticeID: 20,
                        PracticeTypeID: 30,
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
                },
                {
                    PracticeTypeTitle: 'Λειτουργία εξομοιωτή στην ακτινοθεραπεία',
                    PracticeID: 20,
                    PracticeTypeID: 26,
                    ApplicationCategoryID: 3
                }
            ],
            elementToCheck: 'PracticeTypeTitle'
        };
        
        const response = await axios.post(`${SERVER_URL}/compare`, exactRequest);
        const result = response.data;
        
        console.log(`✅ Successfully processed exact user structure!`);
        console.log(`📝 Input Object structure:`, {
            practicetypes: result.inputObject.practicetypes,
            practice_number: result.inputObject.practice_number,
            practice_code: result.inputObject.practice_code,
            practice_id: result.inputObject.practice_id,
            uniqueId: result.inputObject.uniqueId,
            r_length: result.inputObject.r.length
        });
        console.log(`📝 Input String: "${result.inputString}"`);
        console.log(`📊 Found ${result.resultsReturned} matches out of ${result.totalCompared} practices\n`);
        
        console.log('Top matches:');
        result.results.forEach((match, index) => {
            console.log(`${index + 1}. Score: ${match.score} - "${match.targetString.substring(0, 80)}..."`);
        });
        
        console.log('\n🎯 Top Match Details:');
        if (result.topMatch) {
            console.log(`   Score: ${result.topMatch.score}`);
            console.log(`   Target: "${result.topMatch.targetString}"`);
            console.log(`   PracticeID: ${result.topMatch.originalObject.PracticeID}`);
            console.log(`   PracticeTypeID: ${result.topMatch.originalObject.PracticeTypeID}`);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

testExactStructure();
