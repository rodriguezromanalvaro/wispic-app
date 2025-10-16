import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { supabase } from '../lib/supabase';
import { theme } from '../lib/theme';
import { Card } from '../components/ui';
// Nota: Para la implementación completa, instalar: npm install react-native-svg react-native-circular-progress-indicator
// Por ahora usaremos un componente simplificado

// Componente simplificado de progreso circular
interface AnimatedCircularProgressProps {
  size: number;
  width: number;
  fill: number;
  tintColor: string;
  backgroundColor: string;
  rotation: number;
  children: (fill: number) => React.ReactNode;
}

const AnimatedCircularProgress: React.FC<AnimatedCircularProgressProps> = ({
  size,
  width,
  fill,
  tintColor,
  backgroundColor,
  children
}) => {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: width,
        borderColor: backgroundColor,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative'
      }}
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: width,
          borderColor: tintColor,
          borderLeftColor: fill < 50 ? backgroundColor : tintColor,
          borderRightColor: fill < 100 ? backgroundColor : tintColor,
          borderTopColor: fill < 75 ? backgroundColor : tintColor,
          position: 'absolute',
          transform: [{ rotate: `${fill * 3.6}deg` }]
        }}
      />
      {children(fill)}
    </View>
  );
};

interface ProfileStatsProps {
  userId: string;
}

interface UserStats {
  totalMatches: number;
  totalLikes: number;
  totalViews: number;
  profileRank: number;
  weeklyActivity: number;
}

const ProfileStats: React.FC<ProfileStatsProps> = ({ userId }) => {
  const [stats, setStats] = useState<UserStats>({
    totalMatches: 0,
    totalLikes: 0,
    totalViews: 0,
    profileRank: 0,
    weeklyActivity: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    async function fetchStats() {
      try {
        setLoading(true);
        
        // Obtener datos reales de la base de datos
        // Consulta para matches (conexiones mutuas)
        const { count: matchesCount, error: matchesError } = await supabase
          .from('connections')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('is_mutual', true);
          
        if (matchesError) console.error('Error fetching matches:', matchesError);
        
        // Consulta para likes recibidos
        const { count: likesCount, error: likesError } = await supabase
          .from('connections')
          .select('*', { count: 'exact', head: true })
          .eq('target_user_id', userId);
          
        if (likesError) console.error('Error fetching likes:', likesError);
        
        // Consulta para vistas al perfil
        const { count: viewsCount, error: viewsError } = await supabase
          .from('profile_views')
          .select('*', { count: 'exact', head: true })
          .eq('viewed_user_id', userId);
          
        if (viewsError) console.error('Error fetching views:', viewsError);
        
        // Si alguna de las tablas no existe, usamos valores por defecto
        const totalMatches = matchesCount || 0;
        const totalLikes = likesCount || 0;
        const totalViews = viewsCount || 0;
        
        // Calcular rank y actividad basado en datos reales
        // Esto es un cálculo simple, en producción sería más sofisticado
        const profileRank = totalLikes > 0 ? Math.min(100, Math.max(1, Math.floor((totalMatches / totalLikes) * 100))) : 50;
        const weeklyActivity = Math.min(100, Math.max(1, (totalMatches + totalLikes + totalViews) / 10));
        
        setStats({
          totalMatches: totalMatches,
          totalLikes: totalLikes,
          totalViews: totalViews,
          profileRank: profileRank,
          weeklyActivity: weeklyActivity,
        });
      } catch (error) {
        console.error('Error fetching user stats:', error);
        // En caso de error, usar datos por defecto
        setStats({
          totalMatches: 0,
          totalLikes: 0,
          totalViews: 0,
          profileRank: 50,
          weeklyActivity: 0,
        });
      } finally {
        setLoading(false);
      }
    }

    if (userId) {
      fetchStats();
    }
  }, [userId]);

  const toggleDetails = () => {
    setShowDetails(!showDetails);
  };

  if (loading) {
    return (
      <Card style={styles.container}>
        <Text style={styles.title}>Estadísticas del perfil</Text>
        <Text style={styles.loadingText}>Cargando estadísticas...</Text>
      </Card>
    );
  }

  return (
    <Card style={styles.container}>
      <TouchableOpacity onPress={toggleDetails} style={styles.header}>
        <Text style={styles.title}>Estadísticas del perfil</Text>
        <Text style={styles.toggleText}>{showDetails ? 'Ocultar' : 'Mostrar'}</Text>
      </TouchableOpacity>

      {showDetails ? (
        <View style={styles.statsContainer}>
          <View style={styles.statsRow}>
            <StatItem 
              title="Matches" 
              value={stats.totalMatches} 
              icon="💖" 
              color={theme.colors.primary} 
            />
            <StatItem 
              title="Likes" 
              value={stats.totalLikes} 
              icon="👍" 
              color={theme.colors.positive} 
            />
            <StatItem 
              title="Vistas" 
              value={stats.totalViews} 
              icon="👀" 
              color={theme.colors.danger} 
            />
          </View>
          
          <View style={styles.rankContainer}>
            <Text style={styles.rankTitle}>Actividad semanal</Text>
            <AnimatedCircularProgress
              size={80}
              width={8}
              fill={stats.weeklyActivity}
              tintColor={theme.colors.primary}
              backgroundColor={theme.colors.border}
              rotation={0}
            >
              {(fill) => (
                <Text style={styles.progressText}>
                  {`${Math.round(fill)}%`}
                </Text>
              )}
            </AnimatedCircularProgress>
          </View>
          
          <View style={styles.rankInfoContainer}>
            <Text style={styles.rankInfoText}>
              Tu perfil está en el <Text style={styles.rankHighlight}>top {stats.profileRank}%</Text> de perfiles activos esta semana.
            </Text>
            <Text style={styles.tipText}>
              Consejo: Actualiza tu perfil regularmente y responde a mensajes para aumentar tu visibilidad.
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.previewContainer}>
          <Text style={styles.previewText}>
            {stats.totalMatches} matches · {stats.totalLikes} likes · {stats.totalViews} vistas
          </Text>
        </View>
      )}
    </Card>
  );
};

