import React, { useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { theme } from '../../../lib/theme';
import { Badges } from './Badges';
import { AvatarCompletionRing } from './AvatarCompletionRing';
import { CompletionResult } from '../logic/computeCompletion';

interface ProfileHeaderProps {
  name?: string | null;
  age?: number | null;
  avatarUrl?: string | null;
  isPremium?: boolean | null;
  verified_at?: string | null;
  completion?: CompletionResult | null;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({ name, age, avatarUrl, isPremium, verified_at, completion }) => {
  return (
    <View style={styles.container}>
      <View style={{ justifyContent:'center', alignItems:'center' }}>
        {completion ? (
          <AvatarCompletionRing completion={completion} size={80} strokeWidth={5} hideRemainingLabel hidePercent>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.placeholder]} />
            )}
          </AvatarCompletionRing>
        ) : (
          <View style={styles.avatarWrap}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.placeholder]} />
            )}
          </View>
        )}
        {completion && (
          <Text style={styles.percentBelow}>{completion.score}%</Text>
        )}
      </View>
      <View style={[styles.info, { flexDirection:'column', alignItems:'flex-start', justifyContent:'center' }]}> 
        <View style={styles.nameRow}>
          <Text
            style={styles.name}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {name || '—'}
          </Text>
          {age ? (
            <Text style={styles.age}>{`, ${age}`}</Text>
          ) : null}
        </View>
        <Badges isPremium={!!isPremium} verified_at={verified_at || null} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flexDirection:'row', alignItems:'center', gap:16 },
  avatarWrap: { },
  avatar: { width:72, height:72, borderRadius:72, backgroundColor:'rgba(255,255,255,0.08)', borderWidth:1, borderColor:'rgba(255,255,255,0.2)' },
  placeholder: { },
  info: { flex:1, gap:4 },
  nameRow: { flexDirection:'row', alignItems:'flex-end', maxWidth:'100%' },
  name: { flexShrink:1, color: theme.colors.white, fontSize:32, lineHeight:34, fontWeight:'700', letterSpacing:0.3 },
  age: { color: theme.colors.subtext, fontSize:20, lineHeight:30, fontWeight:'600', marginLeft:4 },
  compactCompletionBox: { backgroundColor:'rgba(255,255,255,0.10)', paddingHorizontal:10, paddingVertical:6, borderRadius:12, minWidth:52, alignItems:'center' },
  compactCompletionText: { color:'#fff', fontSize:14, fontWeight:'700', letterSpacing:0.5 },
  percentBelow: { color:'#fff', fontSize:12, fontWeight:'600', marginTop:4 }
});
