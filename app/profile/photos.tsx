import React, { useMemo, useRef, useState } from 'react';
import { View, ScrollView, Pressable, Image, StyleSheet, Dimensions, TouchableOpacity, Modal, InteractionManager } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, H1, P, Button } from '../../components/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useProfile } from '../../features/profile/hooks/useProfile';
import { useProfileMutations } from '../../features/profile/hooks/useProfileMutations';
import { CameraView, useCameraPermissions } from 'expo-camera';

export default function PhotosManager() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data, isOwner } = useProfile();
  const mutations = useProfileMutations(data?.id);

  const numColumns = 3;
  const [containerWidth, setContainerWidth] = useState(0);
  const cellSize = useMemo(() => {
    const gap = 8;
    const fallbackW = Math.min(Dimensions.get('window').width - 40, 420);
    const w = containerWidth || fallbackW;
    return Math.floor((w - gap * (numColumns - 1)) / numColumns);
  }, [containerWidth]);
  const photos = (data?.photos || []).slice(0, 6);

  const [sheet, setSheet] = useState<null | { type: 'add' } | { type: 'photo'; index: number }>(null);
  const pickerLockRef = useRef(false);
  const [inlineCamOpen, setInlineCamOpen] = useState(false);
  const [camMode, setCamMode] = useState<null | { action: 'add' } | { action: 'replace'; id: string | number }>(null);
  const cameraRef = useRef<CameraView | null>(null);
  const [camFacing, setCamFacing] = useState<'back' | 'front'>('back');
  const [camPerm, requestCamPerm] = useCameraPermissions();

  function runAfterSheetClosed(fn: () => Promise<void> | void) {
    if (pickerLockRef.current) return;
    pickerLockRef.current = true;
    setSheet(null);
    InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        setTimeout(async () => {
          try {
            await Promise.resolve(fn());
          } finally {
            // pequeño cooldown para evitar dobles toques
            setTimeout(() => { pickerLockRef.current = false; }, 200);
          }
        }, 220); // coincidir con animación de cierre
      });
    });
  }

  return (
    <Screen style={{ padding: 0 }} edges={[]}> 
      {/* Header simple */}
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 8, paddingBottom: 8, flexDirection:'row', alignItems:'center', gap: 8 }}>
        <Pressable onPress={() => router.replace('/profile/configure' as any)} style={{ padding: 8 }} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </Pressable>
        <H1 style={{ fontSize: 20, fontWeight: '800' }}>Fotos</H1>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}>
        <View style={{ alignItems:'center', paddingHorizontal:20, gap:12 }}>
          <P dim>Sube hasta 6 fotos. Mantén tu primera foto como principal.</P>
          <View style={{ width:'100%', maxWidth:420, alignSelf:'center', flexDirection:'row', flexWrap:'wrap', gap:8 }} onLayout={(e)=> setContainerWidth(e.nativeEvent.layout.width)}>
            {Array.from({ length: 6 }).map((_, idx) => {
              const ph = photos[idx];
              if (ph?.url) return (
                <View key={idx} style={{ width: cellSize, height: cellSize }}>
                  <View style={{ width: cellSize, height: cellSize, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: theme.colors.border }}>
                    <Image source={{ uri: ph.url }} style={{ width: cellSize, height: cellSize }} />
                    {isOwner && (
                      <TouchableOpacity style={styles.editBtn} onPress={() => setSheet({ type: 'photo', index: idx })}>
                        <Ionicons name="pencil" size={16} color="#fff" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
              return (
                <TouchableOpacity key={idx} onPress={() => setSheet({ type: 'add' })} activeOpacity={0.8} style={{ width: cellSize, height: cellSize }}>
                  <View style={{ width: cellSize, height: cellSize, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surface }}>
                    <LinearGradient colors={(theme.gradients?.brand as any) || [theme.colors.primary, theme.colors.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.addFab}>
                      <P style={{ color: '#fff', fontWeight: '700', fontSize: 18 }}>＋</P>
                    </LinearGradient>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Bottom sheet: añadir / editar foto */}
      <Modal visible={!!sheet} transparent animationType="fade" onRequestClose={() => setSheet(null)}>
        <View style={styles.sheetOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSheet(null)} />
          <View style={[styles.sheetContainer, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.sheetHandle} />
            {sheet?.type === 'add' && (
              <>
                <H1 style={styles.sheetTitle}>Añadir foto</H1>
                <P dim style={{ marginBottom: 8 }}>Añade de 1 a 6 fotos a tu perfil</P>
                <SheetRow
                  icon={<Ionicons name="camera-outline" size={20} color={theme.colors.text} />}
                  title="Hacer foto con cámara"
                  subtitle="Abrir cámara"
                  onPress={() => runAfterSheetClosed(async () => {
                    if (!camPerm || camPerm.status !== 'granted') {
                      const { status } = await requestCamPerm();
                      if (status !== 'granted') return;
                    }
                    setCamMode({ action: 'add' });
                    setInlineCamOpen(true);
                  })}
                />
                <SheetRow
                  icon={<Ionicons name="images-outline" size={20} color={theme.colors.text} />}
                  title="Añadir desde galería"
                  subtitle="Selecciona una imagen"
                  onPress={() => runAfterSheetClosed(async () => {
                    const picker = await import('expo-image-picker');
                    const ok = await picker.requestMediaLibraryPermissionsAsync();
                    if (!ok.granted && ok.status !== 'granted') return;
                    const res = await picker.launchImageLibraryAsync({ allowsEditing: true, quality: 0.8, aspect: [4, 5] });
                    if (!res.canceled) {
                      const manip = await import('expo-image-manipulator');
                      const out = await manip.manipulateAsync(res.assets[0].uri, [{ resize: { width: 1080 } }], { compress: 0.78, format: manip.SaveFormat.JPEG });
                      mutations.addPhoto.mutate({ fileUri: out.uri, mimeType: 'image/jpeg' });
                    }
                  })}
                />
              </>
            )}
            {sheet?.type === 'photo' && (
              <>
                <H1 style={styles.sheetTitle}>Editar foto</H1>
                <P dim style={{ marginBottom: 8 }}>Reemplaza o elimina esta foto</P>
                <SheetRow
                  icon={<Ionicons name="camera-outline" size={20} color={theme.colors.text} />}
                  title="Reemplazar con cámara"
                  subtitle="Tomar una nueva foto"
                  onPress={() => runAfterSheetClosed(async () => {
                    if (!camPerm || camPerm.status !== 'granted') {
                      const { status } = await requestCamPerm();
                      if (status !== 'granted') return;
                    }
                    const id = photos[(sheet as any).index]?.id as string | number | undefined;
                    if (!id) return;
                    setCamMode({ action: 'replace', id });
                    setInlineCamOpen(true);
                  })}
                />
                <SheetRow
                  icon={<Ionicons name="images-outline" size={20} color={theme.colors.text} />}
                  title="Reemplazar desde galería"
                  subtitle="Elige una foto nueva"
                  onPress={() => runAfterSheetClosed(async () => {
                    const picker = await import('expo-image-picker');
                    const ok = await picker.requestMediaLibraryPermissionsAsync();
                    if (!ok.granted && ok.status !== 'granted') return;
                    const res = await picker.launchImageLibraryAsync({ allowsEditing: true, quality: 0.8, aspect: [4, 5] });
                    if (!res.canceled) {
                      const manip = await import('expo-image-manipulator');
                      const out = await manip.manipulateAsync(res.assets[0].uri, [{ resize: { width: 1080 } }], { compress: 0.78, format: manip.SaveFormat.JPEG });
                      const id = photos[(sheet as any).index]?.id as string | number | undefined;
                      if (id) mutations.replacePhoto.mutate({ id, fileUri: out.uri, mimeType: 'image/jpeg' });
                    }
                  })}
                />
                <SheetRow
                  icon={<Ionicons name="trash-outline" size={20} color={theme.colors.danger} />}
                  title="Quitar"
                  subtitle="Eliminar esta foto del grid"
                  onPress={() => runAfterSheetClosed(() => {
                    const id = photos[(sheet as any).index]?.id as string | number | undefined;
                    if (id) mutations.removePhoto.mutate({ id });
                  })}
                />
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Inline camera modal */}
      <CameraModal
        visible={inlineCamOpen}
        onClose={() => setInlineCamOpen(false)}
        facing={camFacing}
        setFacing={setCamFacing}
        cameraRef={cameraRef}
        onCaptured={async (uri) => {
          try {
            const manip = await import('expo-image-manipulator');
            const out = await manip.manipulateAsync(uri, [{ resize: { width: 1080 } }], { compress: 0.78, format: manip.SaveFormat.JPEG });
            if (camMode?.action === 'add') {
              mutations.addPhoto.mutate({ fileUri: out.uri, mimeType: 'image/jpeg' });
            } else if (camMode?.action === 'replace' && camMode.id) {
              mutations.replacePhoto.mutate({ id: camMode.id, fileUri: out.uri, mimeType: 'image/jpeg' });
            }
          } finally {
            setInlineCamOpen(false);
            setCamMode(null);
          }
        }}
      />
    </Screen>
  );
}

function SheetRow({ icon, title, subtitle, onPress }: { icon: React.ReactNode; title: string; subtitle?: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.sheetRow, pressed && { opacity: 0.85 }]}>
      <View style={styles.sheetIconWrap}>{icon}</View>
      <View style={{ flex: 1 }}>
        <P bold style={styles.sheetRowTitle}>{title}</P>
        {!!subtitle && <P dim style={styles.sheetRowDesc}>{subtitle}</P>}
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.colors.textDim} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  editBtn: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, paddingHorizontal: 6, paddingVertical: 6 },
  addFab: { position: 'absolute', right: 8, bottom: 8, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'flex-end' },
  sheetContainer: { width: '100%', backgroundColor: theme.colors.card, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, borderWidth: 1, borderColor: theme.colors.border },
  sheetHandle: { alignSelf: 'center', width: 44, height: 4, borderRadius: 2, backgroundColor: theme.colors.border, marginBottom: 8 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.text },
  sheetRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: theme.colors.border, gap: 10 },
  sheetIconWrap: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 6, backgroundColor: theme.mode==='dark' ? 'rgba(255,255,255,0.06)' : '#F1F5F9' },
  sheetRowTitle: { color: theme.colors.text, fontWeight: '700' },
  sheetRowDesc: { color: theme.colors.textDim, fontSize: 12 },
});

// Inline camera modal overlay
function CameraModal({ visible, onClose, onCaptured, facing, setFacing, cameraRef }: { visible: boolean; onClose: () => void; onCaptured: (uri: string) => void; facing: 'back'|'front'; setFacing: (f: 'back'|'front') => void; cameraRef: React.RefObject<CameraView | null>; }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} presentationStyle="fullScreen" animationType="slide" onRequestClose={onClose}>
      <View style={{ flex:1, backgroundColor: 'black' }}>
        <CameraView ref={cameraRef as any} style={{ flex: 1 }} facing={facing} />
        <View style={{ position:'absolute', top: insets.top + 8, left: 8, right: 8, flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
          <Pressable onPress={onClose} style={{ padding: 8 }}>
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>
          <Pressable onPress={() => setFacing(facing === 'back' ? 'front' : 'back')} style={{ padding: 8 }}>
            <Ionicons name="camera-reverse" size={28} color="#fff" />
          </Pressable>
        </View>
        <View style={{ position:'absolute', bottom: insets.bottom + 24, left: 0, right: 0, alignItems:'center', justifyContent:'center' }}>
          <Pressable
            onPress={async () => {
              try {
                const cam = cameraRef.current as any;
                if (!cam) return;
                const photo = await cam.takePictureAsync?.({ quality: 0.9 });
                const uri = photo?.uri;
                if (uri) onCaptured(uri);
              } catch {}
            }}
            style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: '#fff', borderWidth: 4, borderColor: 'rgba(255,255,255,0.6)' }}
          />
        </View>
      </View>
    </Modal>
  );
}