interface StatItemProps {
  title: string;
  value: number;
  icon: string;
  color: string;
}

const StatItem: React.FC<StatItemProps> = ({ title, value, icon, color }) => (
  <View style={styles.statItem}>
    <Text style={styles.statIcon}>{icon}</Text>
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    <Text style={styles.statTitle}>{title}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    padding: theme.spacing(1),
    marginHorizontal: theme.spacing(1),
    marginTop: theme.spacing(1),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing(1),
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
  },
  toggleText: {
    fontSize: 14,
    color: theme.colors.primary,
  },
  loadingText: {
    fontSize: 14,
    color: theme.colors.subtext,
    marginTop: theme.spacing(1),
  },
  statsContainer: {
    marginTop: theme.spacing(1),
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: theme.spacing(2),
  },
  statItem: {
    alignItems: 'center',
  },
  statIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  statTitle: {
    fontSize: 12,
    color: theme.colors.subtext,
  },
  previewContainer: {
    marginTop: theme.spacing(0.5),
  },
  previewText: {
    fontSize: 14,
    color: theme.colors.subtext,
  },
  rankContainer: {
    alignItems: 'center',
    marginVertical: theme.spacing(1),
  },
  rankTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: theme.spacing(1),
    color: theme.colors.text,
  },
  progressText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  rankInfoContainer: {
    marginTop: theme.spacing(1),
    padding: theme.spacing(1),
    backgroundColor: theme.colors.border,
    borderRadius: theme.spacing(0.5),
  },
  rankInfoText: {
    fontSize: 14,
    color: theme.colors.text,
    lineHeight: 20,
  },
  rankHighlight: {
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  tipText: {
    fontSize: 13,
    color: theme.colors.subtext,
    marginTop: theme.spacing(1),
    fontStyle: 'italic',
  },
});

export default ProfileStats;