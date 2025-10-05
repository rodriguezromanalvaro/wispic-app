import React, { useRef, useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Animated, 
  PanResponder, 
  Dimensions, 
  Image,
  TouchableOpacity,
  ActivityIndicator,
  ImageBackground
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/useAuth';
import { Screen } from '../../../components/ui';
import TopBar from '../../../components/TopBar';
import { theme } from '../../../lib/theme';
import { canSuperlike, incSuperlike, remainingSuperlikes } from '../../../lib/superlikes';
import { ensureMatchConsistency } from '../../../lib/match';
import { FilterState, Profile, Status } from '../../../lib/types';
import { usePremiumStore } from '../../../lib/premium';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Ionicons, MaterialCommunityIcons, FontAwesome } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');
const CARD_WIDTH = width * 0.9;
const CARD_HEIGHT = height * 0.7;
const SWIPE_THRESHOLD = 120;

export default function TinderStyleFeed() {
  const { eventId, source } = useLocalSearchParams<{ eventId: string; source?: string }>();
  const eid = Number(eventId);
  const router = useRouter();
  const { user } = useAuth();
  const qc = useQueryClient();

  // premium via store
  const { isPremium } = usePremiumStore();
  
  // Card animation state
  const position = useRef(new Animated.ValueXY()).current;
  const rotate = position.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD * 2, 0, SWIPE_THRESHOLD * 2],
    outputRange: ['-30deg', '0deg', '30deg'],
    extrapolate: 'clamp',
  });
  const likeOpacity = position.x.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const dislikeOpacity = position.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const nextCardScale = position.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD * 2, 0, SWIPE_THRESHOLD * 2],
    outputRange: [1, 0.9, 1],
    extrapolate: 'clamp',
  });

  // estado local (optimista) por usuario
  const [currentIndex, setCurrentIndex] = useState(0);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [processing, setProcessing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
  // filtros
  const [minAge, setMinAge] = useState<string>('');
  const [maxAge, setMaxAge] = useState<string>('');
  const [gender, setGender] = useState<'any' | 'male' | 'female' | 'other'>('any');
  const [interest, setInterest] = useState<string>('');
  
  // Superlike counter
  const { data: remaining = 0, refetch: refetchRemaining } = useQuery({
    enabled: !!user,
    queryKey: ['superlikes-remaining', user?.id],
    queryFn: async () => remainingSuperlikes(user!.id, 3),
  });

  // título del evento
  const { data: eventTitle } = useQuery<string | null>({
    queryKey: ['event-title', eid],
    queryFn: async () => {
      const { data } = await supabase.from('events').select('title').eq('id', eid).maybeSingle();
      return (data?.title as string) ?? null;
    },
  });

  // dataset principal
  const { data, isLoading, error, refetch } = useQuery({
    enabled: !!user,
    queryKey: ['feed-by-event', eid, user?.id],
    queryFn: async () => {
      // asistentes (excluyéndome)
      const { data: att } = await supabase
        .from('event_attendance')
        .select('user_id')
        .eq('event_id', eid)
        .eq('status', 'going');

      const ids = (att || []).map((a: any) => a.user_id).filter((id: string) => id !== user!.id);

      const { data: profsRaw } = await supabase
        .from('profiles')
        .select('id, display_name, calculated_age:age, gender, interests, bio, city, avatar_url')
        .in('id', ids);
      
      const profs: Profile[] = (profsRaw || []).map((r: any) => ({
        id: r.id,
        display_name: r.display_name ?? null,
        bio: r.bio ?? null,
        avatar_url: r.avatar_url ?? null,
        age: typeof r.calculated_age === 'number' ? r.calculated_age : r.calculated_age ?? null,
        gender: r.gender ?? null,
        interests: r.interests ?? null,
        city: r.city ?? null,
      }));

      // Obtener relaciones existentes
      const { data: likes } = await supabase
        .from('likes')
        .select('target_id, type')
        .eq('source_id', user!.id)
        .in('target_id', ids);

      // Construir sets de relaciones
      const likeSet = new Set((likes || [])
        .filter((l: any) => l.type === 'like')
        .map((l: any) => l.target_id));
      
      const superlikeSet = new Set((likes || [])
        .filter((l: any) => l.type === 'superlike')
        .map((l: any) => l.target_id));
      
      const passSet = new Set((likes || [])
        .filter((l: any) => l.type === 'pass')
        .map((l: any) => l.target_id));
      
      const boostSet = new Set((await supabase
        .from('likes')
        .select('source_id')
        .eq('target_id', user!.id)
        .in('source_id', ids)
        .eq('type', 'superlike'))
        .data?.map((l: any) => l.source_id) || []);

      return { profs, likeSet, superlikeSet, passSet, boostSet };
    },
  });

  // Filtrar perfiles disponibles
  useEffect(() => {
    if (!data || !data.profs) return;

    const filtered = data.profs.filter(p => {
      // Filtro de tipo/género
      if (gender !== 'any' && p.gender !== gender) return false;
      
      // Filtro de edad mínima
      const min = parseInt(minAge, 10);
      if (!isNaN(min) && p.age !== null && p.age < min) return false;
      
      // Filtro de edad máxima
      const max = parseInt(maxAge, 10);
      if (!isNaN(max) && p.age !== null && p.age > max) return false;
      
      // Filtro de intereses
      if (interest.trim() && p.interests) {
        const terms = interest.toLowerCase().split(',').map(t => t.trim()).filter(Boolean);
        const pInterests = p.interests.map(i => i.toLowerCase());
        if (terms.length && !terms.some(term => pInterests.some(i => i.includes(term)))) return false;
      }
      
      // Excluir perfiles ya procesados
      if (
        data.likeSet.has(p.id) ||
        data.superlikeSet.has(p.id) ||
        data.passSet.has(p.id)
      ) {
        return false;
      }

      return true;
    });

    setProfiles(filtered);
    setCurrentIndex(0);
  }, [data, minAge, maxAge, gender, interest]);

  // PanResponder for swipe gestures
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gesture) => {
        position.setValue({ x: gesture.dx, y: gesture.dy });
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > SWIPE_THRESHOLD) {
          swipeRight();
        } else if (gesture.dx < -SWIPE_THRESHOLD) {
          swipeLeft();
        } else {
          resetPosition();
        }
      },
    })
  ).current;

  const resetPosition = () => {
    Animated.spring(position, {
      toValue: { x: 0, y: 0 },
      friction: 5,
      useNativeDriver: true,
    }).start();
  };

  const swipeRight = async () => {
    if (profiles.length <= currentIndex || processing) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    Animated.timing(position, {
      toValue: { x: width + 100, y: 0 },
      duration: 300,
      useNativeDriver: true,
    }).start(async () => {
      await processAction('like', profiles[currentIndex].id);
      position.setValue({ x: 0, y: 0 });
      setCurrentIndex(currentIndex + 1);
    });
  };

  const swipeLeft = async () => {
    if (profiles.length <= currentIndex || processing) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    Animated.timing(position, {
      toValue: { x: -width - 100, y: 0 },
      duration: 300,
      useNativeDriver: true,
    }).start(async () => {
      await processAction('pass', profiles[currentIndex].id);
      position.setValue({ x: 0, y: 0 });
      setCurrentIndex(currentIndex + 1);
    });
  };

  const superLike = async () => {
    if (profiles.length <= currentIndex || processing) return;
    
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    Animated.sequence([
      Animated.timing(position, {
        toValue: { x: 0, y: -height - 100 },
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(async () => {
      await processAction('superlike', profiles[currentIndex].id);
      position.setValue({ x: 0, y: 0 });
      setCurrentIndex(currentIndex + 1);
    });
  };

  const processAction = async (type: Status, targetId: string) => {
    if (processing) return;
    
    try {
      setProcessing(true);
      
      if (type === 'superlike') {
        const canSL = await canSuperlike(user!.id, 3);
        if (!canSL && !isPremium) {
          // Mostrar diálogo o paywall
          return;
        }
        await incSuperlike(user!.id);
        await refetchRemaining();
      }
      
      // Insertar en likes
      await supabase.from('likes').upsert({
        source_id: user!.id,
        target_id: targetId,
        type,
        created_at: new Date().toISOString(),
      });
      
      // Si hay like o superlike, verificar match
      if (type === 'like' || type === 'superlike') {
        const { matched, matchId } = await ensureMatchConsistency(user!.id, targetId);
        
        if (matched && matchId) {
          // Mostrar pantalla de match
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          showMatchAnimation(matchId, targetId);
        }
      }
      
      // Invalidar queries para refrescar datos
      qc.invalidateQueries({ queryKey: ['feed-by-event', eid] });
      
    } catch (error) {
      console.error('Error al procesar acción:', error);
    } finally {
      setProcessing(false);
    }
  };

  const showMatchAnimation = (matchId: number, targetId: string) => {
    // Implementación de la animación de match
    // Por ahora, simplemente mostraremos un alert
    const matchedProfile = profiles.find(p => p.id === targetId);
    const name = matchedProfile?.display_name || 'alguien';
    
    setTimeout(() => {
      router.push({
        pathname: '/(tabs)/chat/[matchId]',
        params: { matchId }
      });
    }, 2000);
  };

  const renderCard = (index: number) => {
    // No hay más perfiles
    if (index >= profiles.length) {
      return (
        <View style={styles.noMoreCards}>
          <Text style={styles.noMoreCardsText}>No hay más perfiles</Text>
          <Text style={styles.noMoreCardsSubText}>Vuelve más tarde o ajusta tus filtros</Text>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={() => refetch()}
          >
            <Text style={styles.refreshButtonText}>Refrescar</Text>
          </TouchableOpacity>
        </View>
      );
    }

    const profile = profiles[index];
    const isFirst = index === currentIndex;
    
    // Card component
    return (
      <Animated.View
        {...(isFirst ? panResponder.panHandlers : {})}
        style={[
          styles.card,
          {
            transform: isFirst 
              ? [
                  { translateX: position.x },
                  { translateY: position.y },
                  { rotate },
                ]
              : [{ scale: index === currentIndex + 1 ? nextCardScale : 0.9 }],
            opacity: isFirst ? 1 : index === currentIndex + 1 ? 0.8 : 0.5,
            zIndex: profiles.length - index,
          },
        ]}
      >
        <ImageBackground
          source={
            profile.avatar_url 
              ? { uri: profile.avatar_url } 
              : require('../../../assets/icon.png')
          }
          style={styles.cardImage}
          resizeMode="cover"
        >
          {/* Gradiente en la parte inferior para mejor legibilidad */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.9)']}
            style={styles.cardGradient}
          >
            <View style={styles.cardDetails}>
              <Text style={styles.cardName}>
                {profile.display_name || 'Sin nombre'}{" "}
                {profile.age ? `• ${profile.age}` : ''}
              </Text>
              
              {profile.city && (
                <View style={styles.locationContainer}>
                  <Ionicons name="location-outline" size={16} color="#fff" />
                  <Text style={styles.cardLocation}>{profile.city}</Text>
                </View>
              )}
              
              {profile.bio && (
                <Text style={styles.cardBio} numberOfLines={2}>
                  {profile.bio}
                </Text>
              )}
              
              {profile.interests && profile.interests.length > 0 && (
                <View style={styles.interestsContainer}>
                  {profile.interests.map((interest, idx) => (
                    interest.trim() && (
                      <View key={idx} style={styles.interestTag}>
                        <Text style={styles.interestText}>{interest.trim()}</Text>
                      </View>
                    )
                  ))}
                </View>
              )}
            </View>
          </LinearGradient>
          
          {/* Indicadores de like/dislike */}
          {isFirst && (
            <>
              <Animated.View 
                style={[
                  styles.actionStamp, 
                  styles.likeStamp, 
                  { opacity: likeOpacity }
                ]}
              >
                <Text style={styles.stampText}>LIKE</Text>
              </Animated.View>
              
              <Animated.View 
                style={[
                  styles.actionStamp, 
                  styles.dislikeStamp, 
                  { opacity: dislikeOpacity }
                ]}
              >
                <Text style={styles.stampText}>NOPE</Text>
              </Animated.View>
            </>
          )}
        </ImageBackground>
      </Animated.View>
    );
  };

  // Botones de acción
  const renderActions = () => (
    <View style={styles.actions}>
      <TouchableOpacity 
        style={[styles.actionButton, styles.passButton]} 
        onPress={swipeLeft}
      >
        <MaterialCommunityIcons name="close" size={30} color="#F06795" />
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.actionButton, styles.superLikeButton]} 
        onPress={superLike}
        disabled={remaining <= 0 && !isPremium}
      >
        <MaterialCommunityIcons 
          name="star" 
          size={25} 
          color={remaining <= 0 && !isPremium ? "#666" : "#00BFFF"} 
        />
        {!isPremium && (
          <Text style={styles.superlikeCounter}>{remaining}</Text>
        )}
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.actionButton, styles.likeButton]} 
        onPress={swipeRight}
      >
        <MaterialCommunityIcons name="heart" size={30} color="#4FCC94" />
      </TouchableOpacity>
    </View>
  );

  if (isLoading) {
    return (
      <Screen>
        <TopBar title={eventTitle || 'Feed'} onBack={() => router.replace('/(tabs)/feed')} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Cargando perfiles...</Text>
        </View>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <TopBar title={eventTitle || 'Feed'} onBack={() => router.replace('/(tabs)/feed')} />
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons name="alert-circle-outline" size={60} color={theme.colors.danger} />
          <Text style={styles.errorText}>Error al cargar perfiles</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryButtonText}>Intentar de nuevo</Text>
          </TouchableOpacity>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <TopBar 
        title={eventTitle || 'Feed'} 
        onBack={() => router.replace('/(tabs)/feed')} 
      />
      
      <View style={styles.container}>
        {/* Renderizar tarjetas */}
        <View style={styles.cardsContainer}>
          {[...profiles]
            .slice(currentIndex, currentIndex + 3)
            .reverse()
            .map((_, idx) => renderCard(currentIndex + idx))}
        </View>
        
        {/* Botones de acción */}
        {profiles.length > currentIndex && renderActions()}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
  },
  cardsContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  card: {
    position: 'absolute',
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: theme.colors.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  cardImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'flex-end',
  },
  cardGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '40%',
    justifyContent: 'flex-end',
    padding: 20,
  },
  cardDetails: {
    gap: 5,
  },
  cardName: {
    color: 'white',
    fontSize: 26,
    fontWeight: 'bold',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  cardLocation: {
    color: 'white',
    fontSize: 16,
    marginLeft: 5,
  },
  cardBio: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    marginBottom: 8,
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 5,
  },
  interestTag: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  interestText: {
    color: 'white',
    fontSize: 14,
  },
  actionStamp: {
    position: 'absolute',
    top: '10%',
    padding: 10,
    borderWidth: 5,
    borderRadius: 10,
    transform: [{ rotate: '-30deg' }],
  },
  likeStamp: {
    right: 40,
    borderColor: '#4FCC94',
  },
  dislikeStamp: {
    left: 40,
    borderColor: '#F06795',
  },
  stampText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '100%',
    padding: 15,
  },
  actionButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  passButton: {
    borderWidth: 1,
    borderColor: '#F06795',
  },
  superLikeButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#00BFFF',
  },
  superlikeCounter: {
    position: 'absolute',
    bottom: -8,
    right: -8,
    backgroundColor: theme.colors.primary,
    color: 'white',
    width: 20,
    height: 20,
    borderRadius: 10,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 20,
    overflow: 'hidden',
  },
  likeButton: {
    borderWidth: 1,
    borderColor: '#4FCC94',
  },
  noMoreCards: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
    padding: 20,
  },
  noMoreCardsText: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  noMoreCardsSubText: {
    color: theme.colors.subtext,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  refreshButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 15,
  },
  refreshButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 20,
    color: theme.colors.text,
    fontSize: 18,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginTop: 10,
    marginBottom: 20,
    color: theme.colors.text,
    fontSize: 18,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});