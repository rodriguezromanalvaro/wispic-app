import { useEffect, useState, useCallback } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View, Image, TouchableOpacity, Alert, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { CenterScaffold } from '../../../components/Scaffold';
import { Screen, Card, H1, P, Button } from '../../../components/ui';
import { theme } from '../../../lib/theme';
import { useCompleteProfile } from '../../../lib/completeProfileContext';
import { useAuth } from '../../../lib/useAuth';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../../lib/supabase';
import { uploadUserPhotos, DEFAULT_PUBLIC_BUCKET, processPendingUploads } from '../../../lib/storage';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
// Usamos la API legacy para evitar el warning deprecado mientras migramos a la nueva File API
import * as FileSystem from 'expo-file-system/legacy';
import { decode as decodeBase64 } from 'base64-arraybuffer'; // (Puede eliminarse cuando migremos todo al helper)

export default function StepPhotos() {
  const router = useRouter();
  const { t } = useTranslation();
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{current:number; total:number}>({ current: 0, total: 0 });
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    // Optionally preload existing photos from DB
    (async () => {
      try {
        if (!user?.id) return;
        // Reprocesar cola offline si existiera
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
  }, [user?.id]);

  const pickFromGallery = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert('Permisos', 'Necesitamos acceso a tus fotos para continuar.');
        return;
      }
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 0.8, selectionLimit: 6 });
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
      const res = await ImagePicker.launchCameraAsync({ quality: 0.8 });
      if (res.canceled) return;
      const asset = res.assets?.[0];
      if (!asset?.uri) return;
      setPhotos((arr) => (arr.length >= 6 ? arr : [...arr, asset.uri]));
    } catch (e: any) {
      Alert.alert('Error', e.message || 'No se pudo tomar la foto');
    }
  };
  const removePhoto = (uri: string) => setPhotos((arr) => arr.filter((p) => p !== uri));

  // Eliminamos lógica inline de subida y delegamos al helper centralizado

  const numColumns = 3;
  const size = Math.floor((Dimensions.get('window').width - 20 * 2 - 8 * (numColumns - 1)) / numColumns);

  return (
    <Screen style={{ padding: 0, gap: 0 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <CenterScaffold variant='auth' paddedTop={Math.max(insets.top, 60)}>
          <View style={[styles.progressWrap,{ top: insets.top + 8 }] }>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${(8/9)*100}%` }]} />
            </View>
            <P style={styles.progressText}>{t('complete.progress', { current: 8, total: 9 })}</P>
          </View>
          <View style={styles.center}>
            <H1 style={styles.title}>{t('complete.photosTitle')}</H1>
            <P style={styles.subtitle}>{t('complete.photosSubtitle')}</P>

            <Card style={styles.card}>
              {photos.length < 1 && (
                <P style={styles.hint}>{t('complete.minPhotosHint', 'Sube al menos 1 foto')}</P>
              )}
              <DraggableFlatList
                data={[...photos, ...(photos.length < 6 ? ['__add__'] : [])]}
                keyExtractor={(item, index) => `${item}-${index}`}
                onDragEnd={({ data }) => {
                  const filtered = data.filter((d) => d !== '__add__');
                  setPhotos(filtered as string[]);
                }}
                renderItem={({ item, drag }: RenderItemParams<string>) => {
                  if (item === '__add__') {
                    return (
                      <View style={[styles.placeholder, { width: size, height: size }]}>
                        <TouchableOpacity onLongPress={drag} onPress={pickFromGallery} style={{ padding: 6 }}>
                          <P style={{ color: '#E6EAF2', textAlign: 'center' }}>+ {t('complete.addFromGallery')}</P>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={takePhoto} style={{ padding: 6 }}>
                          <P style={{ color: '#E6EAF2', textAlign: 'center' }}>📷 {t('complete.takePhoto')}</P>
                        </TouchableOpacity>
                      </View>
                    );
                  }
                  const uri = item;
                  return (
                    <TouchableOpacity onLongPress={drag} activeOpacity={0.9} style={{ margin: 4 }}>
                      <View style={[styles.thumbWrap, { width: size, height: size }]}>
                        <Image source={{ uri }} style={[styles.thumb, { width: size, height: size }]} />
                        <TouchableOpacity style={styles.remove} onPress={() => removePhoto(uri)}>
                          <P style={{ color: '#fff' }}>×</P>
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  );
                }}
                numColumns={numColumns}
                contentContainerStyle={{ gap: 4 }}
              />

              {uploading && (
                <View style={styles.progressUploading}>
                  <View style={styles.progressLineBg}>
                    <View style={[styles.progressLineFill, { width: progress.total ? `${(progress.current / progress.total) * 100}%` : '0%' }]} />
                  </View>
                  <P style={styles.progressUploadingText}>{t('complete.uploadingProgress', { current: progress.current, total: progress.total })}</P>
                </View>
              )}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <Button title={t('common.back')} variant="ghost" onPress={() => router.push('(auth)/complete/prompts' as any)} />
                <Button disabled={uploading || photos.length < 1} title={uploading ? t('complete.uploading') : t('common.continue')} onPress={async () => {
                  // Validación: mínimo 1 foto antes de continuar
                  if (photos.length < 1) {
                    Alert.alert(t('complete.minOnePhoto'));
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
                    router.push('(auth)/complete/summary' as any);
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
                }} />
              </View>
            </Card>
          </View>
  </CenterScaffold>
      </KeyboardAvoidingView>
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
  grid: { flex: 1 },
  placeholder: { borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surface, margin: 4 },
  thumbWrap: { position: 'relative', borderRadius: 12, overflow: 'hidden' },
  thumb: { borderRadius: 12 },
  remove: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, paddingHorizontal: 6, paddingVertical: 2 },
  progressUploading: { width: '100%', gap: 6, marginTop: 8 },
  progressLineBg: { height: 6, width: '100%', backgroundColor: theme.colors.surfaceAlt, borderRadius: 6, overflow: 'hidden' },
  progressLineFill: { height: '100%', backgroundColor: theme.colors.primary },
  progressUploadingText: { color: theme.colors.textDim, fontSize: 12, textAlign: 'center' },
  hint: { color: theme.colors.textDim, fontSize: 12, marginBottom: 8 },
});
