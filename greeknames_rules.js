/**
 * Greek Names Correction Library
 * Handles Greek name declension, gender detection, and case correction
 * Supports both Greek script and Latin transliteration
 */

class GreekNameCorrector {
  constructor() {
    this.initializeGenderPatterns();
    this.initializeCasePatterns();
    this.initializeTransliterationMaps();
    this.initializeCommonNames();
  }

  /**
   * Main correction function
   * @param {string} name - The Greek name to correct
   * @param {Object} options - Correction options
   * @returns {Object} - Corrected name with metadata
   */
  correctName(name, options = {}) {
    if (!name || typeof name !== "string") {
      return { error: "Invalid name provided" };
    }

    const trimmedName = name.trim();
    const isGreekScript = this.detectGreekScript(trimmedName);

    // Check for name corrections first (for truncated/incorrectly declined names)
    let correctedName = trimmedName;
    if (this.nameCorrections[trimmedName.toLowerCase()]) {
      correctedName = this.nameCorrections[trimmedName.toLowerCase()];
    }

    const normalizedName = isGreekScript
      ? correctedName
      : this.transliterateToGreek(correctedName);

    const gender = this.detectGender(normalizedName);
    const currentCase = this.identifyCase(normalizedName, gender);

    let finalCorrectedName = normalizedName;

    // Apply corrections based on options
    if (options.targetCase) {
      finalCorrectedName = this.transformToCase(
        normalizedName,
        gender,
        currentCase,
        options.targetCase
      );
    }

    if (options.fixCommonErrors) {
      finalCorrectedName = this.fixCommonErrors(finalCorrectedName, gender);
    }

    // Ensure first letter is always capitalized
    const capitalizedGreekName = this.capitalizeFirstLetter(finalCorrectedName);
    const capitalizedLatinName = this.capitalizeFirstLetter(
      this.transliterateToLatin(finalCorrectedName)
    );

    return {
      original: name,
      corrected: isGreekScript ? capitalizedGreekName : capitalizedLatinName,
      greekScript: capitalizedGreekName,
      latinTransliteration: capitalizedLatinName,
      gender: gender,
      currentCase: currentCase,
      isGreekScript: isGreekScript,
      confidence: this.calculateConfidence(normalizedName, gender)
    };
  }

  /**
   * Initialize gender detection patterns
   */
  initializeGenderPatterns() {
    this.genderPatterns = {
      masculine: {
        endings: ["ος", "ης", "ας", "ης", "ούς", "ής", "άς"],
        latinEndings: ["os", "is", "as", "ous", "is", "as"],
        examples: ["Γιάννης", "Νίκος", "Κώστας", "Μιχάλης"]
      },
      feminine: {
        endings: ["α", "η", "ω", "ού", "ής", "ά"],
        latinEndings: ["a", "i", "o", "ou", "is", "a"],
        examples: ["Μαρία", "Ελένη", "Σοφία", "Αναστασία"]
      },
      neuter: {
        endings: ["ο", "ι", "υ", "άκι", "ούδι"],
        latinEndings: ["o", "i", "y", "aki", "oudi"],
        examples: ["Γιάννης", "Μπάμπης", "Κώστας"]
      }
    };
  }

  /**
   * Initialize case patterns for Greek declension
   */
  initializeCasePatterns() {
    this.casePatterns = {
      nominative: {
        masculine: ["ος", "ης", "ας"],
        feminine: ["α", "η", "ω"],
        neuter: ["ο", "ι", "υ"]
      },
      genitive: {
        masculine: ["ου", "η", "α"],
        feminine: ["ας", "ης", "ως"],
        neuter: ["ου", "ιού", "υ"]
      },
      accusative: {
        masculine: ["ο", "η", "α"],
        feminine: ["α", "η", "ω"],
        neuter: ["ο", "ι", "υ"]
      },
      vocative: {
        masculine: ["ε", "η", "α"],
        feminine: ["α", "η", "ω"],
        neuter: ["ο", "ι", "υ"]
      }
    };
  }

