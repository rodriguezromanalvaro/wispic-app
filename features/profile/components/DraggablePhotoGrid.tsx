import React, { useCallback, useMemo } from 'react';
import { View, StyleSheet, Pressable, Image, Alert } from 'react-native';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import * as Haptics from 'expo-haptics';
import { theme } from '../../../lib/theme';
import { Ionicons } from '@expo/vector-icons';

export interface DraggablePhoto { id: string|number; url: string; sort_order?: number; }
interface ItemData { id: string|number; url?: string; _empty?: boolean; sort_order?: number; }
interface Props { photos: DraggablePhoto[]; max?: number; editable?: boolean; onAdd?: () => void; onReplace?: (id: string|number) => void; onRemove?: (id: string|number) => void; onReorder?: (orderedIds: (string|number)[]) => void; }

export const DraggablePhotoGrid: React.FC<Props> = ({ photos, max=6, editable, onAdd, onReplace, onRemove, onReorder }) => {
  const data: ItemData[] = useMemo(()=> {
    const ordered = [...photos].sort((a,b)=>(a.sort_order??0)-(b.sort_order??0)).slice(0,max);
    const missing = Math.max(0, max - ordered.length);
    const empties: ItemData[] = Array.from({ length: missing }).map((_,i)=> ({ id: `__empty_${i}`, _empty:true }));
    return [...ordered, ...empties];
  }, [photos, max]);

  const realItemsCount = photos.length;

  const handleDragEnd = useCallback((params: { data: ItemData[] }) => {
    const orderedReal = params.data.filter(i=> !i._empty && i.url !== undefined);
    if (onReorder) onReorder(orderedReal.map(p=> p.id));
  }, [onReorder]);

  const renderItem = useCallback(({ item, drag, isActive }: RenderItemParams<ItemData>) => {
    if (item._empty) {
      return (
        <View style={styles.cell}>
          <Pressable style={[styles.inner, styles.emptyInner]} disabled={!editable || !onAdd} onPress={onAdd}>
            {editable && <Ionicons name="add" size={34} color={theme.colors.primary} />}
          </Pressable>
        </View>
      );
    }
    return (
      <ScaleDecorator>
        <View style={[styles.cell, isActive && styles.activeCell]}>
          <Pressable
            style={styles.inner}
            onLongPress={() => { if (editable) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); drag(); } }}
            delayLongPress={180}
            onPress={() => { if (editable && onReplace) onReplace(item.id); }}
          >
            {item.url ? <Image source={{ uri: item.url }} style={styles.photo} /> : null}
            <View style={styles.overlay} />
          </Pressable>
          {editable && (
            <Pressable onPress={()=> {
              if (!onRemove) return;
              Alert.alert('Eliminar foto', '¿Seguro que quieres eliminar esta foto?', [
                { text: 'Cancelar', style:'cancel' },
                { text: 'Eliminar', style:'destructive', onPress: () => onRemove(item.id) }
              ]);
            }} style={styles.deleteBtn} hitSlop={8}>
              <Ionicons name="remove" size={18} color={theme.colors.white} />
            </Pressable>
          )}
          {editable && <View style={styles.dragHint}><Ionicons name="reorder-three" size={18} color="rgba(255,255,255,0.55)" /></View>}
        </View>
      </ScaleDecorator>
    );
  }, [editable, onAdd, onRemove, onReplace, data]);

  const NUM_COLUMNS = 3; // estable (no cambia en caliente)
  return (
    <View style={styles.wrap}>
      <DraggableFlatList
        data={data}
        key={`photo-grid-${NUM_COLUMNS}`}
        keyExtractor={(it)=> String(it.id)}
        renderItem={renderItem}
        onDragEnd={handleDragEnd}
        activationDistance={12}
        containerStyle={styles.listContainer}
        contentContainerStyle={styles.contentContainer}
        numColumns={NUM_COLUMNS}
        dragItemOverflow={false}
        scrollEnabled={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { width:'100%' },
  listContainer: { },
  contentContainer: { paddingTop:4, paddingBottom:4 },
  cell: {
    width:'31.8%',
    aspectRatio:0.66, // valor anterior más equilibrado
    position:'relative',
    marginBottom:12,
    marginHorizontal:'0.9%'
  },
  inner: {
    flex:1,
    borderRadius:14,
    overflow:'hidden',
    backgroundColor: theme.colors.card,
    borderWidth:1,
    borderColor: theme.colors.border
  },
  activeCell: { },
  photo: { width:'100%', height:'100%', resizeMode:'cover' },
  overlay: { position:'absolute', left:0, right:0, top:0, bottom:0, backgroundColor:'rgba(0,0,0,0.10)' },
  // estilo interno variante para celda vacía (diferencia visual sin cambiar medidas externas)
  emptyInner: {
    alignItems:'center',
    justifyContent:'center',
    backgroundColor: theme.colors.card,
    borderWidth:1.5,
    borderStyle:'dashed',
    borderColor: theme.colors.primary,
  },
  deleteBtn: { position:'absolute', top:8, right:8, width:26, height:26, borderRadius:13, backgroundColor:'rgba(0,0,0,0.55)', alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:'rgba(255,255,255,0.25)' },
  dragHint: { position:'absolute', bottom:8, right:8, padding:2, borderRadius:6, backgroundColor:'rgba(0,0,0,0.25)' }
});

export default DraggablePhotoGrid;
