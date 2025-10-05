// components/ProfileCompletion.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Profile, REQUIRED_PROFILE_FIELDS, MIN_PROMPTS, MIN_PHOTOS } from '../lib/types';
import { theme } from '../lib/theme';

type CompletionItemProps = {
  label: string;
  isComplete: boolean;
  completionText: string;
  onAction?: () => void;
  actionLabel?: string;
};

const CompletionItem: React.FC<CompletionItemProps> = ({ 
  label, 
  isComplete, 
  completionText,
  onAction,
  actionLabel
}) => {
  return (
    <View style={styles.completionItem}>
      <View style={styles.completionHeader}>
        <Text style={styles.completionLabel}>{label}</Text>
        <View
          style={[
            styles.completionStatus,
            { backgroundColor: isComplete ? theme.colors.positive : '#FFB347' },
          ]}
        >
          <Text style={styles.completionStatusText}>
            {isComplete ? 'Completo' : 'Pendiente'}
          </Text>
        </View>
      </View>
      <Text style={styles.completionText}>{completionText}</Text>
      
      {!isComplete && onAction && actionLabel && (
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={onAction}
        >
          <Text style={styles.actionButtonText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

type ProfileCompletionProps = {
  profile: Profile | null;
  onNavigateToSection?: (section: string) => void;
};

const ProfileCompletion: React.FC<ProfileCompletionProps> = ({ profile, onNavigateToSection }) => {
  const { data: photosCount } = useQuery<number>({
    queryKey: ['photos_count', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return 0;
      const { count, error } = await supabase
        .from('user_photos')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!profile?.id,
  });

  const { data: prompts } = useQuery({
    queryKey: ['profile_prompts', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      try {
        const { data, error } = await supabase
          .from('profile_prompts')
          .select('*, profile_prompt_templates(question)')
          .eq('profile_id', profile.id);
        
        if (error) {
          console.error('Error al cargar prompts:', error);
          return [];
        }
        
        return data.map(prompt => ({
          ...prompt,
          question: prompt.profile_prompt_templates?.question
        }));
      } catch (err) {
        console.error('Error en la consulta de prompts:', err);
        return [];
      }
    },
    enabled: !!profile?.id,
  });

  if (!profile) {
    return null;
  }

  // Calcular completitud de información básica
  const missingFields = REQUIRED_PROFILE_FIELDS.filter(field => !profile[field as keyof Profile]);
  const basicInfoComplete = missingFields.length === 0;
  
  // Verificar completitud de fotos
  const photosComplete = (photosCount || 0) >= MIN_PHOTOS;
  
  // Verificar completitud de prompts
  const promptsComplete = (prompts?.length || 0) >= MIN_PROMPTS;
  
  // Calcular porcentaje total de completitud
  const totalItems = 3; // Información básica, fotos, prompts
  const completedItems = 
    (basicInfoComplete ? 1 : 0) + 
    (photosComplete ? 1 : 0) + 
    (promptsComplete ? 1 : 0);
  
  const completionPercentage = Math.floor((completedItems / totalItems) * 100);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Completitud del perfil</Text>
        <Text style={styles.percentage}>{completionPercentage}%</Text>
      </View>
      
      <View style={styles.progressBar}>
        <View 
          style={[
            styles.progressFill, 
            { width: `${completionPercentage}%` }
          ]} 
        />
      </View>
      
      <View style={styles.completionItems}>
        <CompletionItem
          label="Información básica"
          isComplete={basicInfoComplete}
          completionText={
            basicInfoComplete
              ? "Toda la información básica está completa."
              : `Falta: ${missingFields.map(field => {
                  switch(field) {
                    case 'display_name': return 'nombre';
                    case 'bio': return 'biografía';
                    case 'birthdate': return 'fecha de nacimiento';
                    case 'gender': return 'género';
                    default: return field;
                  }
                }).join(', ')}`
          }
          onAction={onNavigateToSection ? () => onNavigateToSection('basic-info') : undefined}
          actionLabel="Completar información"
        />
        
        <CompletionItem
          label="Fotos"
          isComplete={photosComplete}
          completionText={
            photosComplete
              ? `Tienes ${photosCount} ${photosCount === 1 ? 'foto' : 'fotos'}.`
              : `Añade al menos ${MIN_PHOTOS} ${MIN_PHOTOS === 1 ? 'foto' : 'fotos'} a tu perfil.`
          }
          onAction={onNavigateToSection ? () => onNavigateToSection('photos') : undefined}
          actionLabel="Añadir fotos"
        />
        
        <CompletionItem
          label="Prompts"
          isComplete={promptsComplete}
          completionText={
            promptsComplete
              ? `Tienes ${prompts?.length || 0} prompts respondidos.`
              : `Responde al menos ${MIN_PROMPTS} preguntas para que otros te conozcan mejor.`
          }
          onAction={onNavigateToSection ? () => onNavigateToSection('prompts') : undefined}
          actionLabel="Responder preguntas"
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  percentage: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  progressBar: {
    height: 8,
    backgroundColor: theme.colors.border,
    borderRadius: 4,
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
  },
  completionItems: {
    gap: 12,
  },
  completionItem: {
    gap: 4,
  },
  completionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  completionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  completionStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  completionStatusText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: 'white',
  },
  completionText: {
    fontSize: 14,
    color: theme.colors.subtext,
    flexWrap: 'wrap',
    paddingRight: 8,
  },
  actionButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: theme.radius,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  actionButtonText: {
    color: theme.colors.white,
    fontWeight: '600',
    fontSize: 14,
  },
});

export default ProfileCompletion;