import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList } from 'react-native';
import { supabase } from '../lib/supabase';
import { theme } from '../lib/theme';
import { Card, Button } from './ui';

interface ProfileAchievementsProps {
  userId: string;
}

// Definición del tipo de logro
interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string; // URL o nombre del icono
  unlocked: boolean;
  progress?: number; // Porcentaje completado (0-100)
  rewardType?: string; // 'badge', 'boost', etc.
  rewardValue?: string; // Valor o descripción de la recompensa
}

const ProfileAchievements: React.FC<ProfileAchievementsProps> = ({ userId }) => {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    async function fetchAchievements() {
      try {
        setLoading(true);
        
        // Intentar obtener logros reales de la base de datos
        const { data: userAchievements, error: achievementsError } = await supabase
          .from('user_achievements')
          .select('*, achievement_templates(*)')
          .eq('user_id', userId);
        
        if (achievementsError) {
          console.error('Error al cargar logros:', achievementsError);
          // Usar datos de ejemplo si hay error
          const demoAchievements = [
            {
              id: '1',
              title: 'Perfil completado',
              description: 'Completar todos los campos de tu perfil',
              icon: '🌟',
              unlocked: false,
              progress: 0,
              rewardType: 'boost',
              rewardValue: 'Incremento de visibilidad 24h'
            },
            {
              id: '2',
              title: 'Fotogénico',
              description: 'Subir fotos de alta calidad',
              icon: '📸',
              unlocked: false,
              progress: 0,
              rewardType: 'badge',
              rewardValue: 'Badge exclusivo en tu perfil'
            },
            {
              id: '3',
              title: 'Conversador',
              description: 'Iniciar 10 conversaciones',
              icon: '💬',
              unlocked: true,
              progress: 100,
              rewardType: 'feature',
              rewardValue: 'Indicador "Responde rápido" en tu perfil'
            },
            {
              id: '5',
              title: 'Influencer',
              description: 'Conseguir 5 recomendaciones de otros usuarios',
              icon: '🏆',
              unlocked: false,
              progress: 20,
              rewardType: 'boost',
              rewardValue: 'Prioridad en resultados de búsqueda'
            }
          ];
          setAchievements(demoAchievements);
          setLoading(false);
          return;
        }
        
        // Transformar los datos de la base de datos al formato esperado
        if (userAchievements && userAchievements.length > 0) {
          const mappedAchievements = userAchievements.map(achievement => {
            const template = achievement.achievement_templates;
            return {
              id: achievement.achievement_id,
              title: template?.title || 'Logro sin título',
              description: template?.description || '',
              icon: template?.icon || '🏆',
              unlocked: achievement.progress >= 100,
              progress: achievement.progress || 0,
              rewardType: template?.reward_type,
              rewardValue: template?.reward_value
            };
          });
          setAchievements(mappedAchievements);
        } else {
          // Si no hay logros, mostrar algunos ejemplos
          setAchievements([
            {
              id: '1',
              title: 'Perfil completado',
              description: 'Completar todos los campos de tu perfil',
              icon: '🌟',
              unlocked: false,
              progress: 0,
              rewardType: 'boost',
              rewardValue: 'Incremento de visibilidad 24h'
            },
            {
              id: '2',
              title: 'Fotogénico',
              description: 'Subir fotos de alta calidad',
              icon: '📸',
              unlocked: false,
              progress: 0,
              rewardType: 'badge',
              rewardValue: 'Badge exclusivo en tu perfil'
            }
          ]);
        }
        setLoading(false);
      } catch (error) {
        console.error('Error fetching achievements:', error);
        setLoading(false);
      }
    }

    if (userId) {
      fetchAchievements();
    }
  }, [userId]);

  const openAchievementDetails = (achievement: Achievement) => {
    setSelectedAchievement(achievement);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
  };

  const renderAchievement = ({ item }: { item: Achievement }) => (
    <TouchableOpacity 
      style={[
        styles.achievementItem, 
        item.unlocked ? styles.achievementUnlocked : styles.achievementLocked
      ]} 
      onPress={() => openAchievementDetails(item)}
    >
      <Text style={styles.achievementIcon}>{item.icon}</Text>
      <View style={styles.achievementInfo}>
        <Text style={styles.achievementTitle}>{item.title}</Text>
        <View style={styles.progressBarContainer}>
          <View 
            style={[
              styles.progressBar, 
              { width: `${item.progress || 0}%` }
            ]} 
          />
        </View>
        <Text style={styles.progressText}>{item.progress || 0}%</Text>
      </View>
      {item.unlocked && (
        <View style={styles.unlockedBadge}>
          <Text style={styles.unlockedText}>✓</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <Card style={styles.container}>
        <Text style={styles.title}>Logros y recompensas</Text>
        <Text style={styles.loadingText}>Cargando logros...</Text>
      </Card>
    );
  }

  return (
    <Card style={styles.container}>
      <Text style={styles.title}>Logros y recompensas</Text>
      <Text style={styles.subtitle}>
        Completa acciones para desbloquear beneficios exclusivos
      </Text>

      <FlatList
        data={achievements}
        renderItem={renderAchievement}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.achievementsList}
        horizontal={false}
        scrollEnabled={false}
      />

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={closeModal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            {selectedAchievement && (
              <>
                <Text style={styles.modalIcon}>{selectedAchievement.icon}</Text>
                <Text style={styles.modalTitle}>{selectedAchievement.title}</Text>
                <Text style={styles.modalDescription}>
                  {selectedAchievement.description}
                </Text>
                
                <View style={styles.modalProgressContainer}>
                  <View style={styles.modalProgressBarContainer}>
                    <View 
                      style={[
                        styles.modalProgressBar, 
                        { width: `${selectedAchievement.progress || 0}%` }
                      ]} 
                    />
                  </View>
                  <Text style={styles.modalProgressText}>
                    {selectedAchievement.progress || 0}% completado
                  </Text>
                </View>

                {selectedAchievement.unlocked ? (
                  <View style={styles.rewardContainer}>
                    <Text style={styles.rewardTitle}>Recompensa desbloqueada:</Text>
                    <Text style={styles.rewardValue}>
                      {selectedAchievement.rewardValue}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.rewardContainer}>
                    <Text style={styles.rewardPending}>
                      Completa este logro para obtener:
                    </Text>
                    <Text style={styles.rewardValue}>
                      {selectedAchievement.rewardValue}
                    </Text>
                  </View>
                )}

                <Button 
                  title="Cerrar" 
                  onPress={closeModal} 
                  style={styles.closeButton}
                />
              </>
            )}
          </View>
        </View>
      </Modal>
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: theme.spacing(1),
    marginHorizontal: theme.spacing(1),
    marginTop: theme.spacing(1),
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing(0.5),
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.subtext,
    marginBottom: theme.spacing(1.5),
  },
  loadingText: {
    fontSize: 14,
    color: theme.colors.subtext,
    marginTop: theme.spacing(1),
  },
  achievementsList: {
    gap: theme.spacing(1),
  },
  achievementItem: {
    flexDirection: 'row',
    padding: theme.spacing(1),
    borderRadius: theme.radius,
    alignItems: 'center',
    backgroundColor: theme.colors.border,
  },
  achievementUnlocked: {
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary,
  },
  achievementLocked: {
    opacity: 0.7,
  },
  achievementIcon: {
    fontSize: 24,
    marginRight: theme.spacing(1),
  },
  achievementInfo: {
    flex: 1,
  },
  achievementTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: theme.colors.bg,
    borderRadius: 3,
    overflow: 'hidden',
    marginVertical: 4,
  },
  progressBar: {
    height: '100%',
    backgroundColor: theme.colors.primary,
  },
  progressText: {
    fontSize: 12,
    color: theme.colors.subtext,
  },
  unlockedBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unlockedText: {
    color: theme.colors.white,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalContent: {
    width: '80%',
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius,
    padding: theme.spacing(2),
    alignItems: 'center',
  },
  modalIcon: {
    fontSize: 48,
    marginBottom: theme.spacing(1),
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing(1),
    textAlign: 'center',
  },
  modalDescription: {
    fontSize: 16,
    color: theme.colors.subtext,
    marginBottom: theme.spacing(2),
    textAlign: 'center',
  },
  modalProgressContainer: {
    width: '100%',
    marginBottom: theme.spacing(2),
  },
  modalProgressBarContainer: {
    height: 8,
    backgroundColor: theme.colors.bg,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: theme.spacing(0.5),
  },
  modalProgressBar: {
    height: '100%',
    backgroundColor: theme.colors.primary,
  },
  modalProgressText: {
    fontSize: 14,
    color: theme.colors.subtext,
    textAlign: 'center',
  },
  rewardContainer: {
    width: '100%',
    padding: theme.spacing(1),
    backgroundColor: theme.colors.border,
    borderRadius: theme.radius,
    marginBottom: theme.spacing(2),
    alignItems: 'center',
  },
  rewardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.primary,
    marginBottom: theme.spacing(0.5),
  },
  rewardPending: {
    fontSize: 14,
    color: theme.colors.subtext,
    marginBottom: theme.spacing(0.5),
  },
  rewardValue: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  closeButton: {
    marginTop: theme.spacing(1),
    width: '50%',
  },
});

export default ProfileAchievements;