  /**
   * Initialize transliteration maps
   */
  initializeTransliterationMaps() {
    this.greekToLatin = {
      Α: "A",
      α: "a",
      Β: "B",
      β: "b",
      Γ: "G",
      γ: "g",
      Δ: "D",
      δ: "d",
      Ε: "E",
      ε: "e",
      Ζ: "Z",
      ζ: "z",
      Η: "I",
      η: "i",
      Θ: "Th",
      θ: "th",
      Ι: "I",
      ι: "i",
      Κ: "K",
      κ: "k",
      Λ: "L",
      λ: "l",
      Μ: "M",
      μ: "m",
      Ν: "N",
      ν: "n",
      Ξ: "X",
      ξ: "x",
      Ο: "O",
      ο: "o",
      Π: "P",
      π: "p",
      Ρ: "R",
      ρ: "r",
      Σ: "S",
      σ: "s",
      ς: "s",
      Τ: "T",
      τ: "t",
      Υ: "Y",
      υ: "y",
      Φ: "F",
      φ: "f",
      Χ: "Ch",
      χ: "ch",
      Ψ: "Ps",
      ψ: "ps",
      Ω: "O",
      ω: "o"
    };

    this.latinToGreek = {};
    for (const [greek, latin] of Object.entries(this.greekToLatin)) {
      if (!this.latinToGreek[latin]) {
        this.latinToGreek[latin] = greek;
      }
    }

    // Handle special cases
    this.latinToGreek["Th"] = "Θ";
    this.latinToGreek["th"] = "θ";
    this.latinToGreek["Ch"] = "Χ";
    this.latinToGreek["ch"] = "χ";
    this.latinToGreek["Ps"] = "Ψ";
    this.latinToGreek["ps"] = "ψ";

    // Common name transliterations for better accuracy
    this.nameTransliterations = {
      Giannis: "Γιάννης",
      Yiannis: "Γιάννης",
      Ioannis: "Ιωάννης",
      Maria: "Μαρία",
      Nikos: "Νίκος",
      Eleni: "Ελένη",
      Kostas: "Κώστας",
      Sofia: "Σοφία",
      Michalis: "Μιχάλης",
      Anastasia: "Αναστασία",
      Katerina: "Κατερίνα",
      Evangelia: "Ευαγγελία",
      Dimitris: "Δημήτρης",
      Alexandros: "Αλέξανδρος",
      Georgios: "Γεώργιος",
      Georgio: "Γεώργιος",
      Georgios: "Γεώργιος"
    };

    // Common truncated/incorrectly declined names that need correction
    this.nameCorrections = {
      γεώργιο: "Γεώργιος",
      γεώργιου: "Γεώργιος",
      γεώργιε: "Γεώργιος",
      γιάννη: "Γιάννης",
      γιάννου: "Γιάννης",
      γιάννε: "Γιάννης",
      νίκο: "Νίκος",
      νίκου: "Νίκος",
      νίκε: "Νίκος",
      κώστα: "Κώστας",
      κώστας: "Κώστας",
      κώστα: "Κώστας",
      μαρί: "Μαρία",
      μαρίας: "Μαρία",
      ελένη: "Ελένη",
      ελένης: "Ελένη",
      σοφία: "Σοφία",
      σοφίας: "Σοφία"
    };
  }

