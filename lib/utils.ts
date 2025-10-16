// lib/utils.ts - Utilidades para la aplicación

/**
 * Genera un ID único simple que no depende de crypto.getRandomValues()
 * Útil para entornos donde la API Web Crypto no está disponible
 */
export function generateSimpleId(prefix: string = ''): string {
  const timestamp = new Date().getTime();
  const random = Math.floor(Math.random() * 1000000);
  return `${prefix}${timestamp}${random}`;
}

/**
 * Calcula la edad a partir de una fecha de nacimiento
 */
export function calculateAge(birthdate: string | Date | null): number | null {
  if (!birthdate) return null;
  
  const birth = typeof birthdate === 'string' 
    ? new Date(birthdate) 
    : birthdate;
    
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  
  return age;
}

/**
 * Verifica si un objeto está vacío
 */
export function isEmpty(obj: any): boolean {
  if (obj === null || obj === undefined) return true;
  if (typeof obj === 'string') return obj.trim() === '';
  if (Array.isArray(obj)) return obj.length === 0;
  if (typeof obj === 'object') return Object.keys(obj).length === 0;
  return false;
}