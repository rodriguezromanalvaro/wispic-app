import React from 'react';
import { View } from 'react-native';

interface PhotoDotsProps { total: number; current: number; }

export const PhotoDots: React.FC<PhotoDotsProps> = ({ total, current }) => {
  if (total <= 1) return null;
  return (
    <View style={{ flexDirection:'row', gap:6, alignSelf:'center', marginTop:12 }}>
      {Array.from({ length: total }).map((_,i) => {
        const active = i === current;
        return <View key={i} style={{ width: active ? 18 : 8, height:8, borderRadius:999, backgroundColor: active ? 'white' : 'rgba(255,255,255,0.35)' }} />;
      })}
    </View>
  );
};
