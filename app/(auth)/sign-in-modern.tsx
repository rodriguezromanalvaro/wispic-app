import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  Alert,
  Image, 
  Animated, 
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator 
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { theme } from '../../lib/theme';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';

const { width, height } = Dimensions.get('window');

export default function SignIn() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [slideAnim] = useState(new Animated.Value(0));
  const [logoAnim] = useState(new Animated.Value(0));
  const [formOpacity] = useState(new Animated.Value(0));

  const valid = email.trim().includes('@') && password.trim().length >= 6;

  useEffect(() => {
    // Animaciones de entrada
    Animated.sequence([
      Animated.timing(logoAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(formOpacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    // Animación al cambiar entre login y registro
    Animated.timing(slideAnim, {
      toValue: isSignUp ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isSignUp]);

  const gotoHome = async () => {
    router.replace('/');
  };

  const handleAuthentication = async () => {
    if (!valid) {
      return Alert.alert(
        "Datos incompletos", 
        "Ingresa un email válido y una contraseña de al menos 6 caracteres."
      );
    }
    
    setLoading(true);
    
    try {
      if (isSignUp) {
        // Registro
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password.trim(),
        });
        
        if (error) {
          return Alert.alert("Error al registrarte", error.message);
        }
        
        if (data.session) {
          return gotoHome();
        }
        
        // Intentar iniciar sesión automáticamente después del registro
        const { error: loginErr } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password.trim(),
        });
        
        if (loginErr) {
          return Alert.alert("No se pudo iniciar sesión", loginErr.message);
        }
        
        return gotoHome();
      } else {
        // Login
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password.trim(),
        });
        
        if (error) {
          return Alert.alert("Error al iniciar sesión", error.message);
        }
        
        const { data: sess } = await supabase.auth.getSession();
        if (!sess.session) {
          return Alert.alert(
            "No hay sesión", 
            "Revisa tu email para confirmar tu cuenta o contacta con soporte."
          );
        }
        
        return gotoHome();
      }
    } catch (error) {
      Alert.alert("Error inesperado", "Ocurrió un problema. Inténtalo de nuevo más tarde.");
    } finally {
      setLoading(false);
    }
  };

  const toggleAuthMode = () => {
    setIsSignUp(!isSignUp);
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar style="light" />
      <LinearGradient
        colors={['#3a1c71', '#d76d77', '#ffaf7b']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.background}
      />
      
      <ScrollView 
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top, paddingBottom: insets.bottom + 20 }
        ]}
      >
        <Animated.View style={[
          styles.logoContainer, 
          { 
            transform: [
              { scale: logoAnim },
              { translateY: logoAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [50, 0]
              })}
            ] 
          }
        ]}>
          <Image 
            source={require('../../assets/logotype.png')} 
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.tagline}>Conecta con quien realmente importa</Text>
        </Animated.View>
        
        <Animated.View 
          style={[
            styles.formContainer, 
            { opacity: formOpacity }
          ]}
        >
          <BlurView intensity={80} tint="dark" style={styles.blurContainer}>
            <View style={styles.tabContainer}>
              <TouchableOpacity 
                style={[styles.tab, !isSignUp && styles.activeTab]} 
                onPress={() => setIsSignUp(false)}
              >
                <Text style={[styles.tabText, !isSignUp && styles.activeTabText]}>Iniciar Sesión</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.tab, isSignUp && styles.activeTab]} 
                onPress={() => setIsSignUp(true)}
              >
                <Text style={[styles.tabText, isSignUp && styles.activeTabText]}>Registrarse</Text>
              </TouchableOpacity>
            </View>
            
            <Animated.View style={[
              styles.formContent,
              {
                transform: [{
                  translateX: slideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -15]
                  })
                }]
              }
            ]}>
              <Text style={styles.inputLabel}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="tu@email.com"
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              
              <Text style={styles.inputLabel}>Contraseña</Text>
              <TextInput
                style={styles.input}
                placeholder="Mínimo 6 caracteres"
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
              
              {!isSignUp && (
                <TouchableOpacity style={styles.forgotPassword}>
                  <Text style={styles.forgotPasswordText}>¿Olvidaste tu contraseña?</Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity 
                style={[styles.button, !valid && styles.buttonDisabled]}
                onPress={handleAuthentication}
                disabled={!valid || loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.buttonText}>
                    {isSignUp ? 'Crear cuenta' : 'Iniciar sesión'}
                  </Text>
                )}
              </TouchableOpacity>
              
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>o continúa con</Text>
                <View style={styles.dividerLine} />
              </View>
              
              <View style={styles.socialButtons}>
                <TouchableOpacity style={styles.socialButton}>
                  <Text style={styles.socialButtonText}>Google</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.socialButton}>
                  <Text style={styles.socialButtonText}>Apple</Text>
                </TouchableOpacity>
              </View>
              
              <TouchableOpacity 
                style={styles.switchAuth} 
                onPress={toggleAuthMode}
              >
                <Text style={styles.switchAuthText}>
                  {isSignUp 
                    ? '¿Ya tienes cuenta? Inicia sesión' 
                    : '¿No tienes cuenta? Regístrate'}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </BlurView>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logo: {
    width: 150,
    height: 60,
    marginBottom: 15,
  },
  tagline: {
    fontSize: 16,
    color: 'white',
    textAlign: 'center',
    fontWeight: '500',
  },
  formContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    overflow: 'hidden',
  },
  blurContainer: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  formContent: {
    padding: 20,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.2)',
  },
  tab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.primary,
  },
  tabText: {
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
    fontSize: 16,
  },
  activeTabText: {
    color: 'white',
  },
  inputLabel: {
    color: 'white',
    marginBottom: 5,
    marginTop: 15,
    fontWeight: '500',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: 12,
    color: 'white',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginTop: 5,
    marginBottom: 20,
  },
  forgotPasswordText: {
    color: theme.colors.primary,
    fontSize: 14,
  },
  button: {
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonDisabled: {
    backgroundColor: 'rgba(110, 139, 255, 0.5)',
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  dividerText: {
    color: 'rgba(255,255,255,0.6)',
    paddingHorizontal: 10,
    fontSize: 14,
  },
  socialButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  socialButton: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginHorizontal: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  socialButtonText: {
    color: 'white',
    fontWeight: '500',
  },
  switchAuth: {
    marginTop: 20,
    alignItems: 'center',
  },
  switchAuthText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
});