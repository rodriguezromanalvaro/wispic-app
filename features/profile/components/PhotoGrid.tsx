import React from 'react';
import { View, Image, Pressable, StyleSheet, Text, Alert } from 'react-native';
import { theme } from '../../../lib/theme';
import { Ionicons } from '@expo/vector-icons';

export interface PhotoGridItem { id: string|number; url: string; sort_order?: number; }

interface PhotoGridProps {
  photos: PhotoGridItem[];
  max?: number; // default 6
  editable?: boolean; // user can manage photos
  onAdd?: () => void;
  onPressPhoto?: (item: PhotoGridItem, index: number) => void; // tap existing (view/replace)
  onRemove?: (item: PhotoGridItem, index: number) => void; // remove existing (long press future)
}

// 3 columns x 2 rows layout
export const PhotoGrid: React.FC<PhotoGridProps> = ({ photos, max = 6, editable, onAdd, onPressPhoto, onRemove }) => {
  const ordered = [...photos].sort((a,b)=> (a.sort_order ?? 0) - (b.sort_order ?? 0)).slice(0, max);
  const missing = Math.max(0, max - ordered.length);
  const cells: (PhotoGridItem | null)[] = [...ordered, ...Array.from({ length: missing }).map(()=> null)];

  const confirmRemove = (item: PhotoGridItem, idx: number) => {
    if (!onRemove) return;
    Alert.alert('Eliminar foto', '¿Seguro que quieres eliminar esta foto?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => onRemove(item, idx) }
    ]);
  };

  return (
    <View style={styles.grid}> 
      {cells.map((cell, idx) => {
        if (cell) {
          return (
            <View key={String(cell.id)} style={styles.cell}>
              <Pressable style={styles.inner} disabled={!onPressPhoto} onPress={()=> onPressPhoto?.(cell, idx)}>
                <Image source={{ uri: cell.url }} style={styles.photo} />
                <View style={styles.overlay} />
              </Pressable>
              {editable && (
                <Pressable onPress={()=> confirmRemove(cell, idx)} style={styles.deleteBtn} hitSlop={8}>
                  <Ionicons name="remove" size={18} color={theme.colors.white} />
                </Pressable>
              )}
            </View>
          );
        }
        return (
          <Pressable key={`empty-${idx}`} style={[styles.cell, styles.emptyCell]} disabled={!editable || !onAdd} onPress={onAdd}>
            {editable ? (
              <View style={styles.addInner}>
                <Ionicons name="add" size={30} color={theme.colors.primary} />
                {/* Single icon only; removed duplicate '+' text */}
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  grid: {
    flexDirection:'row',
    flexWrap:'wrap',
    justifyContent:'space-between',
    rowGap: 12,
    columnGap: 10,
    marginTop:4
  },
  cell: {
    width: '31.5%',
    aspectRatio: 3/4,
    borderRadius:14,
    overflow:'hidden',
    backgroundColor: theme.colors.card,
    borderWidth:1,
    borderColor: theme.colors.border,
    position:'relative'
  },
  inner: { flex:1 },
  photo: { width:'100%', height:'100%' },
  overlay: { position:'absolute', left:0, right:0, top:0, bottom:0, backgroundColor:'rgba(0,0,0,0.10)' },
  emptyCell: {
    alignItems:'center',
    justifyContent:'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius:14,
  },
  addInner: { alignItems:'center', justifyContent:'center' },
  deleteBtn: {
    position:'absolute',
    top:4,
    right:4,
    width:26,
    height:26,
    borderRadius:13,
    backgroundColor:'rgba(0,0,0,0.55)',
    alignItems:'center',
    justifyContent:'center',
    borderWidth:1,
    borderColor:'rgba(255,255,255,0.25)'
  },
  // remove overlay removed; using long press now
});

export default PhotoGrid;