/**
 * Test file for Greek Names Correction Library
 * Demonstrates various use cases and capabilities
 */

const GreekNameCorrector = require('./greeknames_rules.js');

// Initialize the corrector
const corrector = new GreekNameCorrector();

console.log('🇬🇷 Greek Names Correction Library - Comprehensive Test Suite');
console.log('=============================================================\n');

// Test 1: Basic Greek Script Names
console.log('📝 Test 1: Basic Greek Script Names');
console.log('-----------------------------------');
const greekNames = [
    'Γιάννης',
    'Μαρία', 
    'Νίκος',
    'Ελένη',
    'Κώστας',
    'Σοφία',
    'Μιχάλης',
    'Αναστασία'
];

greekNames.forEach(name => {
    const result = corrector.correctName(name);
    console.log(`${name} → Gender: ${result.gender}, Case: ${result.currentCase}, Confidence: ${(result.confidence * 100).toFixed(1)}%`);
});

// Test 2: Latin Transliteration
console.log('\n📝 Test 2: Latin Transliteration');
console.log('--------------------------------');
const latinNames = [
    'Giannis',
    'Maria',
    'Nikos', 
    'Eleni',
    'Kostas',
    'Sofia',
    'Michalis',
    'Anastasia'
];

latinNames.forEach(name => {
    const result = corrector.correctName(name);
    console.log(`${name} → ${result.greekScript} (Gender: ${result.gender}, Confidence: ${(result.confidence * 100).toFixed(1)}%)`);
});

// Test 3: Case Transformation
console.log('\n📝 Test 3: Case Transformation');
console.log('-----------------------------');
const testName = 'Γιάννης';
const cases = ['nominative', 'genitive', 'accusative', 'vocative'];

cases.forEach(targetCase => {
    const result = corrector.correctName(testName, { targetCase });
    console.log(`${testName} (${targetCase}) → ${result.corrected}`);
});

// Test 4: Error Correction
console.log('\n📝 Test 4: Error Correction');
console.log('---------------------------');
const namesWithErrors = [
    'Γιάννι', // Missing final sigma
    'Μαρίαι', // Wrong ending
    'Νίκοσ', // Wrong sigma
    'Ελένι'  // Wrong ending
];

namesWithErrors.forEach(name => {
    const result = corrector.correctName(name, { fixCommonErrors: true });
    console.log(`${name} → ${result.corrected} (Fixed: ${name !== result.corrected})`);
});

// Test 5: Mixed Script Detection
console.log('\n📝 Test 5: Mixed Script Detection');
console.log('--------------------------------');
const mixedNames = [
    'Γιάννης',
    'Giannis',
    'Μαρία',
    'Maria',
    'Νίκος',
    'Nikos'
];

mixedNames.forEach(name => {
    const result = corrector.correctName(name);
    console.log(`${name} → Greek Script: ${result.isGreekScript}, Detected: ${result.greekScript}`);
});

// Test 6: Gender Detection Accuracy
console.log('\n📝 Test 6: Gender Detection Accuracy');
console.log('-----------------------------------');
const genderTestNames = {
    masculine: ['Γιάννης', 'Νίκος', 'Κώστας', 'Μιχάλης', 'Δημήτρης', 'Αλέξανδρος'],
    feminine: ['Μαρία', 'Ελένη', 'Σοφία', 'Αναστασία', 'Κατερίνα', 'Ευαγγελία']
};

Object.entries(genderTestNames).forEach(([expectedGender, names]) => {
    console.log(`\n${expectedGender.toUpperCase()} names:`);
    names.forEach(name => {
        const result = corrector.correctName(name);
        const isCorrect = result.gender === expectedGender;
        console.log(`  ${name} → ${result.gender} ${isCorrect ? '✅' : '❌'}`);
    });
});

// Test 7: Confidence Scoring
console.log('\n📝 Test 7: Confidence Scoring');
console.log('----------------------------');
const confidenceTestNames = [
    'Γιάννης',    // Common name - high confidence
    'Μαρία',      // Common name - high confidence  
    'Ξενοφών',    // Less common - medium confidence
    'Αβραάμ',     // Less common - medium confidence
    'Αβγδεζηθ',   // Nonsense - low confidence
];

confidenceTestNames.forEach(name => {
    const result = corrector.correctName(name);
    console.log(`${name} → Confidence: ${(result.confidence * 100).toFixed(1)}%`);
});

// Test 8: Advanced Use Cases
console.log('\n📝 Test 8: Advanced Use Cases');
console.log('-----------------------------');

// Case: Convert Latin to Greek and transform to genitive
const advancedTest = corrector.correctName('Giannis', { 
    targetCase: 'genitive',
    fixCommonErrors: true 
});

console.log(`Latin "Giannis" → Greek Genitive: ${advancedTest.corrected}`);
console.log(`Full result:`, JSON.stringify(advancedTest, null, 2));

// Test 9: Error Handling
console.log('\n📝 Test 9: Error Handling');
console.log('-------------------------');
const errorCases = [
    null,
    undefined,
    '',
    '   ',
    123,
    {},
    []
];

errorCases.forEach(testCase => {
    const result = corrector.correctName(testCase);
    console.log(`${JSON.stringify(testCase)} → ${result.error || 'Valid'}`);
});

// Test 10: Performance Test
console.log('\n📝 Test 10: Performance Test');
console.log('----------------------------');
const performanceNames = Array(1000).fill().map((_, i) => 
    i % 2 === 0 ? 'Γιάννης' : 'Μαρία'
);

const startTime = Date.now();
performanceNames.forEach(name => {
    corrector.correctName(name);
});
const endTime = Date.now();

console.log(`Processed ${performanceNames.length} names in ${endTime - startTime}ms`);
console.log(`Average time per name: ${((endTime - startTime) / performanceNames.length).toFixed(3)}ms`);

console.log('\n🎉 All tests completed!');
console.log('\n📚 Usage Examples:');
console.log('------------------');
console.log('// Basic usage');
console.log('const corrector = new GreekNameCorrector();');
console.log('const result = corrector.correctName("Γιάννης");');
console.log('');
console.log('// With options');
console.log('const result = corrector.correctName("Giannis", {');
console.log('  targetCase: "genitive",');
console.log('  fixCommonErrors: true');
console.log('});');
console.log('');
console.log('// Access results');
console.log('console.log(result.corrected);        // Corrected name');
console.log('console.log(result.greekScript);      // Greek script version');
console.log('console.log(result.gender);           // Detected gender');
console.log('console.log(result.confidence);       // Confidence score');
