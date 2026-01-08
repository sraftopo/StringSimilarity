const axios = require('axios');

const SERVER_URL = 'http://localhost:3031';

async function testNewAPI() {
    console.log('🧪 Testing New API with inputObject...\n');
    
    try {
        // Test 1: Medical practice search
        console.log('1. Testing medical practice search...');
        const medicalData = {
            inputObject: {
                id: 1,
                title: "Ακτινοθεραπεία καθοδηγούμενη απεικονιστικά (IGRT)",
                category: "Radiotherapy",
                description: "Image-guided radiation therapy using advanced imaging techniques"
            },
            inputElement: "title",
            arrayOfObjects: [
                {"PracticeTypeID": 20, "ApplicationCategoryID": 3, "PracticeID": 20, "PracticeTypeTitle": "Μαστογραφίες τομοσύνθεσης και στερεοτακτικής βιοψίας εντός τμημάτων ιατρικής απεικόνισης, νοσοκομείου ή ιδιωτικής κλινικής/διαγνωστικού κέντρου"},
                {"PracticeTypeID": 21, "ApplicationCategoryID": 3, "PracticeID": 20, "PracticeTypeTitle": "Διαγνωστική και επεμβατική ακτινοσκόπηση εντός τμήματος ιατρικής απεικόνισης νοσοκομείου ή ιδιωτικής κλινικής"},
                {"PracticeTypeID": 22, "ApplicationCategoryID": 3, "PracticeID": 20, "PracticeTypeTitle": "Διαγνωστική και επεμβατική ακτινοσκόπηση εκτός τμήματος ιατρικής απεικόνισης εντός νοσοκομείου\r\nή ιδιωτικής κλινικής (όπως ενδεικτικά τμήματα ορθοπαιδικά, γαστρεντερολογικά, ουρολογικά,\r\nχειρουργικά, αγγειοχειρουργικά, κλπ)"},
                {"PracticeTypeID": 23, "ApplicationCategoryID": 3, "PracticeID": 20, "PracticeTypeTitle": "Διαγνωστική και επεμβατική υπολογιστική τομογραφία εντός τμήματος ιατρικής απεικόνισης\r\nνοσοκομείου ή ιδιωτικής κλινικής/διαγνωστικού κέντρου"},
                {"PracticeTypeID": 24, "ApplicationCategoryID": 3, "PracticeID": 20, "PracticeTypeTitle": "Επεμβατικές ακτινολογικές πρακτικές σε αγγειογράφο εντός τμήματος ιατρικής απεικόνισης\r\nνοσοκομείου ή ιδιωτικής κλινικής"},
                {"PracticeTypeID": 25, "ApplicationCategoryID": 3, "PracticeID": 20, "PracticeTypeTitle": "Επεμβατικές καρδιολογικές πρακτικές (όπως ενδεικτικά αιμοδυναμική-ηλεκτροφυσιολογίατοποθέτηση βηματοδοτών/απινιδωτών, αντικατάσταση βαλβίδων) σε στεφανιογράφο εντός\r\nνοσοκομείου ή ιδιωτικής κλινικής"},
                {"PracticeTypeID": 26, "ApplicationCategoryID": 3, "PracticeID": 20, "PracticeTypeTitle": "Λειτουργία εξομοιωτή στην ακτινοθεραπεία"},
                {"PracticeTypeID": 27, "ApplicationCategoryID": 3, "PracticeID": 20, "PracticeTypeTitle": "Εξωτερική ακτινοθεραπεία με (α) ακτίνες Χ (β) δέσμες ηλεκτρονίων"},
                {"PracticeTypeID": 28, "ApplicationCategoryID": 3, "PracticeID": 20, "PracticeTypeTitle": "(α) Εξωτερική ακτινοθεραπεία διαμορφούμενης έντασης ακτινοβόλησης (IMRT), (β) ακτινοθεραπεία\r\nκαθοδηγούμενη απεικονιστικά (IGRT), (γ) ογκομετρική ακτινοθεραπεία διαμορφούμενης έντασης (VMAT),\r\n(δ) στερεοτακτική– ακτινοχειρουργική (SRS , SBRT) με δέσμες ακτίνων Χ"},
                {"PracticeTypeID": 29, "ApplicationCategoryID": 3, "PracticeID": 20, "PracticeTypeTitle": "Ολόσωμη ακτινοβόληση (TBI)"},
                {"PracticeTypeID": 30, "ApplicationCategoryID": 3, "PracticeID": 20, "PracticeTypeTitle": "Βραχυθεραπεία με χρήση ακτίνων Χ"}
            ],
            elementToCheck: "PracticeTypeTitle"
        };
        
        const response1 = await axios.post(`${SERVER_URL}/compare`, medicalData);
        const result1 = response1.data;
        
        console.log(`✅ Input Object:`, result1.inputObject);
        console.log(`📝 Input String: "${result1.inputString}"`);
        console.log(`📊 Found ${result1.resultsReturned} matches out of ${result1.totalCompared} practices\n`);
        
        console.log('Top 3 matches:');
        result1.results.slice(0, 3).forEach((match, index) => {
            console.log(`${index + 1}. Score: ${match.score} - "${match.targetString.substring(0, 80)}..."`);
        });
        
        // Test 2: Product search with different input element
        console.log('\n2. Testing product search with description...');
        const productData = {
            inputObject: {
                id: 1,
                name: "iPhone 15 Pro Max",
                description: "Latest iPhone with advanced camera system and A17 Pro chip",
                price: 1199,
                category: "Smartphones"
            },
            inputElement: "description",
            arrayOfObjects: [
                { id: 1, name: "iPhone 15 Pro Max 256GB", description: "Latest iPhone with advanced camera system", price: 1199, category: "phones" },
                { id: 2, name: "iPhone 15 Pro 128GB", description: "Pro iPhone with titanium design", price: 999, category: "phones" },
                { id: 3, name: "Samsung Galaxy S24 Ultra", description: "Android flagship with S Pen", price: 1299, category: "phones" },
                { id: 4, name: "MacBook Pro 16-inch", description: "Professional laptop with M3 chip", price: 2499, category: "laptops" }
            ],
            elementToCheck: "description"
        };
        
        const response2 = await axios.post(`${SERVER_URL}/compare`, productData);
        const result2 = response2.data;
        
        console.log(`✅ Input Object:`, result2.inputObject);
        console.log(`📝 Input String: "${result2.inputString}"`);
        console.log(`📊 Found ${result2.resultsReturned} matches out of ${result2.totalCompared} products\n`);
        
        console.log('Product matches:');
        result2.results.forEach((match, index) => {
            console.log(`${index + 1}. [${match.originalObject.category}] ${match.originalObject.name} - Score: ${match.score}`);
        });
        
        // Test 3: Error handling - missing inputElement
        console.log('\n3. Testing error handling (missing inputElement)...');
        try {
            await axios.post(`${SERVER_URL}/compare`, {
                inputObject: { id: 1, text: "Hello world" },
                arrayOfObjects: [{ id: 1, text: "Hello" }],
                elementToCheck: "text"
            });
        } catch (error) {
            console.log('✅ Error properly caught:', error.response.data.error);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

testNewAPI();

