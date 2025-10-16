import { useEffect, useState, useCallback, useRef } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View, Image, TouchableOpacity, Alert, Dimensions, Modal, Pressable, InteractionManager, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { CenterScaffold } from '../../../components/Scaffold';
import { Screen, Card, H1, P, Button, StickyFooterActions } from '../../../components/ui';
import { theme } from '../../../lib/theme';
import { useCompleteProfile } from '../../../lib/completeProfileContext';
import { useAuth } from '../../../lib/useAuth';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { supabase } from '../../../lib/supabase';
import { uploadUserPhotos, DEFAULT_PUBLIC_BUCKET, processPendingUploads } from '../../../lib/storage';
// Usamos la API legacy para evitar el warning deprecado mientras migramos a la nueva File API
import * as FileSystem from 'expo-file-system/legacy';
import { decode as decodeBase64 } from 'base64-arraybuffer'; // (Puede eliminarse cuando migremos todo al helper)
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';

export default function StepPhotos() {
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const { t } = useTranslation();
  const { draft, setDraft } = useCompleteProfile();
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{current:number; total:number}>({ current: 0, total: 0 });
  const [sheet, setSheet] = useState<{ type: 'add' } | { type: 'photo'; index: number } | null>(null);
  const [sheetBusy, setSheetBusy] = useState(false);
  const [inlineCameraOpen, setInlineCameraOpen] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const sheetSv = useSharedValue(0);
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - sheetSv.value) * 28 }],
    opacity: sheetSv.value,
  }));
  useEffect(() => {
    if (sheet) sheetSv.value = withTiming(1, { duration: 220 });
    else sheetSv.value = 0;
  }, [sheet]);
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  // Initialize photos once: prefer draft.temp_photos when defined; otherwise preload from DB
  const didInitRef = useRef(false);
  useEffect(() => {
    if (didInitRef.current) return;
    (async () => {
      didInitRef.current = true;
      try {
        if (Array.isArray(draft?.temp_photos)) {
          setPhotos(draft.temp_photos as string[]);
          return;
        }
        if (!user?.id) return;
        await processPendingUploads({ userId: user.id, retries: 1 });
        const { data, error } = await supabase
          .from('user_photos')
          .select('url')
          .eq('user_id', user.id)
          .order('sort_order', { ascending: true });
        if (!error && Array.isArray(data)) {
          setPhotos(data.map((d: any) => d.url).filter(Boolean));
        }
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Persist photos to draft.temp_photos so they survive navigation (including empty arrays)
  useEffect(() => {
    setDraft(d => {
      const current = Array.isArray(d.temp_photos) ? d.temp_photos : undefined;
      const next = photos;
      const equal = Array.isArray(current)
        ? current.length === next.length && current.every((v, i) => v === next[i])
        : false;
      if (equal) return d;
      return { ...d, temp_photos: next };
    });
  }, [photos, setDraft]);

  const pickFromGallery = async (maxToAdd: number = 6) => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert('Permisos', 'Necesitamos acceso a tus fotos para continuar.');
        return;
      }
      const limit = Math.max(1, Math.min(6, maxToAdd));
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsMultipleSelection: true, quality: 0.8, selectionLimit: limit } as any);
      if (res.canceled) return;
      const uris = (res.assets || []).map(a => a.uri).filter(Boolean) as string[];
      if (!uris.length) return;
      setPhotos((arr) => {
        const combined = [...arr, ...uris];
        return combined.slice(0, 6);
      });
    } catch (e: any) {
      Alert.alert('Error', e.message || 'No se pudo seleccionar la imagen');
    }
  };
  const takePhoto = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert('Permisos', 'Necesitamos acceso a la cámara para continuar.');
        return;
      }
      const res = await ImagePicker.launchCameraAsync({ quality: 0.8, cameraType: ImagePicker.CameraType.back } as any);
      if (res.canceled) return;
      const asset = res.assets?.[0];
      if (!asset?.uri) return;
      setPhotos((arr) => (arr.length >= 6 ? arr : [...arr, asset.uri]));
    } catch (e: any) {
      Alert.alert('Error', e.message || 'No se pudo tomar la foto');
    }
  };
  const replaceFromGallery = async (index: number) => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') { Alert.alert('Permisos', 'Necesitamos acceso a tus fotos para continuar.'); return; }
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsMultipleSelection: false, quality: 0.8 } as any);
      if (res.canceled) return;
      const uri = res.assets?.[0]?.uri; if (!uri) return;
      setPhotos((arr) => arr.map((u, i) => (i === index ? uri : u)));
    } catch (e:any) { Alert.alert('Error', e.message || 'No se pudo seleccionar la imagen'); }
  };
  const replaceFromCamera = async (index: number) => {
    // Fallback to inline camera for reliability
    try {
      if (!cameraPermission || cameraPermission.status !== 'granted') {
        const { status } = await requestCameraPermission();
        if (status !== 'granted') { Alert.alert('Permisos', 'Necesitamos acceso a la cámara para continuar.'); return; }
      }
      // Open inline camera, capture then replace
      setInlineCameraOpen(true);
      // We'll handle capture via UI and apply index replacement after capture using a temp setter
      pendingReplaceIndexRef.current = index;
    } catch (e:any) { Alert.alert('Error', e.message || 'No se pudo abrir la cámara'); }
  };
  const removePhoto = (uri: string) => setPhotos((arr) => arr.filter((p) => p !== uri));

  // Eliminamos lógica inline de subida y delegamos al helper centralizado

  const numColumns = 3;
  const size = Math.floor((Dimensions.get('window').width - 20 * 2 - 8 * (numColumns - 1)) / numColumns);

  const pickerLockRef = useRef(false);
  const withPickerLock = useCallback(async (fn: () => Promise<void> | void) => {
    if (pickerLockRef.current) return;
    pickerLockRef.current = true;
    try {
      await Promise.resolve(fn());
    } finally {
      // Small cooldown to avoid rapid double-presses triggering multiple intents
      setTimeout(() => { pickerLockRef.current = false; }, 200);
    }
  }, []);

  const onPressAdd = () => {
    if (pickerLockRef.current || sheetBusy) return;
    setSheet({ type: 'add' });
  };

  // Ensure camera/gallery actions run after sheet closes to prevent conflicts
  const runAfterSheetClose = useCallback((fn: () => Promise<void> | void) => {
    if (pickerLockRef.current) return;
    setSheetBusy(true);
    setSheet(null);
    // Wait for modal to fully unmount and window focus to return
    InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        setTimeout(() => {
          withPickerLock(async () => {
            try {
              await Promise.resolve(fn());
            } finally {
              setSheetBusy(false);
            }
          });
        }, 220); // roughly matches sheet closing animation
      });
    });
  }, [withPickerLock]);

  // Inline camera capture helpers
  const pendingReplaceIndexRef = useRef<number | null>(null);
  const openInlineCamera = useCallback(async () => {
    try {
      if (!cameraPermission || cameraPermission.status !== 'granted') {
        const { status } = await requestCameraPermission();
        if (status !== 'granted') { Alert.alert('Permisos', 'Necesitamos acceso a la cámara para continuar.'); return; }
      }
      setInlineCameraOpen(true);
    } catch (e:any) {
      Alert.alert('Error', e.message || 'No se pudo abrir la cámara');
    }
  }, [cameraPermission, requestCameraPermission]);

  const handleInlineCapture = useCallback(async () => {
    try {
      const cam = cameraRef.current as any;
      if (!cam) return;
      const photo = await cam.takePictureAsync?.({ quality: 0.8 });
      const uri = photo?.uri;
      if (uri) {
        // Persist to our cache folder to ensure stability across navigation
        const dir = `${FileSystem.cacheDirectory}wispic-photos/`;
        try { await FileSystem.makeDirectoryAsync(dir, { intermediates: true }); } catch {}
        const name = `cam_${Date.now()}.jpg`;
        const dest = dir + name;
        try { await FileSystem.copyAsync({ from: uri, to: dest }); } catch {}
        const finalUri = dest;
        // Show preview; on confirm we'll apply to state
        setPreviewUri(finalUri);
      }
    } catch (e:any) {
      Alert.alert('Error', e.message || 'No se pudo capturar la foto');
    } finally {
      // Keep camera modal open; we either retake or confirm
    }
  }, []);

  return (
    <Screen style={{ padding: 0, gap: 0 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <CenterScaffold variant='auth' paddedTop={Math.max(insets.top, 60)}>
          <View style={[styles.progressWrap,{ top: Math.max(insets.top, 60) + 8 }] }>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${(9/10)*100}%` }]} />
            </View>
            <P style={styles.progressText}>{t('complete.progress', { current: 9, total: 10 })}</P>
          </View>
          <View style={styles.center}>
            <View style={{ height: 56 }} />
            <H1 style={styles.title}>{t('complete.photosTitle')}</H1>
            <P style={styles.subtitle}>{t('complete.photosSubtitle')}</P>
            <View style={styles.gridWrap}>
              {Array.from({ length: 6 }).map((_, idx) => {
                const uri = photos[idx];
                if (uri) {
                  return (
                    <View key={`slot-${idx}`} style={{ width: size, height: size }}>
                      <View style={[styles.thumbWrap, { width: size, height: size }] }>
                        <Image source={{ uri }} style={[styles.thumb, { width: size, height: size }]} />
                        {/* Botón editar (reemplazar/eliminar) */}
                        <TouchableOpacity style={styles.editBtn} onPress={() => setSheet({ type: 'photo', index: idx })}>
                          <Ionicons name="pencil" size={16} color="#fff" />
                        </TouchableOpacity>
                        {/* Quitar long-press para evitar acciones no deseadas */}
                      </View>
                    </View>
                  );
                }
                return (
                  <TouchableOpacity key={`slot-${idx}`} activeOpacity={0.8} onPress={onPressAdd} style={{ width: size, height: size }}>
                    <View style={[styles.placeholder, { width: size, height: size, borderStyle:'dashed' }]}>
                      <LinearGradient
                        colors={(theme.gradients?.brand as any) || [theme.colors.primary, theme.colors.primary]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={{ position:'absolute', right: 8, bottom: 8, width: 36, height: 36, borderRadius: 18, alignItems:'center', justifyContent:'center' }}
                      >
                        <P style={{ color:'#fff', fontWeight:'700', fontSize:18 }}>＋</P>
                      </LinearGradient>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Bottom Sheet: Añadir o editar foto */}
            <Modal visible={!!sheet} transparent animationType="fade" onRequestClose={() => setSheet(null)}>
              <View style={styles.sheetOverlay}>
                <Pressable style={StyleSheet.absoluteFill} onPress={() => setSheet(null)} />
                <Animated.View style={[styles.sheetContainer, { paddingBottom: insets.bottom + 16 }, sheetStyle]}>
                  <View style={styles.sheetHandle} />
                  {sheet?.type === 'add' && (
                    <>
                      <H1 style={{ fontSize: 20 }}>{t('complete.addPhoto','Añadir foto')}</H1>
                      <P style={{ color: theme.colors.textDim, marginBottom: 8 }}>{t('complete.photosSubtitle','Añade de 1 a 6 fotos a tu perfil')}</P>
                      <Pressable disabled={sheetBusy} onPress={() => runAfterSheetClose(() => pickFromGallery(6 - photos.length))} style={[styles.sheetRow, sheetBusy && { opacity: 0.6 }]} accessibilityRole="button">
                        <View style={styles.sheetIconWrap}><Ionicons name="images-outline" size={20} color={theme.colors.text} /></View>
                        <View style={{ flex:1 }}>
                          <P style={styles.sheetTitle}>{t('complete.addFromGallery','Añadir desde galería')}</P>
                          <P style={styles.sheetDesc}>{t('photos.sheet.galleryDesc','Selecciona hasta 6 imágenes')}</P>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={theme.colors.textDim} />
                      </Pressable>
                      <Pressable disabled={sheetBusy} onPress={() => runAfterSheetClose(() => openInlineCamera())} style={[styles.sheetRow, sheetBusy && { opacity: 0.6 }]} accessibilityRole="button">
                        <View style={styles.sheetIconWrap}><Ionicons name="camera-outline" size={20} color={theme.colors.text} /></View>
                        <View style={{ flex:1 }}>
                          <P style={styles.sheetTitle}>{t('complete.takePhoto','Tomar foto')}</P>
                          <P style={styles.sheetDesc}>{t('photos.sheet.cameraDesc','Usa la cámara (retrato recomendado)')}</P>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={theme.colors.textDim} />
                      </Pressable>
                    </>
                  )}
                  {sheet?.type === 'photo' && (
                    <>
                      <H1 style={{ fontSize: 20 }}>{t('photos.sheet.title','Editar foto')}</H1>
                      <P style={{ color: theme.colors.textDim, marginBottom: 8 }}>{t('photos.sheet.subtitle','Reemplaza o elimina esta foto')}</P>
                      <Pressable disabled={sheetBusy} onPress={() => runAfterSheetClose(() => replaceFromGallery((sheet as any).index as number))} style={[styles.sheetRow, sheetBusy && { opacity: 0.6 }]} accessibilityRole="button">
                        <View style={styles.sheetIconWrap}><Ionicons name="images-outline" size={20} color={theme.colors.text} /></View>
                        <View style={{ flex:1 }}>
                          <P style={styles.sheetTitle}>{t('photos.sheet.replaceFromGallery','Reemplazar desde galería')}</P>
                          <P style={styles.sheetDesc}>{t('photos.sheet.replaceFromGalleryDesc','Elige una foto nueva')}</P>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={theme.colors.textDim} />
                      </Pressable>
                      <Pressable disabled={sheetBusy} onPress={() => runAfterSheetClose(() => replaceFromCamera((sheet as any).index as number))} style={[styles.sheetRow, sheetBusy && { opacity: 0.6 }]} accessibilityRole="button">
                        <View style={styles.sheetIconWrap}><Ionicons name="camera-outline" size={20} color={theme.colors.text} /></View>
                        <View style={{ flex:1 }}>
                          <P style={styles.sheetTitle}>{t('photos.sheet.replaceFromCamera','Reemplazar con cámara')}</P>
                          <P style={styles.sheetDesc}>{t('photos.sheet.replaceFromCameraDesc','Toma una nueva foto')}</P>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={theme.colors.textDim} />
                      </Pressable>
                      <Pressable onPress={()=> { const i = (sheet as any).index as number; const uri = photos[i]; setSheet(null); if (uri) removePhoto(uri); }} style={[styles.sheetRow, { borderBottomWidth: 0 }]} accessibilityRole="button">
                        <View style={styles.sheetIconWrap}><Ionicons name="trash-outline" size={20} color={theme.colors.danger} /></View>
                        <View style={{ flex:1 }}>
                          <P style={[styles.sheetTitle, { color: theme.colors.danger }]}>{t('complete.removePhoto','Quitar')}</P>
                          <P style={styles.sheetDesc}>{t('photos.sheet.removeDesc','Eliminar esta foto del grid')}</P>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={theme.colors.textDim} />
                      </Pressable>
                    </>
                  )}
                  <Button title={t('common.close','Cerrar')} variant="outline" onPress={() => setSheet(null)} style={{ marginTop: 8 }} />
                </Animated.View>
              </View>
            </Modal>

            {/* Inline Camera Modal */}
            <Modal visible={inlineCameraOpen} transparent animationType="fade" onRequestClose={() => setInlineCameraOpen(false)}>
              <View style={styles.inlineCamOverlay}>
                <View style={styles.inlineCamContainer}>
                  {!previewUri ? (
                    <CameraView ref={cameraRef} style={{ flex: 1 }} facing={facing} />
                  ) : (
                    <Image source={{ uri: previewUri }} style={styles.previewImage} resizeMode="cover" />
                  )}

                  {/* Top controls: close */}
                  <View style={[styles.inlineCamTopControls, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
                    <TouchableOpacity
                      accessibilityLabel={t('common.close','Cerrar')}
                      onPress={() => { pendingReplaceIndexRef.current = null; setInlineCameraOpen(false); }}
                      style={styles.iconBtn}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="close" size={26} color="#fff" />
                    </TouchableOpacity>
                    <View style={{ width: 44 }} />
                  </View>

                  {!previewUri ? (
                    <>
                      {/* Bottom-right: switch camera */}
                      <View style={[styles.bottomRightWrap, { paddingBottom: insets.bottom + 24 }]}>
                        <TouchableOpacity
                          accessibilityLabel={t('photos.sheet.switchCamera','Cambiar cámara')}
                          onPress={() => setFacing(prev => prev === 'back' ? 'front' : 'back')}
                          style={styles.iconBtn}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="camera-reverse" size={26} color="#fff" />
                        </TouchableOpacity>
                      </View>
                      {/* Bottom shutter button */}
                      <View style={[styles.shutterWrap, { paddingBottom: insets.bottom + 16 }]}>
                        <View style={styles.shutterOuter}>
                          <TouchableOpacity accessibilityLabel={t('complete.takePhoto','Tomar foto')} onPress={handleInlineCapture} style={styles.shutterButton} activeOpacity={0.85} />
                        </View>
                      </View>
                    </>
                  ) : (
                    // Preview controls: retake (left) and confirm (right)
                    <View style={[styles.previewControls, { paddingBottom: insets.bottom + 16 }]}>
                      <TouchableOpacity
                        accessibilityLabel={t('photos.preview.retake','Repetir foto')}
                        onPress={async () => { try { if (previewUri) await FileSystem.deleteAsync(previewUri, { idempotent: true }); } catch {} setPreviewUri(null); }}
                        style={styles.iconBtn}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="refresh" size={26} color="#fff" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        accessibilityLabel={t('photos.preview.use','Usar foto')}
                        onPress={() => {
                          const finalUri = previewUri!;
                          if (pendingReplaceIndexRef.current != null) {
                            const idx = pendingReplaceIndexRef.current;
                            pendingReplaceIndexRef.current = null;
                            setPhotos(arr => arr.map((u, i) => (i === idx ? finalUri : u)));
                          } else {
                            setPhotos(arr => (arr.length >= 6 ? arr : [...arr, finalUri]));
                          }
                          setPreviewUri(null);
                          setInlineCameraOpen(false);
                        }}
                        style={styles.iconBtn}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="checkmark" size={26} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            </Modal>

            {/* Inline progress removed in favor of full-screen overlay to avoid layout shifts */}

            <Card style={[styles.card, { marginTop: 12, marginBottom: 16 }]}>
              {/* Tips to boost profile */}
              <View style={{ gap: 6 }}>
                <P style={{ color: theme.colors.textDim, fontWeight: '700' }}>💡 {t('complete.photosTipsTitle', 'Consejos para un gran perfil')}</P>
                <View style={{ gap: 4 }}>
                  <P style={styles.tipItem}>• {t('complete.photosTipAvatarFirst', 'Pon tu mejor foto la primera: será tu avatar.')}</P>
                  <P style={styles.tipItem}>• {t('complete.photosTipVariety', 'Variedad: cercanos y cuerpo entero.')}</P>
                  <P style={styles.tipItem}>• {t('complete.photosTipRecent', 'Que sean recientes (12 meses).')}</P>
                  <P style={styles.tipItem}>• {t('complete.photosTipMin', 'Sube 2 para empezar; con 4+ mejoras.')}</P>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'center' }}>
                {/* Deprecated inline actions moved to StickyFooterActions */}
              </View>
            </Card>
          </View>
          <StickyFooterActions
            actions={[
              { title: uploading ? t('complete.uploading') : t('common.continue'), onPress: async () => {
                  // Validación: mínimo 1 foto antes de continuar
                  if (photos.length < 1) {
                    return;
                  }
                  try {
                    setUploading(true);
                    if (!user?.id) throw new Error('No user');
                    const { urls: uploadedUrls, avatarUrl } = await uploadUserPhotos({
                      userId: user.id,
                      uris: photos,
                      max: 6,
                      concurrency: 3,
                      resize: { maxWidth: 1600, maxHeight: 1600, quality: 0.8 },
                      onProgress: ({ current, total }) => setProgress({ current, total }),
                      onRetry: ({ attempt, maxAttempts, uri }) => {
                        // Podríamos opcionalmente hacer set de un mensaje en UI
                        console.log('Retry upload', { attempt, maxAttempts, uri });
                      },
                    });

                    // Save avatar_url con la primera (el helper ya la expone si quisiéramos usarlo)
                    if (avatarUrl) {
                      const { error: upErr } = await supabase
                        .from('profiles')
                        .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
                        .eq('id', user.id);
                      if (upErr) throw upErr;
                    }

                    // Replace user_photos with new set preserving order
                    // 1) delete existing
                    await supabase.from('user_photos').delete().eq('user_id', user.id);
                    // 2) insert new
                    const rows = uploadedUrls.map((url, idx) => ({ user_id: user.id, url, sort_order: idx }));
                    if (rows.length) {
                      const { error: insErr } = await supabase.from('user_photos').insert(rows);
                      if (insErr) throw insErr;
                    }
                    // Persist uploaded remote URLs in draft so returning to Photos shows them
                    setDraft(d => ({ ...d, temp_photos: uploadedUrls }));
                    if (returnTo === 'hub') {
                      router.replace('(tabs)/profile' as any);
                    } else {
                      router.push('(auth)/complete/summary' as any);
                    }
                  } catch (e: any) {
                    const raw = e?.message || '';
                    if (raw.startsWith('BUCKET_NOT_FOUND')) {
                      const parts = raw.split(':'); // BUCKET_NOT_FOUND:bucket:detalle
                      const bucketName = parts[1] || DEFAULT_PUBLIC_BUCKET;
                      Alert.alert(
                        'Bucket faltante',
                        `No se encontró (o no hay permiso) el bucket "${bucketName}".\n\nPasos:\n1. Supabase → Storage.\n2. Create bucket: ${bucketName}.\n3. Activa "Public bucket" (o agrega política SELECT pública).\n4. Vuelve a intentar.`
                      );
                    } else if (raw.startsWith('UPLOAD_FAILED')) {
                      Alert.alert('Subida fallida', raw.replace('UPLOAD_FAILED:', ''));
                    } else {
                      Alert.alert('Error al subir', raw);
                    }
                  } finally {
                    setUploading(false);
                  }
                }, disabled: uploading || photos.length < 1 },
              { title: t('common.back'), onPress: () => {
                  if (returnTo === 'hub') router.replace('(tabs)/profile' as any);
                  else router.push('(auth)/complete/permissions' as any);
                }, variant: 'outline' },
            ]}
          />
  </CenterScaffold>
      </KeyboardAvoidingView>
      {/* Full-screen uploading overlay */}
      <Modal visible={uploading} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={styles.uploadOverlay}>
          <View style={styles.uploadCard}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <H1 style={{ fontSize: 18, marginTop: 12 }}>{t('complete.uploadingPhotos','Subiendo fotos…')}</H1>
            {progress.total > 0 ? (
              <P style={{ color: theme.colors.textDim, marginTop: 4 }}>{t('complete.uploadingProgress', { current: progress.current, total: progress.total })}</P>
            ) : null}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1, paddingHorizontal: 20, paddingTop: 60, paddingBottom: 24 },
  progressWrap: { position: 'absolute', top: 16, left: 20, right: 20, gap: 6 },
  progressBg: { width: '100%', height: 6, backgroundColor: theme.colors.surface, borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: theme.colors.primary, borderRadius: 999 },
  progressText: { color: theme.colors.textDim, fontSize: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  title: { color: theme.colors.text, fontSize: 30, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: theme.colors.subtext, fontSize: 16, textAlign: 'center', marginHorizontal: 12, marginBottom: 8 },
  card: { width: '100%', maxWidth: 420, padding: theme.spacing(2), borderRadius: 16, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  gridWrap: { width: '100%', maxWidth: 420, alignSelf: 'center', flexDirection:'row', flexWrap:'wrap', gap: 8, justifyContent:'space-between', marginTop: 8 },
  grid: { flex: 1 },
  placeholder: { borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surface },
  thumbWrap: { position: 'relative', borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: theme.colors.border },
  thumb: { borderRadius: 14 },
  remove: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, paddingHorizontal: 6, paddingVertical: 2 },
  editBtn: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, paddingHorizontal: 6, paddingVertical: 6 },
  progressUploading: { width: '100%', gap: 6, marginTop: 8 },
  progressLineBg: { height: 6, width: '100%', backgroundColor: theme.colors.surfaceAlt, borderRadius: 6, overflow: 'hidden' },
  progressLineFill: { height: '100%', backgroundColor: theme.colors.primary },
  progressUploadingText: { color: theme.colors.textDim, fontSize: 12, textAlign: 'center' },
  hint: { color: theme.colors.textDim, fontSize: 12, marginBottom: 8 },
  tipItem: { color: theme.colors.textDim, fontSize: 12 },
  sheetOverlay: { flex:1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent:'flex-end' },
  sheetContainer: { backgroundColor: theme.colors.bg, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, borderTopLeftRadius: 16, borderTopRightRadius: 16, gap: 6, borderWidth:1, borderColor: theme.colors.border },
  sheetHandle: { alignSelf:'center', width: 40, height: 5, borderRadius: 999, backgroundColor: theme.colors.border, marginBottom: 8 },
  sheetRow: { flexDirection:'row', alignItems:'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  sheetIconWrap: { width: 34, height: 34, borderRadius: 10, alignItems:'center', justifyContent:'center', backgroundColor: theme.colors.card, borderWidth:1, borderColor: theme.colors.border },
  sheetTitle: { color: theme.colors.text, fontWeight:'700' },
  sheetDesc: { color: theme.colors.textDim, fontSize: 12 },
  inlineCamOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  inlineCamContainer: { width: '100%', maxWidth: 420, aspectRatio: 3/4, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000', borderWidth: 1, borderColor: theme.colors.border },
  inlineCamControls: { position: 'absolute', bottom: 8, left: 8, right: 8, flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  inlineCamTopControls: { position: 'absolute', top: 0, left: 0, right: 0, height: 56, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  shutterWrap: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 100, alignItems: 'center', justifyContent: 'flex-end' },
  shutterOuter: { width: 86, height: 86, borderRadius: 43, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)', backgroundColor: 'rgba(0,0,0,0.15)' },
  shutterButton: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#fff', borderWidth: 4, borderColor: 'rgba(255,255,255,0.8)' },
  bottomRightWrap: { position: 'absolute', right: 16, bottom: 0 },
  previewImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  previewControls: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between' },
  uploadOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  uploadCard: { width: '80%', maxWidth: 360, borderRadius: 16, backgroundColor: theme.colors.bg, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border },
});
