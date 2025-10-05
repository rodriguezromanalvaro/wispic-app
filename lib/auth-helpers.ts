// lib/auth-helpers.ts
import { supabase } from './supabase';

/**
 * Verifica si un usuario existe antes de intentar iniciar sesión
 * @param email El email del usuario a verificar
 * @returns true si el usuario existe, false si no
 */
export async function checkUserExists(email: string): Promise<boolean> {
  try {
    // La única forma segura de verificar si un usuario existe sin permisos admin
    // es intentar iniciar sesión con un método que no requiera contraseña pero
    // que tampoco cree un usuario nuevo

    // Este método es más confiable y simple que intentar consultar la tabla profiles
    // Simplemente intentamos restablecer la contraseña sin redirección
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    
    // Si no hay error, el usuario existe
    // Si hay error y menciona que el usuario no existe, entonces sabemos que no existe
    if (error && 
        (error.message.includes('User not found') || 
         error.message.includes('No user found'))) {
      return false;
    }
    
    // Si llegamos aquí, lo más probable es que el usuario exista
    // (o hubo un error diferente, en cuyo caso asumimos que existe por precaución)
    return true;
  } catch (error) {
    console.error('Error verificando usuario:', error);
    // En caso de error inesperado, asumimos que el usuario no existe
    // para permitir el flujo de registro
    return false;
  }
}

/**
 * Intenta registrar un nuevo usuario
 * @param email Email del usuario
 * @param password Contraseña del usuario
 * @returns Un objeto con el resultado del registro
 */
export async function signUpUser(email: string, password: string): Promise<{
  success: boolean;
  session: boolean;
  error?: string;
}> {
  try {
    // Intentamos crear el usuario directamente
    // Supabase ya maneja el caso de usuario duplicado y devolverá un error apropiado
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: password.trim(),
    });
    
    if (error) {
      // Si el mensaje de error indica que el usuario ya existe
      if (error.message.includes('already registered') || 
          error.message.includes('already exists') ||
          error.message.includes('User already registered')) {
        return {
          success: false,
          session: false,
          error: 'Este email ya está registrado. Por favor, inicia sesión.'
        };
      }
      
      // Para otros errores, pasamos el mensaje tal cual
      return {
        success: false,
        session: false,
        error: error.message
      };
    }
    
    return {
      success: true,
      session: !!data.session,
      error: undefined
    };
  } catch (error: any) {
    return {
      success: false,
      session: false,
      error: error?.message || 'Error desconocido al registrar usuario'
    };
  }
}

/**
 * Intenta iniciar sesión con un usuario existente
 * @param email Email del usuario
 * @param password Contraseña del usuario
 * @returns Un objeto con el resultado del inicio de sesión
 */
export async function signInUser(email: string, password: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Intentamos iniciar sesión directamente
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password.trim(),
    });
    
    if (error) {
      // Si el error indica credenciales inválidas, mostramos un mensaje más claro
      if (error.message.includes('Invalid login') || 
          error.message.includes('Invalid credentials')) {
        return {
          success: false,
          error: 'No existe ninguna cuenta con este email o la contraseña es incorrecta. Por favor, regístrate primero.'
        };
      }
      
      return {
        success: false,
        error: error.message
      };
    }
    
    // Verificamos la sesión
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session) {
      return {
        success: false,
        error: 'No se pudo crear la sesión. Revisa la configuración de autenticación.'
      };
    }
    
    return {
      success: true,
      error: undefined
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || 'Error desconocido al iniciar sesión'
    };
  }
}