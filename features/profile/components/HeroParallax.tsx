import React, { useRef, useState } from 'react';
import { View, Image, Dimensions, Animated, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../../../lib/theme';
import { PhotoDots } from './PhotoDots';
import { Badges } from './Badges';
import { useTranslation } from 'react-i18next';

interface HeroParallaxProps {
  photos: { id: number|string; url: string }[];
  displayName?: string | null;
  age?: number | null;
  isPremium?: boolean | null;
  verified_at?: string | null;
  scrollY: Animated.Value;
  collapseHeight?: number;
  onAddPhoto?: () => void;
  editable?: boolean;
}

export const HeroParallax: React.FC<HeroParallaxProps> = ({ photos, displayName, age, isPremium, verified_at, scrollY, collapseHeight = 220, onAddPhoto, editable }) => {
  const { t } = useTranslation();
  const window = Dimensions.get('window');
  const initialHeight = Math.min(window.height * 0.78, 680);
  const [index, setIndex] = useState(0);
  const listRef = useRef<any>(null);
  const total = photos.length + (editable ? 1 : 0);

  const heroHeight = scrollY.interpolate({
    inputRange: [0, initialHeight - collapseHeight],
    outputRange: [initialHeight, collapseHeight],
    extrapolate: 'clamp'
  });

  const titleOpacity = scrollY.interpolate({
    inputRange: [0, initialHeight - collapseHeight - 40, initialHeight - collapseHeight + 20],
    outputRange: [1, 0.4, 0],
    extrapolate: 'clamp'
  });

  return (
    <Animated.View style={{ height: heroHeight, width: '100%', overflow:'hidden' }}>
      <Animated.FlatList
        ref={listRef}
        data={photos}
        keyExtractor={(i) => String(i.id)}
        horizontal
        pagingEnabled
        onScroll={(e) => {
          const x = e.nativeEvent.contentOffset.x;
          const i = Math.round(x / window.width);
          if (i !== index) setIndex(i);
        }}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={{ width: window.width, height: '100%' }}>
            <Image source={{ uri: item.url }} style={styles.photo} />
            <LinearGradient colors={['rgba(0,0,0,0.75)','rgba(0,0,0,0.35)','rgba(0,0,0,0.05)','rgba(0,0,0,0)']} style={StyleSheet.absoluteFillObject} />
            <LinearGradient colors={['rgba(0,0,0,0)','rgba(0,0,0,0.05)','rgba(0,0,0,0.4)','rgba(0,0,0,0.85)']} style={[StyleSheet.absoluteFillObject]} />
          </View>
        )}
        ListFooterComponent={editable ? (
          <TouchableOpacity onPress={onAddPhoto} style={{ width: window.width, height: '100%', alignItems:'center', justifyContent:'center' }}>
            <View style={styles.addBox}>
              <Text style={{ color: '#fff', fontWeight:'600' }}>{t('profile.photos.add')}</Text>
            </View>
          </TouchableOpacity>
        ) : null}
      />
      <View style={styles.dotsWrap}>
        <PhotoDots total={total} current={Math.min(index, total - 1)} />
      </View>
      <Animated.View style={[styles.identityWrap, { opacity: titleOpacity }] }>
        <Text style={styles.name}>{displayName}{age ? `, ${age}` : ''}</Text>
        <Badges isPremium={isPremium} verified_at={verified_at} />
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  photo: { width: '100%', height: '100%' },
  dotsWrap: { position:'absolute', top:14, left:0, right:0, alignItems:'center' },
  identityWrap: { position:'absolute', left:20, right:20, bottom:26, gap:6 },
  name: { color:'#fff', fontSize:34, fontWeight:'800' },
  addBox: { aspectRatio: 3/4, width: '70%', maxWidth: 340, backgroundColor:'rgba(255,255,255,0.12)', borderRadius:32, borderWidth:1, borderColor:'rgba(255,255,255,0.25)', alignItems:'center', justifyContent:'center' }
});
