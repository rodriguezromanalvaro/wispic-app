import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useProfile } from '../hooks/useProfile';
import { useProfileMutations } from '../hooks/useProfileMutations';
import { Screen } from '../../../components/ui';
import { theme } from '../../../lib/theme';
// import { PhotoCarousel } from '../components/PhotoCarousel';
import { SectionCard } from '../components/SectionCard';
import { ChipsRow } from '../components/ChipsRow';
import { PromptList } from '../components/PromptList';
import { CompletionMeter } from '../components/CompletionMeter';
import { VisibilityBadges } from '../components/VisibilityBadges';
import { EditableRow } from '../components/EditableRow';
import { Badges } from '../components/Badges';
// Replaced single prompt old sheet with inline bottom sheet
import { PromptAnswerSheet } from '../sheets/PromptAnswerSheet';
import { GradientScaffold } from '../components/GradientScaffold';
import { GlassCard, CardSoft } from '../../../components/GlassCard';
import Animated, { useSharedValue, useAnimatedScrollHandler, useAnimatedStyle, interpolate, Extrapolate, withDelay, withTiming } from 'react-native-reanimated';
// Removed large hero; using compact header instead
import { Skeleton } from '../components/Skeleton';
import { EditBasicsSheet } from '../sheets/EditBasicsSheet';
import { EditVisibilitySheet } from '../sheets/EditVisibilitySheet';
import { EditPromptsSheet } from '../sheets/EditPromptsSheet';
import { ProfileHeader } from '../components/ProfileHeader';
import { BioSection } from '../components/sections/BioSection';
import { OrientationSection } from '../components/sections/OrientationSection';
import { SeekingSection } from '../components/sections/SeekingSection';
import { PromptsSection } from '../components/sections/PromptsSection';
// Removed large completion section; ring integrated into ProfileHeader
import { GenderSection } from '../components/sections/GenderSection';
import { LocationSection } from '../components/sections/LocationSection';
import PhotoGrid from '../components/PhotoGrid';
import DraggablePhotoGrid from '../components/DraggablePhotoGrid';
import { EditOrientationSheet } from '../sheets/EditOrientationSheet';
import { EditSeekingSheet } from '../sheets/EditSeekingSheet';
import { EditGenderSheet } from '../sheets/EditGenderSheet';
// TopBar eliminado: usamos sólo el header global de tabs

