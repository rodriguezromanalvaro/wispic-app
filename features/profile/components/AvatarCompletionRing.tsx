import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { theme } from '../../../lib/theme';
import { CompletionResult } from '../logic/computeCompletion';
import { useTranslation } from 'react-i18next';

interface Props {
  completion?: CompletionResult | null;
  size?: number; // outer diameter
  strokeWidth?: number;
  onPress?: () => void; // optional; if no onPress passed, it's static
  hideRemainingLabel?: boolean;
  hidePercent?: boolean; // hide the percent text inside the ring
}

export const AvatarCompletionRing: React.FC<Props & { children?: React.ReactNode }> = ({ completion, size=78, strokeWidth=6, onPress, hideRemainingLabel, hidePercent, children }) => {
  const pct = Math.min(100, Math.max(0, completion?.score ?? 0));
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  const { t, i18n } = useTranslation();
  const missingCount = completion?.missing?.length || 0;
  const remainingLabel = useMemo(() => {
    if (missingCount === 0) return i18n.language.startsWith('es') ? '¡Listo!' : 'Done!';
    if (i18n.language.startsWith('es')) return missingCount === 1 ? '1 pendiente' : `${missingCount} pendientes`;
    return missingCount === 1 ? '1 left' : `${missingCount} left`;
  }, [missingCount, i18n.language]);
  let color = theme.colors.primary;
  if (pct < 40) color = '#ef4444'; // rojo
  else if (pct < 80) color = '#f59e0b'; // ámbar
  else color = '#10b981'; // verde

  const Wrapper: React.ComponentType<any> = onPress ? (require('react-native').Pressable as any) : View;

  return (
    <Wrapper style={{ width: size, height: size }} onPress={onPress} accessibilityRole={onPress ? 'button' : undefined}>
      <Svg width={size} height={size}>
        <Circle
          cx={size/2}
          cy={size/2}
          r={r}
          stroke={'rgba(255,255,255,0.15)'}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <Circle
          cx={size/2}
          cy={size/2}
          r={r}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={`${dash},${c-dash}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`}
        />
      </Svg>
      <View style={styles.childWrap}>{children}</View>
      {!hidePercent && (
        <View style={styles.badgeWrap} pointerEvents='none'>
          <Text style={styles.badgeText}>{pct}%</Text>
        </View>
      )}
      {!hideRemainingLabel && <Text style={styles.remainingText}>{remainingLabel}</Text>}
    </Wrapper>
  );
};

const styles = StyleSheet.create({
  childWrap: { position:'absolute', left:6, top:6, right:6, bottom:18, borderRadius:999, overflow:'hidden', alignItems:'center', justifyContent:'center' },
  badgeWrap: { position:'absolute', bottom:18, left:0, right:0, alignItems:'center' },
  badgeText: { color:'#fff', fontSize:12, fontWeight:'700' },
  remainingText: { position:'absolute', bottom:-14, width:'100%', textAlign:'center', fontSize:10, color:'rgba(255,255,255,0.65)', fontWeight:'500' }
});

export default AvatarCompletionRing;