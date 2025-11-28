const axios = require('axios');

const SERVER_URL = 'http://localhost:3031';

// Example 1: Product search
async function productSearch() {
    console.log('🛍️ Example 1: Product Search\n');
    
    const productData = {
        inputString: "Ακτινοθεραπεία καθοδηγούμενη απεικονιστικά (IGRT)",
        arrayOfObjects: [{"PracticeTypeID":20,"ApplicationCategoryID":3,"PracticeID":20,"PracticeTypeTitle":"Μαστογραφίες τομοσύνθεσης και στερεοτακτικής βιοψίας εντός τμημάτων ιατρικής απεικόνισης, νοσοκομείου ή ιδιωτικής κλινικής\/διαγνωστικού κέντρου"},{"PracticeTypeID":21,"ApplicationCategoryID":3,"PracticeID":20,"PracticeTypeTitle":"Διαγνωστική και επεμβατική ακτινοσκόπηση εντός τμήματος ιατρικής απεικόνισης νοσοκομείου ή ιδιωτικής κλινικής"},{"PracticeTypeID":22,"ApplicationCategoryID":3,"PracticeID":20,"PracticeTypeTitle":"Διαγνωστική και επεμβατική ακτινοσκόπηση εκτός τμήματος ιατρικής απεικόνισης εντός νοσοκομείου\r\nή ιδιωτικής κλινικής (όπως ενδεικτικά τμήματα ορθοπαιδικά, γαστρεντερολογικά, ουρολογικά,\r\nχειρουργικά, αγγειοχειρουργικά, κλπ)"},{"PracticeTypeID":23,"ApplicationCategoryID":3,"PracticeID":20,"PracticeTypeTitle":"Διαγνωστική και επεμβατική υπολογιστική τομογραφία εντός τμήματος ιατρικής απεικόνισης\r\nνοσοκομείου ή ιδιωτικής κλινικής\/διαγνωστικού κέντρου"},{"PracticeTypeID":24,"ApplicationCategoryID":3,"PracticeID":20,"PracticeTypeTitle":"Επεμβατικές ακτινολογικές πρακτικές σε αγγειογράφο εντός τμήματος ιατρικής απεικόνισης\r\nνοσοκομείου ή ιδιωτικής κλινικής"},{"PracticeTypeID":25,"ApplicationCategoryID":3,"PracticeID":20,"PracticeTypeTitle":"Επεμβατικές καρδιολογικές πρακτικές (όπως ενδεικτικά αιμοδυναμική-ηλεκτροφυσιολογίατοποθέτηση βηματοδοτών\/απινιδωτών, αντικατάσταση βαλβίδων) σε στεφανιογράφο εντός\r\nνοσοκομείου ή ιδιωτικής κλινικής"},{"PracticeTypeID":26,"ApplicationCategoryID":3,"PracticeID":20,"PracticeTypeTitle":"Λειτουργία εξομοιωτή στην ακτινοθεραπεία"},{"PracticeTypeID":27,"ApplicationCategoryID":3,"PracticeID":20,"PracticeTypeTitle":"Εξωτερική ακτινοθεραπεία με (α) ακτίνες Χ (β) δέσμες ηλεκτρονίων"},{"PracticeTypeID":28,"ApplicationCategoryID":3,"PracticeID":20,"PracticeTypeTitle":"(α) Εξωτερική ακτινοθεραπεία διαμορφούμενης έντασης ακτινοβόλησης (IMRT), (β) ακτινοθεραπεία\r\nκαθοδηγούμενη απεικονιστικά (IGRT), (γ) ογκομετρική ακτινοθεραπεία διαμορφούμενης έντασης (VMAT),\r\n(δ) στερεοτακτική– ακτινοχειρουργική (SRS , SBRT) με δέσμες ακτίνων Χ"},{"PracticeTypeID":29,"ApplicationCategoryID":3,"PracticeID":20,"PracticeTypeTitle":"Ολόσωμη ακτινοβόληση (TBI)"},{"PracticeTypeID":30,"ApplicationCategoryID":3,"PracticeID":20,"PracticeTypeTitle":"Βραχυθεραπεία με χρήση ακτίνων Χ"}],
        elementToCheck: "PracticeTypeTitle"
    };
    
    try {
        const response = await axios.post(`${SERVER_URL}/compare`, productData);
        const result = response.data;
        
        console.log(`Searching for: "${result.inputString}"`);
        console.log(`Found ${result.resultsReturned} matches out of ${result.totalCompared} products\n`);
        
        console.log('Top 3 matches:');
        result.results.slice(0, 3).forEach((match, index) => {
            console.log(`${index + 1}. ${match.targetString} (Score: ${match.score}) - $${match.originalObject.PracticeTypeID}`);
        });
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

// Example 2: Document similarity
async function documentSimilarity() {
    console.log('\n📄 Example 2: Document Similarity\n');
    
    const documentData = {
        inputString: "Machine learning is a subset of artificial intelligence",
        arrayOfObjects: [
            { id: 1, title: "Introduction to AI", content: "Artificial intelligence is the simulation of human intelligence", category: "AI" },
            { id: 2, title: "ML Basics", content: "Machine learning is a subset of artificial intelligence", category: "ML" },
            { id: 3, title: "Deep Learning", content: "Deep learning uses neural networks with multiple layers", category: "DL" },
            { id: 4, title: "Data Science", content: "Data science combines statistics and programming", category: "DS" },
            { id: 5, title: "Computer Vision", content: "Computer vision enables machines to interpret visual information", category: "CV" }
        ],
        elementToCheck: "content"
    };
    
    try {
        const response = await axios.post(`${SERVER_URL}/compare`, documentData);
        const result = response.data;
        
        console.log(`Query: "${result.inputString}"`);
        console.log(`Found ${result.resultsReturned} similar documents\n`);
        
        console.log('Document matches:');
        result.results.forEach((match, index) => {
            console.log(`${index + 1}. [${match.originalObject.category}] ${match.originalObject.title}`);
            console.log(`   Content: "${match.targetString}"`);
            console.log(`   Similarity: ${match.score}\n`);
        });
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

// Example 3: User search
async function userSearch() {
    console.log('👥 Example 3: User Search\n');
    
    const userData = {
        inputString: "John Smith",
        arrayOfObjects: [
            { id: 1, name: "John Smith", email: "john.smith@email.com", department: "Engineering" },
            { id: 2, name: "Jane Smith", email: "jane.smith@email.com", department: "Marketing" },
            { id: 3, name: "Johnny Smith", email: "johnny@email.com", department: "Sales" },
            { id: 4, name: "Bob Johnson", email: "bob.johnson@email.com", department: "HR" },
            { id: 5, name: "John Doe", email: "john.doe@email.com", department: "Finance" }
        ],
        elementToCheck: "name"
    };
    
    try {
        const response = await axios.post(`${SERVER_URL}/compare`, userData);
        const result = response.data;
        
        console.log(`Searching for: "${result.inputString}"`);
        console.log(`Found ${result.resultsReturned} users\n`);
        
        console.log('User matches:');
        result.results.forEach((match, index) => {
            console.log(`${index + 1}. ${match.targetString} (${match.originalObject.email}) - ${match.originalObject.department}`);
            console.log(`   Similarity: ${match.score}\n`);
        });
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

// Run all examples
async function runExamples() {
    try {
        await productSearch();
        await documentSimilarity();
        await userSearch();
        
        console.log('✅ All examples completed successfully!');
    } catch (error) {
        console.error('❌ Examples failed:', error.message);
    }
}

// Check if server is running first
async function checkServer() {
    try {
        await axios.get(`${SERVER_URL}/health`);
        return true;
    } catch (error) {
        console.error('❌ Server is not running. Please start the server with: npm start');
        return false;
    }
}

// Main execution
async function main() {
    const serverRunning = await checkServer();
    if (serverRunning) {
        await runExamples();
    }
}

main();

