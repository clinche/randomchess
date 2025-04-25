'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { defaultLanguage, defaultNamespace, languages, namespaces } from './i18n-config';
import locales from './locales';

// Type definition for the i18n context
type I18nContextType = {
  t: (key: string, options?: Record<string, any>) => string;
  changeLanguage: (lang: string) => void;
  language: string;
  languages: string[];
};

// Create the i18n context
const I18nContext = createContext<I18nContextType | null>(null);

// Helper function to get nested property from an object using a path string
const getNestedValue = (obj: any, path: string): any => {
  const keys = path.split('.');
  return keys.reduce((o, k) => (o || {})[k], obj);
};

// Provider component
export const I18nProvider = ({ children }: { children: React.ReactNode }) => {
  const [language, setLanguage] = useState<string>(defaultLanguage);

  // Load the saved language from localStorage on client-side
  useEffect(() => {
    const savedLanguage = localStorage.getItem('language');
    if (savedLanguage && languages.includes(savedLanguage)) {
      setLanguage(savedLanguage);
      return;
    }

    const browserLanguage = navigator.language.split('-')[0];
    const isLanguageSupported = languages.includes(browserLanguage);
    if (isLanguageSupported) {
      setLanguage(browserLanguage);
    }
  }, []);

  // Translate function
  const t = useCallback((key: string, options?: Record<string, any>): string => {
    try {
      // Split namespace and key
      const [namespace, ...rest] = key.split(':');
      const actualNamespace = rest.length > 0 ? namespace : defaultNamespace;
      const actualKey = rest.length > 0 ? rest.join(':') : key;

      // Get the namespace object
      const namespaceObj = locales[language]?.[actualNamespace] || 
                          locales[defaultLanguage]?.[actualNamespace];
      
      if (!namespaceObj) {
        console.warn(`Namespace not found: ${actualNamespace}`);
        console.warn(`Available namespaces: ${namespaces.join(', ')}`);
        return actualKey;
      }
      
      // Try to get the nested translation value
      const translation = getNestedValue(namespaceObj, actualKey);
      
      // If no translation is found, fallback to the key
      if (translation === undefined) {
        console.warn(`Translation key not found: ${actualKey} in namespace ${actualNamespace}`);
        return actualKey;
      }
      
      // Handle string interpolation if options are provided
      if (typeof translation === 'string' && options) {
        return Object.entries(options).reduce((acc, [key, value]) => {
          return acc.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
        }, translation);
      }
      
      return typeof translation === 'string' ? translation : actualKey;
    } catch (error) {
      console.error(`Translation error for key: ${key}`, error);
      return key;
    }
  }, [language]);

  // Change language function
  const changeLanguage = useCallback((lang: string) => {
    if (languages.includes(lang)) {
      setLanguage(lang);
      localStorage.setItem('language', lang);
      // Update document language attribute
      document.documentElement.lang = lang;
    }
  }, []);

  const value = {
    t,
    changeLanguage,
    language,
    languages
  };

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
};

// Custom hook for using i18n
export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};

// Re-export config values for convenience
export { defaultLanguage, defaultNamespace, languages, namespaces };
