import { languages, namespaces } from "./i18n-config";

// This function loads all language files for our namespaces
const locales: {
  [language: string]: {
    [namespace: string]: Record<string, string>;
  };
} = {};

// Map through all defined languages
languages.forEach((language: string) => {
  locales[language] = {};
  
  // Map through all defined namespaces
  namespaces.forEach((namespace: string) => {
    try {
      // Import the locale files statically to work with static exports
      let translations = {};
      
      if (language === 'en') {
        if (namespace === 'common') {
          translations = require('../../../public/locales/en/common.json');
        } else if (namespace === 'chess') {
          translations = require('../../../public/locales/en/chess.json');
        } else if (namespace === 'analysis') {
          translations = require('../../../public/locales/en/analysis.json');
        } else if (namespace === 'about') {
            translations = require('../../../public/locales/en/about.json');
        }
      } else if (language === 'de') {
        if (namespace === 'common') {
          translations = require('../../../public/locales/de/common.json');
        } else if (namespace === 'chess') {
          translations = require('../../../public/locales/de/chess.json');
        } else if (namespace === 'analysis') {
          translations = require('../../../public/locales/de/analysis.json');
        } else if (namespace === 'about') {
            translations = require('../../../public/locales/de/about.json');
        }
      } else if (language === 'es') {
        if (namespace === 'common') {
          translations = require('../../../public/locales/es/common.json');
        } else if (namespace === 'chess') {
          translations = require('../../../public/locales/es/chess.json');
        } else if (namespace === 'analysis') {
          translations = require('../../../public/locales/es/analysis.json');
        } else if (namespace === 'about') {
            translations = require('../../../public/locales/es/about.json');
        }
      } else if (language === 'fr') {
        if (namespace === 'common') {
          translations = require('../../../public/locales/fr/common.json');
        } else if (namespace === 'chess') {
          translations = require('../../../public/locales/fr/chess.json');
        } else if (namespace === 'analysis') {
          translations = require('../../../public/locales/fr/analysis.json');
        } else if (namespace === 'about') {
            translations = require('../../../public/locales/fr/about.json');
        }
      } else if (language === 'it') {
        if (namespace === 'common') {
          translations = require('../../../public/locales/it/common.json');
        } else if (namespace === 'chess') {
          translations = require('../../../public/locales/it/chess.json');
        } else if (namespace === 'analysis') {
          translations = require('../../../public/locales/it/analysis.json');
        } else if (namespace === 'about') {
            translations = require('../../../public/locales/it/about.json');
        }
      }
      
      locales[language][namespace] = translations;
    } catch (e) {
      console.warn(`Could not load locale: ${language}/${namespace}`);
      locales[language][namespace] = {};
    }
  });
});

export default locales;