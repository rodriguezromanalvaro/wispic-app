import React, { useRef, useState } from 'react';
import { View, Image, FlatList, Dimensions, TouchableOpacity, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../../../lib/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { PhotoDots } from './PhotoDots';

interface PhotoCarouselProps {
  photos: { id: number|string; url: string }[];
  onAddPress?: () => void;
  editable?: boolean;
}

export const PhotoCarousel: React.FC<PhotoCarouselProps> = ({ photos, onAddPress, editable }) => {
  const { t } = useTranslation();
  const width = Dimensions.get('window').width;
  const [index, setIndex] = useState(0);
  const ref = useRef<FlatList>(null);
  const data = photos && photos.length > 0 ? photos : [];

  if (data.length === 0) {
    return (
      <TouchableOpacity disabled={!editable} onPress={onAddPress} style={{ aspectRatio: 3/4, borderRadius: 20, backgroundColor: theme.colors.card, alignItems:'center', justifyContent:'center' }}>
        <Text style={{ color: theme.colors.subtext }}>{editable ? t('profile.photos.add') : t('profile.photos.empty')}</Text>
      </TouchableOpacity>
    );
  }

  const total = data.length + (editable ? 1 : 0);
  return (
    <View style={{ width: '100%' }}>
      <View style={{ height: width * 4/3 }}>
        <FlatList
          ref={ref}
          data={data}
          horizontal
            onScroll={(e) => {
              const x = e.nativeEvent.contentOffset.x;
              const i = Math.round(x / width);
              if (i !== index) setIndex(i);
            }}
          pagingEnabled
          keyExtractor={(item) => String(item.id)}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={{ width }}>
              <Image source={{ uri: item.url }} style={{ width: '100%', height: '100%' }} />
              <LinearGradient colors={['rgba(0,0,0,0.55)','rgba(0,0,0,0.15)','rgba(0,0,0,0)']} style={{ position:'absolute', left:0, right:0, top:0, bottom:0 }} />
            </View>
          )}
          ListFooterComponent={editable ? (
            <TouchableOpacity onPress={onAddPress} style={{ width, alignItems:'center', justifyContent:'center' }}>
              <View style={{ aspectRatio: 3/4, width: width - 40, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 24, alignItems:'center', justifyContent:'center', borderWidth:1, borderColor: 'rgba(255,255,255,0.15)' }}>
                <Text style={{ color: '#FFFFFF', fontWeight:'600' }}>{t('profile.photos.add')}</Text>
              </View>
            </TouchableOpacity>
          ) : null}
        />
      </View>
      <PhotoDots total={total} current={Math.min(index, total - 1)} />
    </View>
  );
};
