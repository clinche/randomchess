// Configuration for i18n (shared between files to avoid circular dependencies)

// Get configuration from environment variables or use defaults
export const languages = JSON.parse(process.env.NEXT_PUBLIC_I18N_LANGUAGES || '["en", "de", "es", "fr", "it"]');
export const defaultLanguage = process.env.NEXT_PUBLIC_I18N_DEFAULT_LANGUAGE || 'en';
export const namespaces = JSON.parse(process.env.NEXT_PUBLIC_I18N_NAMESPACES || '["common", "chess", "analysis", "about"]');
export const defaultNamespace = process.env.NEXT_PUBLIC_I18N_DEFAULT_NAMESPACE || 'common';