  /**
   * Initialize common Greek names dictionary
   */
  initializeCommonNames() {
    this.commonNames = {
      // Masculine names
      Γιάννης: {
        gender: "masculine",
        variants: ["Γιάννη", "Γιάννη", "Γιάννε"]
      },
      Νίκος: { gender: "masculine", variants: ["Νίκου", "Νίκο", "Νίκο"] },
      Κώστας: { gender: "masculine", variants: ["Κώστα", "Κώστα", "Κώστα"] },
      Μιχάλης: {
        gender: "masculine",
        variants: ["Μιχάλη", "Μιχάλη", "Μιχάλη"]
      },
      Δημήτρης: {
        gender: "masculine",
        variants: ["Δημήτρη", "Δημήτρη", "Δημήτρη"]
      },
      Αλέξανδρος: {
        gender: "masculine",
        variants: ["Αλέξανδρε", "Αλέξανδρο", "Αλέξανδρε"]
      },
      Γεώργιος: {
        gender: "masculine",
        variants: ["Γεώργιου", "Γεώργιο", "Γεώργιε"]
      },

      // Feminine names
      Μαρία: { gender: "feminine", variants: ["Μαρίας", "Μαρία", "Μαρία"] },
      Ελένη: { gender: "feminine", variants: ["Ελένης", "Ελένη", "Ελένη"] },
      Σοφία: { gender: "feminine", variants: ["Σοφίας", "Σοφία", "Σοφία"] },
      Αναστασία: {
        gender: "feminine",
        variants: ["Αναστασίας", "Αναστασία", "Αναστασία"]
      },
      Κατερίνα: {
        gender: "feminine",
        variants: ["Κατερίνας", "Κατερίνα", "Κατερίνα"]
      },
      Ευαγγελία: {
        gender: "feminine",
        variants: ["Ευαγγελίας", "Ευαγγελία", "Ευαγγελία"]
      }
    };
  }

  /**
   * Detect if the name is in Greek script
   */
  detectGreekScript(name) {
    return /[\u0370-\u03FF]/.test(name);
  }

  /**
   * Detect gender based on name endings
   */
  detectGender(name) {
    // Check common names first
    if (this.commonNames[name]) {
      return this.commonNames[name].gender;
    }

    // Check patterns
    for (const [gender, patterns] of Object.entries(this.genderPatterns)) {
      for (const ending of patterns.endings) {
        if (name.endsWith(ending)) {
          return gender;
        }
      }
    }

    return "unknown";
  }

  /**
   * Identify the current case of the name
   */
  identifyCase(name, gender) {
    if (gender === "unknown") return "unknown";

    for (const [caseName, patterns] of Object.entries(this.casePatterns)) {
      if (
        patterns[gender] &&
        patterns[gender].some((ending) => name.endsWith(ending))
      ) {
        return caseName;
      }
    }

    return "nominative"; // Default assumption
  }

  /**
   * Transform name to target case
   */
  transformToCase(name, gender, currentCase, targetCase) {
    if (currentCase === targetCase || gender === "unknown") {
      return name;
    }

    // Check common names first
    if (this.commonNames[name] && this.commonNames[name].variants) {
      const caseIndex = this.getCaseIndex(targetCase);
      if (caseIndex < this.commonNames[name].variants.length) {
        return this.commonNames[name].variants[caseIndex];
      }
    }

    // Apply rule-based transformation
    return this.applyDeclensionRules(name, gender, currentCase, targetCase);
  }

  /**
   * Get case index for array access
   */
  getCaseIndex(caseName) {
    const caseOrder = ["nominative", "genitive", "accusative", "vocative"];
    return caseOrder.indexOf(caseName);
  }

  /**
   * Apply declension rules
   */
  applyDeclensionRules(name, gender, currentCase, targetCase) {
    // This is a simplified version - in practice, you'd need more complex rules
    const baseName = this.getBaseName(name, gender, currentCase);

    if (targetCase === "nominative") {
      return this.addNominativeEnding(baseName, gender);
    } else if (targetCase === "genitive") {
      return this.addGenitiveEnding(baseName, gender);
    } else if (targetCase === "accusative") {
      return this.addAccusativeEnding(baseName, gender);
    } else if (targetCase === "vocative") {
      return this.addVocativeEnding(baseName, gender);
    }

    return name;
  }

  /**
   * Get base name without case ending
   */
  getBaseName(name, gender, currentCase) {
    const endings = this.casePatterns[currentCase][gender] || [];
    for (const ending of endings) {
      if (name.endsWith(ending)) {
        return name.slice(0, -ending.length);
      }
    }
    return name;
  }

  /**
   * Add nominative ending
   */
  addNominativeEnding(baseName, gender) {
    const endings = this.casePatterns.nominative[gender] || [];
    return baseName + (endings[0] || "");
  }

