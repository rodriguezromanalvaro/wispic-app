import React, { useMemo, useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Image, TouchableOpacity, Dimensions, Modal, Pressable, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Card, H1, P, Button, TextInput, Switch, SelectionTile } from '../../components/ui';
import { theme } from '../../lib/theme';
import { useTranslation } from 'react-i18next';
import { useProfile } from '../../features/profile/hooks/useProfile';
import { CenterScaffold } from '../../components/Scaffold';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useProfileMutations } from '../../features/profile/hooks/useProfileMutations';
import { useToast } from '../../lib/toast';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/useAuth';

export default function ProfileTab() {
  const router = useRouter();
  const { t } = useTranslation();
  const { profile: authProfile } = useAuth();
  const { data, isLoading, isOwner } = useProfile();
  const mutations = useProfileMutations(data?.id);
  const toast = useToast();
  const [showPremium, setShowPremium] = useState(false);
  const [premiumSlide, setPremiumSlide] = useState(0);
  const slideW = Math.min(Dimensions.get('window').width * 0.82, 520);
  const photos = (data?.photos || []).slice(0, 6);
  const numColumns = 3;
  // Measure the container to compute exact item size for a 3-column grid
  const [containerWidth, setContainerWidth] = useState(0);
  const size = useMemo(() => {
    const gap = 8;
    // Fallback to screen width minus paddings, capped to the grid's maxWidth
    const fallbackW = Math.min(Dimensions.get('window').width - 40, 420);
    const w = containerWidth || fallbackW;
    return Math.floor((w - gap * (numColumns - 1)) / numColumns);
  }, [containerWidth]);
  const insets = useSafeAreaInsets();
  const instantAge = useMemo(() => {
    if (typeof data?.age === 'number') return data.age;
    const bdStr = authProfile?.birthdate;
    if (!bdStr) return null;
    const bd = new Date(bdStr);
    if (isNaN(bd.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - bd.getFullYear();
    const m = today.getMonth() - bd.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < bd.getDate())) age--;
    return age;
  }, [data?.age, authProfile?.birthdate]);

  const [sheet, setSheet] = useState<
    | null
    | { type:'add' }
    | { type:'photo'; index:number }
    | { type:'bio' }
    | { type:'visibility' }
    | { type:'prompts' }
    | { type:'promptChoose' }
    | { type:'promptEdit'; templateId: number; promptRowId?: string|number }
  >(null);
  const [sheetBusy, setSheetBusy] = useState(false);
  const [bioDraft, setBioDraft] = useState('');
  const [visDraft, setVisDraft] = useState<{ show_gender:boolean; show_orientation:boolean; show_seeking:boolean }|null>(null);
  const [templates, setTemplates] = useState<Array<{ id:number; question:string; type?:string; choices?:string[]; max_choices?:number }>>([]);
  const [promptDraft, setPromptDraft] = useState<{ templateId:number; promptRowId?: string|number; type?:string; choices?:string[]; max_choices?:number; question?:string; response: string | string[] }>({ templateId: 0, response: '' });

  async function ensureTemplatesLoaded() {
    if (templates && templates.length) return;
    try {
      const { data: rows, error } = await supabase
        .from('profile_prompt_templates')
        .select('id, question, type, choices, max_choices')
        .order('display_order', { ascending: true });
      if (!error && rows) {
        const mapped = rows.map((r:any)=> ({ id: r.id, question: r.question || `Prompt ${r.id}`, type: r.type, choices: r.choices || [], max_choices: r.max_choices || 1 }));
        setTemplates(mapped);
      }
    } catch {}
  }

  // Best-effort: si hay permiso y no hay city guardada, intentar completar la ciudad una vez
  useEffect(() => {
    (async () => {
      if (!data || !isOwner) return;
      try {
        const ExpoLocation = await import('expo-location');
        const perm = await ExpoLocation.getForegroundPermissionsAsync();
        if (perm.status !== 'granted') return;
        if (!data.city) {
          const pos = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced });
          const geo = await ExpoLocation.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
          const first = geo && geo[0];
          const city = first?.city || first?.subregion || first?.region;
          if (city) await mutations.updateBasics.mutateAsync({ city });
        }
      } catch {}
    })();
  }, [data?.id, isOwner]);

  async function pickAndHandlePhoto(mode: 'add'|'replace', replaceId?: string|number) {
    try {
      let source: 'camera'|'library' = 'library';
      const picker = await import('expo-image-picker');
      const manipulator = await import('expo-image-manipulator');

      async function processAsset(uri: string): Promise<{ uri: string; mimeType: string }> {
        try {
          const maxDim = 1080;
          const resultInfo = await manipulator.manipulateAsync(
            uri,
            [ { resize: { width: maxDim } } ],
            { compress: 0.78, format: manipulator.SaveFormat.JPEG }
          );
          return { uri: resultInfo.uri, mimeType: 'image/jpeg' };
        } catch(e) {
          return { uri, mimeType: 'image/jpeg' };
        }
      }

      async function fromLibrary() {
        const perm = await picker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) return;
        const res = await picker.launchImageLibraryAsync({ allowsEditing:true, quality:0.8, aspect:[4,5] });
        if (res.canceled) return;
        const asset = res.assets[0];
        const processed = await processAsset(asset.uri);
        if (mode === 'add') mutations.addPhoto.mutate({ fileUri: processed.uri, mimeType: processed.mimeType });
        else if (mode === 'replace' && replaceId) mutations.replacePhoto.mutate({ id: replaceId, fileUri: processed.uri, mimeType: processed.mimeType });
      }
      async function fromCamera() {
        const perm = await picker.requestCameraPermissionsAsync();
        if (!perm.granted) return;
        const res = await picker.launchCameraAsync({ allowsEditing:true, quality:0.8, aspect:[4,5] });
        if (res.canceled) return;
        const asset = res.assets[0];
        const processed = await processAsset(asset.uri);
        if (mode === 'add') mutations.addPhoto.mutate({ fileUri: processed.uri, mimeType: processed.mimeType });
        else if (mode === 'replace' && replaceId) mutations.replacePhoto.mutate({ id: replaceId, fileUri: processed.uri, mimeType: processed.mimeType });
      }

      setSheetBusy(true);
      // We'll resolve action via sheet buttons; this function just executes
      await Promise.resolve();
    } finally {
      setSheetBusy(false);
      setSheet(null);
    }
  }

  return (
    <Screen style={{ padding: 0 }} edges={[]}>
      <CenterScaffold variant='auth' paddedTop={60}>
        <ScrollView contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
          {/* Encabezado con avatar, nombre y edad */}
          <View style={styles.center}> 
            <View style={styles.headerRow}>
              {data?.avatar_url ? (
                <Image source={{ uri: data.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Ionicons name="person" size={36} color={theme.colors.textDim} />
                </View>
              )}
              <View style={{ flexShrink: 1 }}>
                <H1 style={styles.nameAge}>
                  {data?.display_name || authProfile?.display_name || t('profile.me','Mi perfil')}
                  {typeof instantAge === 'number' ? `, ${instantAge}` : ''}
                </H1>
              </View>
            </View>
            <View style={{ width:'100%', maxWidth:520 }}>
              <Button title={t('profile.configure','Configurar perfil')} onPress={()=> router.push('/profile/configure' as any)} />
            </View>

            {/* Ubicación: se muestra solo dentro de Configurar perfil */}

            {/* Premium+ teaser: rompe la estética para llamar la atención */}
            <View style={{ width:'100%', maxWidth: 520 }}>
              <LinearGradient
                colors={['#FF0080', '#FF8C00', '#FFD200']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.premiumHero}
              >
                <View style={styles.premiumBadgeWrap}>
                  <Text style={styles.premiumBadge}>PREMIUM+</Text>
                </View>
                <View style={{ gap: 8 }}>
                  <H1 style={styles.premiumTitle}>{t('premiumPlus.title','Brilla por encima del resto')}</H1>
                  <P style={styles.premiumSubtitle}>{t('premiumPlus.subtitle','Más visibilidad, más matches, más control')}</P>
                </View>
                <View style={styles.premiumBenefits}>
                  <View style={styles.benefitRow}><Ionicons name="checkmark-circle" size={18} color="#08101A" /><P style={styles.benefitText}>{t('premiumPlus.benefit1','Aumenta tus likes')}</P></View>
                  <View style={styles.benefitRow}><Ionicons name="checkmark-circle" size={18} color="#08101A" /><P style={styles.benefitText}>{t('premiumPlus.benefit2','Destaca todos los días')}</P></View>
                  <View style={styles.benefitRow}><Ionicons name="checkmark-circle" size={18} color="#08101A" /><P style={styles.benefitText}>{t('premiumPlus.benefit3','Likes ilimitados')}</P></View>
                  <View style={styles.benefitRow}><Ionicons name="checkmark-circle" size={18} color="#08101A" /><P style={styles.benefitText}>{t('premiumPlus.benefit4','Descubre a quién le gustas')}</P></View>
                </View>
                <TouchableOpacity
                  onPress={() => setShowPremium(true)}
                  style={styles.premiumCTA}
                  activeOpacity={0.9}
                >
                  <Text style={styles.premiumCTAText}>{t('premiumPlus.cta','Explorar Premium+')}</Text>
                </TouchableOpacity>
                {/* Glow de acento */}
                <View pointerEvents="none" style={styles.premiumGlow} />
              </LinearGradient>
            </View>
            {/* Logout: acción discreta al fondo con icono */}
            <View style={styles.logoutWrap}>
              <Pressable
                onPress={async () => { try { await supabase.auth.signOut(); router.replace('/(auth)/sign-in'); } catch {} }}
                accessibilityRole="button"
                accessibilityLabel={t('common.logout','Cerrar sesión')}
                style={styles.logoutBtn}
                hitSlop={8}
              >
                <Ionicons name="log-out-outline" size={18} color={theme.colors.textDim} />
                <P dim bold style={{ color: theme.colors.textDim }}>{t('common.logout','Cerrar sesión')}</P>
              </Pressable>
            </View>
          </View>
        </ScrollView>
        {/* Simplificado: sin sheets en la pestaña principal */}
        {/* Premium modal */}
        <Modal visible={showPremium} transparent animationType="fade" onRequestClose={()=> setShowPremium(false)}>
          <Pressable style={styles.modalBackdrop} onPress={()=> setShowPremium(false)} />
          <View style={styles.modalCardWrap}>
            <View style={[styles.modalCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}> 
              <LinearGradient
                colors={theme.mode==='dark' ? ['#FF0080','#FF8C00','#FFD200'] : ['#7C3AED','#EC4899','#F59E0B']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.modalHeader}
              >
                <View style={styles.premiumBadgeWrap}><Text style={styles.premiumBadge}>PREMIUM+</Text></View>
                <H1 style={styles.modalTitle}>{t('premiumPlus.title','Brilla por encima del resto')}</H1>
                <P style={styles.modalSubtitle}>{t('premiumPlus.price','Desde 9,99 €/mes')}</P>
              </LinearGradient>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                pagingEnabled
                snapToAlignment="start"
                decelerationRate="fast"
                onMomentumScrollEnd={(e)=> {
                  const idx = Math.round(e.nativeEvent.contentOffset.x / slideW);
                  setPremiumSlide(idx);
                }}
                contentContainerStyle={{ paddingHorizontal: 8 }}
                style={{ maxHeight: 160 }}
              >
                {[ 
                  { emoji:'✨', title: t('premiumPlus.slide1.title','Destaca con Spotlight diario'), desc: t('premiumPlus.slide1.desc','Aparece primero para más matches.') },
                  { emoji:'💖', title: t('premiumPlus.slide2.title','Likes ilimitados'), desc: t('premiumPlus.slide2.desc','Da like sin frenos.') },
                  { emoji:'👀', title: t('premiumPlus.slide3.title','Descubre a quién le gustas'), desc: t('premiumPlus.slide3.desc','Ahorra tiempo y conecta al instante.') }
                ].map((s, i)=> (
                  <View key={i} style={[styles.slide, { width: slideW }]}> 
                    <Text style={styles.slideEmoji}>{s.emoji}</Text>
                    <Text style={styles.slideTitle}>{s.title}</Text>
                    <Text style={styles.slideDesc}>{s.desc}</Text>
                  </View>
                ))}
              </ScrollView>
              <View style={styles.dotsRow}>
                {[0,1,2].map(i=> (
                  <View key={i} style={[styles.dot, { opacity: premiumSlide===i ? 1 : 0.35 }]} />
                ))}
              </View>

              {/* Comparación rápida */}
              <View style={{ marginTop: 12 }}>
                <P bold style={{ color: theme.colors.text, marginBottom: 6 }}>{t('premiumPlus.compare','Compara planes')}</P>
                {[ 
                  { k:'likes', label: t('premiumPlus.compare.likes','Likes ilimitados'), free:false, plus:true },
                  { k:'spotlight', label: t('premiumPlus.compare.spotlight','Spotlight diario'), free:false, plus:true },
                  { k:'seeLikes', label: t('premiumPlus.compare.seeLikes','Ver a quién le gustas'), free:false, plus:true },
                  { k:'filters', label: t('premiumPlus.compare.filters','Filtros avanzados'), free:false, plus:true }
                ].map(r=> (
                  <View key={r.k} style={styles.compareRow}>
                    <P style={[styles.compareCell, { flex: 1 }]}>{r.label}</P>
                    <View style={[styles.compareCell, styles.comparePill, { backgroundColor: 'rgba(8,16,26,0.06)' }]}><Text>Gratis</Text>{r.free ? <Ionicons name="checkmark" size={16} /> : <Ionicons name="close" size={16} />}</View>
                    <View style={[styles.compareCell, styles.comparePill, { backgroundColor: '#08101A' }]}><Text style={{ color:'#FFD200', fontWeight:'800' }}>Premium+</Text>{r.plus ? <Ionicons name="checkmark" size={16} color="#FFD200" /> : <Ionicons name="close" size={16} color="#FFD200" />}</View>
                  </View>
                ))}
              </View>

              <View style={{ marginTop: 14, gap: 8 }}>
                <TouchableOpacity onPress={()=> { toast.show(t('premiumPlus.notify','Te avisaremos cuando esté listo'), 'success'); setShowPremium(false); }} style={[styles.premiumCTA, { backgroundColor: theme.colors.primary }]}> 
                  <Text style={[styles.premiumCTAText, { color: '#08101A' }]}>{t('premiumPlus.notifyCta','Avisarme')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={()=> setShowPremium(false)} style={[styles.premiumCTA, { backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border }]}> 
                  <Text style={[styles.premiumCTAText, { color: theme.colors.text }]}>{t('common.close','Cerrar')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </CenterScaffold>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', paddingHorizontal: 20, gap: 16 },
  title: { color: theme.colors.text, fontSize: 30, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: theme.colors.subtext, fontSize: 16, textAlign: 'center', marginHorizontal: 12, marginBottom: 8 },
  headerRow: { width:'100%', maxWidth: 520, flexDirection:'row', alignItems:'center', gap: 12 },
  avatar: { width: 72, height: 72, borderRadius: 36, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  avatarFallback: { width: 72, height: 72, borderRadius: 36, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, alignItems:'center', justifyContent:'center' },
  nameAge: { color: theme.colors.text, fontSize: 28, fontWeight:'800', textAlign: 'left' },
  grid: { width: '100%', maxWidth: 520, gap: 12, marginTop: 16 },
  card: { width: '100%', maxWidth: 520, padding: theme.spacing(2), borderRadius: 16, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, gap: 6 },
  cardTitle: { color: theme.colors.text, fontSize: 18, fontWeight: '800' },
  cardBody: { color: theme.colors.subtext },
  gridWrap: { width: '100%', maxWidth: 420, alignSelf: 'center', flexDirection:'row', flexWrap:'wrap', gap: 8, justifyContent:'flex-start', marginTop: 8 },
  thumbWrap: { position: 'relative', borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: theme.colors.border },
  thumb: { borderRadius: 14 },
  editBtn: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, paddingHorizontal: 6, paddingVertical: 6 },
  placeholder: { borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surface },
  emptyCell: { flex:1, alignItems:'center', justifyContent:'center', backgroundColor: theme.colors.card },
  addPlus: { color: theme.colors.primary, fontSize: 24, fontWeight: '800' },
  sheetOverlay: { flex:1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems:'center', justifyContent:'flex-end' },
  sheetContainer: { width:'100%', backgroundColor: theme.colors.card, borderTopLeftRadius: 16, borderTopRightRadius:16, padding: 16, borderWidth: 1, borderColor: theme.colors.border },
  sheetHandle: { alignSelf:'center', width: 44, height: 4, borderRadius: 2, backgroundColor: theme.colors.border, marginBottom: 8 },
  sheetRow: { flexDirection:'row', alignItems:'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: theme.colors.border, gap: 10 },
  sheetIconWrap: { width: 28, height: 28, alignItems:'center', justifyContent:'center', borderRadius: 6, backgroundColor: theme.mode==='dark' ? 'rgba(255,255,255,0.06)' : '#F1F5F9' },
  sheetTitle: { color: theme.colors.text, fontWeight:'700' },
  sheetDesc: { color: theme.colors.textDim, fontSize: 12 },
  logoutWrap: { width: '100%', maxWidth: 520, alignSelf:'center', paddingHorizontal: 20, paddingVertical: 12, marginTop: 8, marginBottom: 12, alignItems:'center' },
  logoutBtn: { flexDirection:'row', alignItems:'center', gap: 8, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: 'transparent' }
  ,
  // Premium hero styles
  premiumHero: {
    borderRadius: 20,
    padding: 18,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#FF0080',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 10,
    overflow: 'hidden',
    marginTop: 6,
  },
  premiumBadgeWrap: { alignSelf: 'flex-start', backgroundColor: '#08101A', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 8 },
  premiumBadge: { color: '#FFD200', fontWeight: '900', letterSpacing: 1, fontSize: 12 },
  premiumTitle: { color: '#08101A', fontSize: 22, fontWeight: '900' },
  premiumSubtitle: { color: '#08101A', opacity: 0.85 },
  premiumBenefits: { marginTop: 8, marginBottom: 12, gap: 6 },
  benefitRow: { flexDirection:'row', alignItems:'center', gap: 8 },
  benefitText: { color: '#08101A', fontWeight: '600' },
  premiumCTA: { backgroundColor: '#08101A', borderRadius: 14, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  premiumCTAText: { color: '#FFFFFF', fontWeight: '900', fontSize: 16 },
  premiumGlow: { position:'absolute', right: -30, top: -30, width: 160, height: 160, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.35)', filter: undefined, opacity: 0.6 }
  ,
  // Premium modal
  modalBackdrop: { ...StyleSheet.absoluteFillObject as any, backgroundColor:'rgba(0,0,0,0.5)' },
  modalCardWrap: { position:'absolute', left:0, right:0, top:0, bottom:0, alignItems:'center', justifyContent:'center', padding: 16 },
  modalCard: { width:'100%', maxWidth: 560, borderRadius: 20, borderWidth: 1, overflow:'hidden' },
  modalHeader: { padding: 16, alignItems:'flex-start', justifyContent:'center' },
  modalTitle: { color: '#08101A', fontWeight: '900', fontSize: 22 },
  modalSubtitle: { color: '#08101A', opacity: 0.85 },
  slide: { paddingVertical: 16, paddingHorizontal: 12 },
  slideEmoji: { fontSize: 28, textAlign:'center', marginBottom: 6 },
  slideTitle: { fontSize: 16, fontWeight:'800', color: theme.colors.text, textAlign:'center' },
  slideDesc: { fontSize: 14, color: theme.colors.subtext, textAlign:'center', marginTop: 2 },
  dotsRow: { flexDirection:'row', gap: 6, justifyContent:'center', marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.text },
  compareRow: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', gap: 8, paddingVertical: 8 },
  compareCell: { alignItems:'center', flexDirection:'row', gap: 6 },
  comparePill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
});
