import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  radius?: number;
  style?: any;
}

export const Skeleton: React.FC<SkeletonProps> = ({ width = '100%', height = 20, radius = 12, style }) => {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 0, useNativeDriver: true })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  const translateX = shimmer.interpolate({ inputRange: [0,1], outputRange: [-100, 200] });

  return (
    <View style={[styles.base, { width, height, borderRadius: radius }, style]}>
      <Animated.View style={[styles.shimmerWrap, { transform: [{ translateX }] }] }>
        <LinearGradient colors={['rgba(255,255,255,0)','rgba(255,255,255,0.25)','rgba(255,255,255,0)']} start={{x:0,y:0}} end={{x:1,y:0}} style={styles.gradient} />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  base: { backgroundColor: 'rgba(255,255,255,0.08)', overflow:'hidden', position:'relative' },
  shimmerWrap: { position:'absolute', top:0, bottom:0, width:120 },
  gradient: { flex:1 }
});