  /**
   * Add genitive ending
   */
  addGenitiveEnding(baseName, gender) {
    const endings = this.casePatterns.genitive[gender] || [];
    return baseName + (endings[0] || "");
  }

  /**
   * Add accusative ending
   */
  addAccusativeEnding(baseName, gender) {
    const endings = this.casePatterns.accusative[gender] || [];
    return baseName + (endings[0] || "");
  }

  /**
   * Add vocative ending
   */
  addVocativeEnding(baseName, gender) {
    const endings = this.casePatterns.vocative[gender] || [];
    return baseName + (endings[0] || "");
  }

  /**
   * Transliterate from Latin to Greek
   */
  transliterateToGreek(latinName) {
    let greekName = latinName;

    // Check for exact name matches first
    if (this.nameTransliterations[latinName]) {
      return this.nameTransliterations[latinName];
    }

    // Handle special combinations first
    greekName = greekName.replace(/th/gi, (match) =>
      match === "th" ? "θ" : "Θ"
    );
    greekName = greekName.replace(/ch/gi, (match) =>
      match === "ch" ? "χ" : "Χ"
    );
    greekName = greekName.replace(/ps/gi, (match) =>
      match === "ps" ? "ψ" : "Ψ"
    );

    // Handle individual characters
    for (const [latin, greek] of Object.entries(this.latinToGreek)) {
      greekName = greekName.replace(new RegExp(latin, "g"), greek);
    }

    return greekName;
  }

  /**
   * Transliterate from Greek to Latin
   */
  transliterateToLatin(greekName) {
    let latinName = greekName;

    for (const [greek, latin] of Object.entries(this.greekToLatin)) {
      latinName = latinName.replace(new RegExp(greek, "g"), latin);
    }

    return latinName;
  }

  /**
   * Fix common errors in Greek names
   */
  fixCommonErrors(name, gender) {
    let corrected = name;

    // Common transliteration errors
    const corrections = {
      ι: "η", // Common mistake: i instead of η
      υ: "η", // Common mistake: y instead of η
      ο: "ω" // Common mistake: o instead of ω in some contexts
    };

    // Apply corrections based on context and gender
    if (gender === "feminine") {
      // More likely to use η ending
      corrected = corrected.replace(/ι$/, "η");
    }

    return corrected;
  }

  /**
   * Calculate confidence score for the correction
   */
  calculateConfidence(name, gender) {
    let confidence = 0.5; // Base confidence

    if (this.commonNames[name]) {
      confidence += 0.3; // High confidence for known names
    }

    if (gender !== "unknown") {
      confidence += 0.2; // Medium confidence for detected gender
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Capitalize the first letter of a string
   */
  capitalizeFirstLetter(str) {
    if (!str || str.length === 0) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

// Export for use in Node.js or browser
if (typeof module !== "undefined" && module.exports) {
  module.exports = GreekNameCorrector;
} else if (typeof window !== "undefined") {
  window.GreekNameCorrector = GreekNameCorrector;
}

// Example usage and testing
if (typeof require !== "undefined" && require.main === module) {
  const corrector = new GreekNameCorrector();

  // Test cases
  const testNames = [
    "Γιάννης",
    "Μαρία",
    "Giannis", // Latin transliteration
    "Maria", // Latin transliteration
    "Νίκος",
    "Ελένη"
  ];

  console.log("Greek Name Correction Library - Test Results:");
  console.log("============================================");

  testNames.forEach((name) => {
    const result = corrector.correctName(name, {
      targetCase: "genitive",
      fixCommonErrors: true
    });

    console.log(`\nOriginal: ${name}`);
    console.log(`Corrected: ${result.corrected}`);
    console.log(`Greek Script: ${result.greekScript}`);
    console.log(`Gender: ${result.gender}`);
    console.log(`Case: ${result.currentCase}`);
    console.log(`Confidence: ${(result.confidence * 100).toFixed(1)}%`);
  });
}
