import * as Localization from 'expo-localization';

import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
// Cargar recursos extra (orientation, seeking, etc.)
 
const enExtra = require('../i18n/en.json');
const esExtra = require('../i18n/es.json');
 

// Recursos base mínimos + placeholders de auth para evitar mostrar claves
const baseResources = {
  en: {
    translation: {
      common: { back: 'Back', continue: 'Continue', saveContinue: 'Save and continue' },
      app: { name: 'Wispic' },
      auth: {
        signInTitle: 'Sign in',
        signInSubtitle: 'Welcome back',
        signUpTitle: 'Create account',
        signUpSubtitle: 'Join the community',
        noAccount: "Don't have an account? ",
        haveAccount: 'Already have an account? ',
        createAccount: 'Create account',
        invalidEmail: 'Invalid email',
        invalidPassword: 'Invalid password',
        passwordLabel: 'Password',
        enter: 'Enter',
        redirecting: 'Redirecting…',
        useEmail: 'Use email',
        passwordRulesIntro: 'Your password must contain:',
        passwordStrength: 'Strength'
      },
      complete: { progress: 'Step {{current}} of {{total}}' }
    }
  },
  es: {
    translation: {
      common: { back: 'Atrás', continue: 'Continuar', saveContinue: 'Guardar y continuar' },
      app: { name: 'Wispic' },
      auth: {
        signInTitle: 'Inicia sesión',
        signInSubtitle: 'Bienvenido de nuevo',
        signUpTitle: 'Crear cuenta',
        signUpSubtitle: 'Únete a la comunidad',
        noAccount: '¿No tienes cuenta? ',
        haveAccount: '¿Ya tienes cuenta? ',
        createAccount: 'Crear cuenta',
        invalidEmail: 'Email inválido',
        invalidPassword: 'Contraseña inválida',
        passwordLabel: 'Contraseña',
        enter: 'Entrar',
        redirecting: 'Redirigiendo…',
        useEmail: 'Usar email',
        passwordRulesIntro: 'Tu contraseña debe contener:',
        passwordStrength: 'Fuerza'
      },
      complete: { progress: 'Paso {{current}} de {{total}}' }
    }
  }
};

// Deep merge simple (objetos planos anidados)
function deepMerge<T extends Record<string, any>>(target: T, source: T): T {
  const out: Record<string, any> = { ...target };
  Object.keys(source || {}).forEach(k => {
    if (source[k] && typeof source[k] === 'object' && !Array.isArray(source[k])) {
      out[k] = deepMerge(out[k] || {}, source[k]);
    } else {
      out[k] = source[k];
    }
  });
  return out as T;
}

// Mezclar extras encima de base para que sobrescriban
const resources = {
  en: { translation: deepMerge(baseResources.en.translation, enExtra.translation ? enExtra.translation : enExtra) },
  es: { translation: deepMerge(baseResources.es.translation, esExtra.translation ? esExtra.translation : esExtra) },
};

const instance = i18next.createInstance();

instance.use(initReactI18next).init({
  resources,
  lng: (Localization.getLocales()[0]?.languageCode || 'es').toLowerCase(),
  fallbackLng: 'es',
  supportedLngs: ['es','en'],
  cleanCode: true,
  returnNull: false,
  interpolation: { escapeValue: false },
});

export default instance;
export { instance as i18n };