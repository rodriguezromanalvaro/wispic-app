import { Pressable, View, Text, StyleSheet } from 'react-native'

import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'

import Svg, { Path, Line } from 'react-native-svg'

import { XStack, YStack } from 'components/tg'
import { theme } from 'lib/theme'



type Props = {
  onPass: () => void
  onLike: () => void
  onSuperLike: () => void
  remaining: number
}

export const SwipeButtons = ({ onPass, onLike, onSuperLike, remaining }: Props) => {
  return (
    <YStack style={{ paddingHorizontal: 18, paddingTop: 8, paddingBottom: 18 }}>
      {/* Glassy panel background */}
      <View style={{ position:'relative', borderRadius: 28, overflow:'hidden', paddingVertical: 14, paddingHorizontal: 12, backgroundColor: theme.colors.overlay }}>
        <BlurView intensity={28} tint={theme.mode === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        {/* Brand glaze */}
        <LinearGradient
          colors={(theme.gradients.brandSoft as any) || ['transparent','transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Border hairline */}
        <View style={{ position:'absolute', inset:0 as any, borderRadius:28, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.border, opacity: 0.7 }} />

        <XStack style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' }}>
        {/* NOPE */}
        <Pressable
          accessibilityLabel="Descartar"
          onPress={onPass}
          style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.92 : 1 }], shadowColor:'#000', shadowOpacity:0.35, shadowRadius:10, elevation:4 })}
        >
            <View style={{ width:60, height:60, borderRadius:20, overflow:'hidden', alignItems:'center', justifyContent:'center' }}>
              <LinearGradient colors={['#ff5f5f','#d93333']} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill} />
              {/* Shine */}
              <LinearGradient colors={['rgba(255,255,255,0.45)','rgba(255,255,255,0)']} start={{x:0,y:0}} end={{x:1,y:1}} style={{ position:'absolute', top:-18, left:-18, right:18, height:40, transform:[{ rotate:'-20deg' }] }} />
              {/* Icon (X) */}
              <Svg width={26} height={26} viewBox="0 0 24 24">
                <Line x1="5" y1="5" x2="19" y2="19" stroke="#fff" strokeWidth={3} strokeLinecap="round" />
                <Line x1="19" y1="5" x2="5" y2="19" stroke="#fff" strokeWidth={3} strokeLinecap="round" />
              </Svg>
              <Text style={{ position:'absolute', bottom:6, fontSize:9, fontWeight:'800', color:'rgba(255,255,255,0.9)', letterSpacing:0.6 }}>NOPE</Text>
            </View>
        </Pressable>
        {/* SUPERLIKE */}
        <Pressable
          accessibilityLabel="Superlike"
          disabled={remaining <= 0}
          onPress={onSuperLike}
            style={({ pressed }) => ({ opacity: remaining<=0?0.5:1, transform: [{ scale: pressed ? 0.9 : 1 }], shadowColor:'#000', shadowOpacity:0.45, shadowRadius:14, elevation:6 })}
        >
            {/* Diamond-shaped button */}
            <View style={{ width:92, height:92, alignItems:'center', justifyContent:'center' }}>
              <View style={{ position:'absolute', width:76, height:76, transform:[{ rotate:'45deg' }], borderRadius:20, overflow:'hidden' }}>
                <LinearGradient colors={ remaining<=0 ? ['#666','#333'] : [theme.colors.primary,'#7d55ff']} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill} />
                {/* Shine */}
                <LinearGradient colors={['rgba(255,255,255,0.45)','rgba(255,255,255,0)']} start={{x:0,y:0}} end={{x:1,y:1}} style={{ position:'absolute', top:-22, left:-22, right:22, height:50, transform:[{ rotate:'-20deg' }] }} />
              </View>
              {/* Outer glow */}
              <View style={{ position:'absolute', width:92, height:92, borderRadius:46, backgroundColor:'rgba(125,85,255,0.25)' }} />
              {/* Icon (Star) upright */}
              <Svg width={32} height={32} viewBox="0 0 24 24" style={{ transform:[{ rotate:'0deg' }] }}>
                <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01z" fill={theme.colors.primaryText || '#fff'} />
              </Svg>
              {/* Badge */}
              <View style={{ position:'absolute', top:-2, right:-2, backgroundColor:'rgba(0,0,0,0.55)', paddingHorizontal:6, paddingVertical:2, borderRadius:12, borderWidth:1, borderColor:'rgba(255,255,255,0.18)' }}>
                <Text style={{ color:'#fff', fontSize:10, fontWeight:'700' }}>{remaining}</Text>
              </View>
              <Text style={{ position:'absolute', bottom:2, fontSize:10, fontWeight:'900', color:'rgba(255,255,255,0.95)', letterSpacing:0.8 }}>SUPER</Text>
            </View>
        </Pressable>
        {/* LIKE */}
        <Pressable
          accessibilityLabel="Like"
          onPress={onLike}
          style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.92 : 1 }], shadowColor:'#000', shadowOpacity:0.35, shadowRadius:10, elevation:4 })}
        >
            <View style={{ width:60, height:60, borderRadius:20, overflow:'hidden', alignItems:'center', justifyContent:'center' }}>
              <LinearGradient colors={['#ff5fa3','#ff3461']} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill} />
              {/* Shine */}
              <LinearGradient colors={['rgba(255,255,255,0.45)','rgba(255,255,255,0)']} start={{x:0,y:0}} end={{x:1,y:1}} style={{ position:'absolute', top:-18, left:-18, right:18, height:40, transform:[{ rotate:'-20deg' }] }} />
              {/* Icon (Heart) */}
              <Svg width={26} height={26} viewBox="0 0 24 24">
                <Path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 6 4 4 6.5 4c1.74 0 3.41 1.01 4.22 2.5C11.09 5.01 12.76 4 14.5 4 17 4 19 6 19 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="#fff" />
              </Svg>
              <Text style={{ position:'absolute', bottom:6, fontSize:9, fontWeight:'800', color:'rgba(255,255,255,0.9)', letterSpacing:0.6 }}>LIKE</Text>
            </View>
        </Pressable>
        </XStack>
      </View>
    </YStack>
  )
}

export default SwipeButtons
