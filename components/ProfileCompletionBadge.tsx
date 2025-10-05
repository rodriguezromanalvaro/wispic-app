// components/ProfileCompletionBadge.tsx
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Easing, TouchableOpacity } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Profile, REQUIRED_PROFILE_FIELDS, MIN_PROMPTS, MIN_PHOTOS } from '../lib/types';
import { theme } from '../lib/theme';

type ProfileCompletionBadgeProps = {
  profile: Profile;
  userId: string;
  onPress?: () => void;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
};

// Definimos los tipos explícitamente
type BadgeIcon = 'user' | 'star-o' | 'star-half-o' | 'star';
type BadgeLevel = {
  min: number;
  color: string;
  name: string;
  icon: BadgeIcon;
};

const BADGE_LEVELS: BadgeLevel[] = [
  { min: 0, color: '#FF6B6B', name: 'Básico', icon: 'user' },
  { min: 40, color: '#FFD166', name: 'Bronce', icon: 'star-o' },
  { min: 70, color: '#4DD4A8', name: 'Plata', icon: 'star-half-o' },
  { min: 100, color: '#6E8BFF', name: 'Oro', icon: 'star' },
];

const ProfileCompletionBadge: React.FC<ProfileCompletionBadgeProps> = ({
  profile,
  userId,
  onPress,
  size = 'medium',
  showLabel = true,
}) => {
  // Animación para el círculo de progreso
  const progressAnimation = new Animated.Value(0);
  
  // Obtener el conteo de fotos
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

  // Obtener el conteo de prompts
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

  // Calcular la completitud del perfil
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

  const completionPercentage = calculateCompletion();
  
  // Determinar el nivel de la insignia
  const getBadgeLevel = () => {
    for (let i = BADGE_LEVELS.length - 1; i >= 0; i--) {
      if (completionPercentage >= BADGE_LEVELS[i].min) {
        return BADGE_LEVELS[i];
      }
    }
    return BADGE_LEVELS[0];
  };
  
  const badgeLevel = getBadgeLevel();

  // Animar el progreso
  useEffect(() => {
    Animated.timing(progressAnimation, {
      toValue: completionPercentage / 100,
      duration: 1000,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [completionPercentage]);

  // Tamaños según la prop size
  const getBadgeSize = () => {
    switch (size) {
      case 'small':
        return { width: 40, height: 40, iconSize: 16, fontSize: 10 };
      case 'large':
        return { width: 80, height: 80, iconSize: 32, fontSize: 14 };
      default: // medium
        return { width: 60, height: 60, iconSize: 24, fontSize: 12 };
    }
  };

  const badgeSize = getBadgeSize();

  // Crear una representación visual simplificada del círculo de progreso
  const renderProgressCircle = () => {
    const segments = 36; // Número de segmentos para simular el círculo
    const completedSegments = Math.floor((completionPercentage / 100) * segments);
    const segmentSize = 360 / segments;
    
    return (
      <View style={styles.circleProgress}>
        {Array.from({ length: segments }).map((_, i) => {
          const isCompleted = i < completedSegments;
          const angle = i * segmentSize;
          
          return (
            <View
              key={i}
              style={[
                styles.progressSegment,
                {
                  backgroundColor: isCompleted ? badgeLevel.color : 'rgba(255,255,255,0.1)',
                  transform: [
                    { rotate: `${angle}deg` },
                    { translateY: -badgeSize.height / 2 + 2 },
                  ],
                  height: badgeSize.height / 2 - 4,
                  width: 3,
                },
              ]}
            />
          );
        })}
      </View>
    );
  };

  return (
    <TouchableOpacity
      style={[styles.container, { width: badgeSize.width }]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={[styles.badge, { width: badgeSize.width, height: badgeSize.height }]}>
        {/* Círculo de fondo */}
        <View
          style={[
            styles.circleBackground,
            { width: badgeSize.width, height: badgeSize.height },
          ]}
        />
        
        {/* Círculo de progreso */}
        {renderProgressCircle()}
        
        {/* Icono */}
        <View style={styles.iconContainer}>
          <FontAwesome name={badgeLevel.icon} size={badgeSize.iconSize} color={badgeLevel.color} />
        </View>
      </View>
      
      {showLabel && (
        <View style={styles.labelContainer}>
          <Text style={[styles.percentage, { fontSize: badgeSize.fontSize }]}>
            {completionPercentage}%
          </Text>
          <Text style={[styles.badgeName, { fontSize: badgeSize.fontSize, color: badgeLevel.color }]}>
            {badgeLevel.name}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  badge: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 100,
    overflow: 'hidden',
  },
  circleBackground: {
    position: 'absolute',
    borderRadius: 1000,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  circleProgress: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressSegment: {
    position: 'absolute',
    borderRadius: 1,
    top: '50%',
    left: '50%',
    marginLeft: -1.5,
    transformOrigin: 'bottom',
  },
  iconContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelContainer: {
    marginTop: 4,
    alignItems: 'center',
  },
  percentage: {
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  badgeName: {
    fontWeight: '500',
    marginTop: 2,
  },
});

export default ProfileCompletionBadge;