export default function ProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { data, isOwner, isLoading } = useProfile(userId);
  const mutations = useProfileMutations(data?.id);
  const [showBasics, setShowBasics] = useState(false);
  const [showVisibility, setShowVisibility] = useState(false);
  const [showPrompts, setShowPrompts] = useState(false);
  const [showPromptSheet, setShowPromptSheet] = useState(false);
  const [targetPromptId, setTargetPromptId] = useState<number|string|undefined>(undefined);
  const [showOrientation, setShowOrientation] = useState(false);
  const [showSeeking, setShowSeeking] = useState(false);
  const [showGender, setShowGender] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<any | null>(null);
  // Photo editing no longer needs toggle
  // legacy fade removed (could be reintroduced with Reanimated if needed)
  // Scroll animations para TopBar eliminadas; se podrían reintroducir si se añade un header interno de nuevo
  useEffect(() => {}, [isLoading, data]);

  // Best-effort: if user granted location, try to get city name once and store it
  useEffect(() => {
    (async () => {
      if (!isOwner || !data) return;
      try {
        const { default: ExpoLocation } = await import('expo-location');
        const perm = await ExpoLocation.getForegroundPermissionsAsync();
        if (perm.status !== 'granted') return;
        // Only fetch if city missing to avoid noisy calls
        if (!data.city) {
          const pos = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced });
          const geo = await ExpoLocation.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
          const first = geo && geo[0];
          const city = first?.city || first?.subregion || first?.region;
          if (city && mutations.updateBasics) {
            await mutations.updateBasics.mutateAsync({} as any); // noop to ensure hook instantiated
            await (mutations as any).updateBasics.mutateAsync({ city });
          }
        }
      } catch(e) {
        // silent
      }
    })();
  }, [isOwner, data?.id]);

  // Appear animation wrapper (staggered)
  const Appear: React.FC<{ index: number; children: React.ReactNode }> = ({ index, children }) => {
    const sv = useSharedValue(0);
    useEffect(() => {
      if (data && !isLoading) {
        sv.value = withDelay(index * 70, withTiming(1, { duration: 420 }));
      }
    }, [data, isLoading]);
    const style = useAnimatedStyle(() => ({
      opacity: sv.value,
      transform: [{ translateY: (1 - sv.value) * 28 }]
    }));
    return <Animated.View style={style}>{children}</Animated.View>;
  };

  // (Optional) collapsing header styles removed for now; can be added back later.

  // Helper: choose camera or gallery then call add/replace
  const pickAndHandlePhoto = async (mode: 'add' | 'replace', replaceId?: string|number) => {
    try {
      let source: 'camera' | 'library' = 'library';
      const choice = await new Promise<'camera'|'library'|'cancel'>(resolve => {
        Alert.alert('Seleccionar origen', 'Elige de dónde añadir la foto', [
          { text: 'Galería', onPress: () => resolve('library') },
          { text: 'Cámara', onPress: () => resolve('camera') },
          { text: 'Cancelar', style: 'cancel', onPress: () => resolve('cancel') }
        ]);
      });
      if (choice === 'cancel') return;
      source = choice;
      const picker = await import('expo-image-picker');
      const manipulator = await import('expo-image-manipulator');

      async function processAsset(uri: string): Promise<{ uri: string; mimeType: string }> {
        try {
          // Resize keeping aspect ratio so that the longest edge <= 1080 (reduce crashes / memory)
          const maxDim = 1080;
          const resultInfo = await manipulator.manipulateAsync(
            uri,
            [ { resize: { width: maxDim } } ], // width constraint; if portrait internal logic keeps aspect
            { compress: 0.78, format: manipulator.SaveFormat.JPEG }
          );
          return { uri: resultInfo.uri, mimeType: 'image/jpeg' };
        } catch(e) {
          console.warn('[image process] fallback', e);
          return { uri, mimeType: 'image/jpeg' };
        }
      }
      if (source === 'library') {
        const perm = await picker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) return;
        // No mediaTypes passed to avoid deprecated warning; default is images
  const result = await picker.launchImageLibraryAsync({ allowsEditing:true, quality:0.8, aspect:[4,5] });
        if (result.canceled) return;
        const asset = result.assets[0];
        const processed = await processAsset(asset.uri);
        if (mode === 'add') mutations.addPhoto.mutate({ fileUri: processed.uri, mimeType: processed.mimeType });
        else if (mode === 'replace' && replaceId) mutations.replacePhoto.mutate({ id: replaceId, fileUri: processed.uri, mimeType: processed.mimeType });
      } else {
        const perm = await picker.requestCameraPermissionsAsync();
        if (!perm.granted) return;
  const result = await picker.launchCameraAsync({ allowsEditing:true, quality:0.8, aspect:[4,5] });
        if (result.canceled) return;
        const asset = result.assets[0];
        const processed = await processAsset(asset.uri);
        if (mode === 'add') mutations.addPhoto.mutate({ fileUri: processed.uri, mimeType: processed.mimeType });
        else if (mode === 'replace' && replaceId) mutations.replacePhoto.mutate({ id: replaceId, fileUri: processed.uri, mimeType: processed.mimeType });
      }
    } catch(e) { console.warn('[pickAndHandlePhoto] error', e); }
  };

  return (
    <Screen style={{ padding:0 }}>
      <GradientScaffold>
        {/* TopBar eliminado (sin título ni botones locales) */}
        {(
          isLoading ? (
            <ScrollView contentContainerStyle={styles.loadingContent} showsVerticalScrollIndicator={false}>
              <Skeleton height={420} style={{ height: 420, borderRadius:24 }} />
              <View style={[styles.cardGlass, { gap:12 }] }>
                <Skeleton width={200} height={30} />
                <Skeleton width={'60%'} height={14} />
                <Skeleton width={'90%'} height={14} />
                <Skeleton width={'80%'} height={14} />
              </View>
              <View style={styles.sectionGlass}>
                <Skeleton width={'50%'} height={20} />
                <Skeleton width={'100%'} height={90} />
              </View>
              <View style={styles.sectionGlass}>
                <Skeleton width={'40%'} height={20} />
                <Skeleton width={'100%'} height={40} />
              </View>
              <View style={styles.sectionGlass}>
                <Skeleton width={'45%'} height={20} />
                <Skeleton width={'100%'} height={90} />
              </View>
              <View style={{ height:120 }} />
            </ScrollView>
          ) : !data ? (
            <View style={{ padding:40 }}><Text style={styles.empty}>{t('profile.empty','Perfil no encontrado')}</Text></View>
          ) : (
            <Animated.ScrollView
              scrollEventThrottle={16}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.centerWrap}>
                <Appear index={0}>
                  <View style={{ position:'relative' }}>
                    <View style={styles.headerGlow} pointerEvents='none' />
                    <GlassCard style={styles.fadeInBlock} elevationLevel={2}>
                  <ProfileHeader
                    avatarUrl={data.avatar_url || undefined}
                    name={data.display_name || t('common.noName')}
                    age={data.age}
                    isPremium={data.is_premium}
                    verified_at={data.verified_at}
                    completion={data.completion}
                  />
                    </GlassCard>
                  </View>
                </Appear>
                <Appear index={1}>
                  <CardSoft style={styles.fadeInBlock}>
                    <View style={styles.sectionHeader}> 
                      <Text style={styles.sectionTitle}>{t('profile.photos.title','Fotos')}</Text>
                    </View>
                    <DraggablePhotoGrid
                      photos={(data.photos||[]).slice(0,6)}
                      editable={isOwner}
                      onAdd={async ()=> { if (mutations.addPhoto.isPending) return; await pickAndHandlePhoto('add'); }}
                      onRemove={(id)=> { if (!mutations.removePhoto.isPending) mutations.removePhoto.mutate({ id }); }}
                      onReplace={async (id)=> { await pickAndHandlePhoto('replace', id); }}
                      onReorder={(orderedIds)=> { if (!mutations.reorderPhotos.isPending) mutations.reorderPhotos.mutate({ orderedIds }); }}
                    />
                  </CardSoft>
                </Appear>
                <Appear index={2}>
                  <CardSoft style={styles.fadeInBlock}>
                  <GenderSection
                    gender={data.gender}
                    hidden={!(data.show_gender ?? true)}
                    onEdit={isOwner ? () => setShowGender(true) : undefined}
                  />
                  </CardSoft>
                </Appear>
                <Appear index={3}>
                  <CardSoft style={styles.fadeInBlock}>
                    <LocationSection
                      city={(data as any).city}
                      permissionGranted={true /* best-effort UI: value shows regardless */}
                      onEdit={undefined}
                    />
                  </CardSoft>
                </Appear>
                <Appear index={4}>
                  <CardSoft style={styles.fadeInBlock}>
                  <BioSection bio={data.bio} profileId={data.id} />
                  </CardSoft>
                </Appear>
                <Appear index={5}>
                  <CardSoft style={styles.fadeInBlock}>
                  <OrientationSection
                    items={data.interested_in}
                    hidden={!(data.show_orientation ?? true)}
                    onEdit={isOwner ? () => setShowOrientation(true) : undefined}
                  />
                  </CardSoft>
                </Appear>
                <Appear index={6}>
                  <CardSoft style={styles.fadeInBlock}>
                  <SeekingSection
                    items={data.seeking}
                    hidden={!(data.show_seeking ?? true)}
                    onEdit={isOwner ? () => setShowSeeking(true) : undefined}
                  />
                  </CardSoft>
                </Appear>
                <Appear index={7}>
                  <CardSoft style={styles.fadeInBlock}>
                  <PromptsSection
                    prompts={data.prompts || []}
                    showAll
                    onEditPrompt={isOwner ? (id)=> { setTargetPromptId(id); setShowPromptSheet(true); } : undefined}
                  />
                  </CardSoft>
                </Appear>
                <View style={{ height: 160 }} />
              </View>
            </Animated.ScrollView>
          )
        )}
      </GradientScaffold>
      {isOwner && data && (
        <>
          <EditBasicsSheet
            visible={showBasics}
            onClose={() => setShowBasics(false)}
            profileId={data.id}
            initialName={data.display_name}
            initialBio={data.bio}
          />
          <EditVisibilitySheet
            visible={showVisibility}
            onClose={() => setShowVisibility(false)}
            profileId={data.id}
            initial={{ show_gender: !!data.show_gender, show_orientation: !!data.show_orientation, show_seeking: !!data.show_seeking }}
          />
          <EditOrientationSheet
            visible={showOrientation}
            onClose={() => setShowOrientation(false)}
            profileId={data.id}
            initial={{ interested_in: data.interested_in || [], show_orientation: !!data.show_orientation }}
          />
          <EditSeekingSheet
            visible={showSeeking}
            onClose={() => setShowSeeking(false)}
            profileId={data.id}
            initial={{ seeking: data.seeking || [], show_seeking: !!data.show_seeking }}
          />
          <EditPromptsSheet
            visible={showPrompts}
            onClose={() => setShowPrompts(false)}
            prompts={data.prompts || []}
            onAdd={undefined}
            onEdit={undefined}
            onRemove={(id) => { mutations.deletePrompt.mutate({ id }); }}
            loading={mutations.deletePrompt.isPending || mutations.upsertPrompt.isPending}
          />
          <PromptAnswerSheet
            visible={showPromptSheet}
            onClose={() => setShowPromptSheet(false)}
            profileId={data.id}
            targetId={targetPromptId ?? null}
            existingPrompts={data.prompts || []}
          />
          <EditGenderSheet
            visible={showGender}
            onClose={() => setShowGender(false)}
            profileId={data.id}
            initial={{ gender: data.gender, show_gender: !!data.show_gender }}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: { color: theme.colors.text, fontSize:16 },
  // Ajuste: reducimos el padding superior para subir el conjunto visual
  loadingContent: { paddingVertical: 80, gap: 28, paddingHorizontal:20 },
  scrollContent: { paddingTop: 80, gap: 24, paddingHorizontal:20 },
  centerWrap: { width:'100%', maxWidth:480, alignSelf:'center', gap:24 },
  fadeInBlock: { marginTop:4, gap:12 },
  titleName: { fontSize:28, fontWeight:'800', color: theme.colors.white },
  bio: { color: theme.colors.text, marginTop:12, lineHeight:20 },
  link: { color: theme.colors.primary, fontSize:12, fontWeight:'600' },
  cardGlass: { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth:1, borderColor:'rgba(255,255,255,0.14)', padding:20, borderRadius:20, gap:4 },
  sectionGlass: { },
  headerGlow: {
    position:'absolute',
    top:-70,
    left:-70,
    right:-70,
    height:260,
    borderRadius:220,
    backgroundColor:'rgba(77,124,255,0.20)'
  },
  sectionHeader: { flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  sectionTitle: { color: theme.colors.white, fontSize:18, fontWeight:'700' }
});
