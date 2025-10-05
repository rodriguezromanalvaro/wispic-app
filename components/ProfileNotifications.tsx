// components/ProfileNotifications.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Animated, Easing } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { theme } from '../lib/theme';
import { Profile, REQUIRED_PROFILE_FIELDS, MIN_PROMPTS, MIN_PHOTOS } from '../lib/types';
import ProfileCompletionBadge from './ProfileCompletionBadge';

type ProfileNotificationsProps = {
  profile: Profile | null;
  userId: string;
  onNavigateToSection?: (section: string) => void;
};

type NotificationType = 'info' | 'warning' | 'success';
type Notification = {
  id: string;
  type: NotificationType;
  message: string;
  action?: string;
  section?: string;
};

const ProfileNotifications: React.FC<ProfileNotificationsProps> = ({
  profile,
  userId,
  onNavigateToSection,
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [lastEarnedBadge, setLastEarnedBadge] = useState<string | null>(null);
  const slideAnim = new Animated.Value(0);
  
  // Consulta para obtener conteos
  const { data: photosCount = 0 } = useQuery<number>({
    queryKey: ['photos_count', userId],
    queryFn: async () => {
      if (!userId) return 0;
      const { count, error } = await supabase
        .from('user_photos')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!userId,
  });

  const { data: promptsCount = 0 } = useQuery<number>({
    queryKey: ['prompts_count', userId],
    queryFn: async () => {
      if (!userId) return 0;
      const { count, error } = await supabase
        .from('profile_prompts')
        .select('*', { count: 'exact', head: true })
        .eq('profile_id', userId);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!userId,
  });

  // Función para generar notificaciones basadas en el estado del perfil
  useEffect(() => {
    if (!profile || !userId) return;
    
    const newNotifications: Notification[] = [];
    
    // Comprobar si falta información básica
    const missingFields = REQUIRED_PROFILE_FIELDS.filter(field => !profile[field as keyof Profile]);
    if (missingFields.length > 0) {
      const missingLabels = missingFields.map(field => {
        switch(field) {
          case 'display_name': return 'nombre';
          case 'bio': return 'biografía';
          case 'birthdate': return 'fecha de nacimiento';
          case 'gender': return 'género';
          default: return field;
        }
      });
      
      newNotifications.push({
        id: 'missing-basic-info',
        type: 'warning',
        message: `Completa tu ${missingLabels.join(', ')} para mejorar tu perfil.`,
        action: 'Completar',
        section: 'basic-info',
      });
    }
    
    // Comprobar fotos
    if (photosCount < MIN_PHOTOS) {
      newNotifications.push({
        id: 'missing-photos',
        type: 'warning',
        message: 'Añade al menos una foto para que otros usuarios puedan conocerte mejor.',
        action: 'Añadir fotos',
        section: 'photos',
      });
    }
    
    // Comprobar prompts
    if (promptsCount < MIN_PROMPTS) {
      const remaining = MIN_PROMPTS - promptsCount;
      newNotifications.push({
        id: 'missing-prompts',
        type: 'info',
        message: `Responde ${remaining} ${remaining === 1 ? 'pregunta más' : 'preguntas más'} para mostrar tu personalidad.`,
        action: 'Responder',
        section: 'prompts',
      });
    }
    
    // Notificación de bienvenida para perfiles nuevos
    if (missingFields.length > 0 && photosCount === 0 && promptsCount === 0) {
      newNotifications.push({
        id: 'welcome',
        type: 'info',
        message: '¡Bienvenido! Completa tu perfil para empezar a conectar con otros usuarios.',
        action: 'Empezar',
        section: 'profile-completion',
      });
    }
    
    // Comprobar si se ha alcanzado un nuevo nivel de insignia
    const completionScore = calculateCompletion();
    const badgeLevel = getBadgeLevel(completionScore);
    
    // Verificar el último nivel de insignia guardado en AsyncStorage
    // Nota: Esto normalmente usaría AsyncStorage pero por simplicidad lo simulamos
    const checkBadgeProgress = async () => {
      // Simulación de obtener el último nivel almacenado (sería de AsyncStorage)
      const storedLevel = localStorage.getItem('lastBadgeLevel') || '0';
      const previousLevel = parseInt(storedLevel);
      
      if (badgeLevel.min > previousLevel && badgeLevel.min >= 40) { // Solo notificar desde Bronce
        setLastEarnedBadge(badgeLevel.name);
        setShowModal(true);
        localStorage.setItem('lastBadgeLevel', String(badgeLevel.min));
      }
    };
    
    // Simular localStorage para este ejemplo
    const localStorage = {
      getItem: (_key: string) => null,
      setItem: (_key: string, _value: string) => {}
    };
    
    checkBadgeProgress();
    
    // Actualizar notificaciones
    setNotifications(newNotifications);
  }, [profile, userId, photosCount, promptsCount]);

  // Animar la aparición de notificaciones
  useEffect(() => {
    if (notifications.length > 0) {
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      slideAnim.setValue(0);
    }
  }, [notifications]);

  // Funciones auxiliares para calcular el nivel de insignia
  const calculateCompletion = () => {
    if (!profile) return 0;

    // Información básica (25%)
    const requiredFieldsCount = REQUIRED_PROFILE_FIELDS.length;
    const filledRequiredFields = REQUIRED_PROFILE_FIELDS.filter(
      field => !!profile[field as keyof Profile]
    ).length;
    const basicInfoScore = (filledRequiredFields / requiredFieldsCount) * 25;

    // Fotos (40%)
    const photosScore = Math.min(photosCount / MIN_PHOTOS, 3) * (40/3); // Máximo 3 fotos para 40%
    
    // Prompts (30%)
    const promptsScore = Math.min(promptsCount / MIN_PROMPTS, 1) * 30;
    
    // Verificación (5%)
    const verificationScore = profile.verified_at ? 5 : 0;

    return Math.min(Math.round(basicInfoScore + photosScore + promptsScore + verificationScore), 100);
  };

  const getBadgeLevel = (completionPercentage: number) => {
    const BADGE_LEVELS = [
      { min: 0, color: '#FF6B6B', name: 'Básico', icon: 'user' },
      { min: 40, color: '#FFD166', name: 'Bronce', icon: 'star-o' },
      { min: 70, color: '#4DD4A8', name: 'Plata', icon: 'star-half-o' },
      { min: 100, color: '#6E8BFF', name: 'Oro', icon: 'star' },
    ];

    for (let i = BADGE_LEVELS.length - 1; i >= 0; i--) {
      if (completionPercentage >= BADGE_LEVELS[i].min) {
        return BADGE_LEVELS[i];
      }
    }
    return BADGE_LEVELS[0];
  };

  // Handler para las acciones de las notificaciones
  const handleNotificationAction = (section?: string) => {
    if (section && onNavigateToSection) {
      onNavigateToSection(section);
    }
  };

  // Renderizado de una notificación individual
  const renderNotification = (notification: Notification, index: number) => {
    const iconName = 
      notification.type === 'warning' ? 'exclamation-circle' :
      notification.type === 'success' ? 'check-circle' : 'info-circle';
    
    const iconColor = 
      notification.type === 'warning' ? '#FFD166' :
      notification.type === 'success' ? '#4DD4A8' : '#6E8BFF';

    return (
      <Animated.View
        key={notification.id}
        style={[
          styles.notification,
          { transform: [{ translateX: slideAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [-300, 0],
          })}] },
        ]}
      >
        <View style={styles.notificationContent}>
          <FontAwesome name={iconName} size={20} color={iconColor} style={styles.notificationIcon} />
          <Text style={styles.notificationMessage}>{notification.message}</Text>
        </View>
        
        {notification.action && (
          <TouchableOpacity
            style={styles.notificationAction}
            onPress={() => handleNotificationAction(notification.section)}
          >
            <Text style={styles.actionText}>{notification.action}</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    );
  };

  // Modal de celebración por nueva insignia
  const renderBadgeModal = () => (
    <Modal
      visible={showModal && !!lastEarnedBadge}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.badgeContainer}>
            {profile && (
              <ProfileCompletionBadge
                profile={profile}
                userId={userId}
                size="large"
                showLabel={false}
              />
            )}
          </View>
          
          <Text style={styles.congratsTitle}>¡Enhorabuena!</Text>
          <Text style={styles.congratsText}>
            Has alcanzado el nivel <Text style={styles.badgeName}>{lastEarnedBadge}</Text>
          </Text>
          <Text style={styles.congratsSubtext}>
            Sigue completando tu perfil para desbloquear más insignias.
          </Text>
          
          <TouchableOpacity
            style={styles.modalButton}
            onPress={() => setShowModal(false)}
          >
            <Text style={styles.modalButtonText}>¡Genial!</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // Si no hay notificaciones, no renderizamos nada
  if (notifications.length === 0) {
    return <>{showModal && renderBadgeModal()}</>;
  }

  return (
    <View style={styles.container}>
      {notifications.map(renderNotification)}
      {showModal && renderBadgeModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  notification: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius,
    marginBottom: 8,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
    flexDirection: 'row',
    justifyContent: 'center', // Centrado horizontalmente
    alignItems: 'center',
    width: '100%', // Aseguramos que tome todo el ancho disponible
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center', // Centrado del contenido
    flex: 1,
  },
  notificationIcon: {
    marginRight: 10,
  },
  notificationMessage: {
    color: theme.colors.text,
    flex: 1,
  },
  notificationAction: {
    padding: 8,
    borderRadius: theme.radius / 2,
    backgroundColor: theme.colors.primary + '20',
  },
  actionText: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius,
    padding: 20,
    alignItems: 'center',
    width: '90%',
    maxWidth: 320,
  },
  badgeContainer: {
    marginVertical: 20,
  },
  congratsTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 10,
  },
  congratsText: {
    fontSize: 16,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  congratsSubtext: {
    fontSize: 14,
    color: theme.colors.subtext,
    textAlign: 'center',
    marginBottom: 20,
  },
  badgeName: {
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  modalButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: theme.radius,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  modalButtonText: {
    color: theme.colors.primaryText,
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default ProfileNotifications;