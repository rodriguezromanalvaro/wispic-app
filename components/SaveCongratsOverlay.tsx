import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Pressable, Dimensions } from 'react-native';
import { H1, P, Button } from './ui';
import { theme } from '../lib/theme';
import ConfettiCannon from 'react-native-confetti-cannon';

type Props = {
  visible: boolean;
  title: string;
  body: string;
  primaryText: string;
  secondaryText?: string;
  onPrimary: () => void;
  onSecondary?: () => void;
  onRequestClose?: () => void;
  confetti?: boolean; // permite desactivar confeti
};

export const SaveCongratsOverlay: React.FC<Props> = ({ visible, title, body, primaryText, secondaryText, onPrimary, onSecondary, onRequestClose, confetti = true }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.96)).current;
  const [burstKey, setBurstKey] = useState(0);
  const { width, height } = Dimensions.get('window');

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 100, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 7, useNativeDriver: true })
      ]).start();
  // dispara confetti inmediatamente al abrir (si está activo)
  if (confetti) setBurstKey((k) => k + 1);
    } else {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.96, duration: 150, useNativeDriver: true })
      ]).start();
    }
  }, [visible, opacity, scale, confetti]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.backdrop, { opacity }]}>      
      <Pressable style={StyleSheet.absoluteFill} onPress={onRequestClose} />
      <Animated.View style={[styles.card, { transform: [{ scale }] }]}>        
        <View style={styles.cardInner}>
          <H1 style={styles.title}>{title}</H1>
          <P style={styles.body}>{body}</P>
          <View style={{ gap: 8, marginTop: 12 }}>
            <Button title={primaryText} onPress={onPrimary} size="lg" />
            {secondaryText && onSecondary ? (
              <Button title={secondaryText} onPress={onSecondary} variant="outline" />
            ) : null}
          </View>
        </View>
      </Animated.View>
      {/* Confetti por encima de la tarjeta para máxima visibilidad */}
      {confetti ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <ConfettiCannon
            key={`confetti-bottom-center-${burstKey}`}
            count={120}
            origin={{ x: width * 0.5, y: height + 10 }}
            fadeOut
            explosionSpeed={460}
            fallSpeed={1500}
          />
          <ConfettiCannon
            key={`confetti-bottom-left-${burstKey}`}
            count={80}
            origin={{ x: width * 0.2, y: height + 10 }}
            fadeOut
            explosionSpeed={460}
            fallSpeed={1500}
          />
          <ConfettiCannon
            key={`confetti-bottom-right-${burstKey}`}
            count={80}
            origin={{ x: width * 0.8, y: height + 10 }}
            fadeOut
            explosionSpeed={460}
            fallSpeed={1500}
          />
        </View>
      ) : null}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 999 },
  card: { width: '100%', maxWidth: 420 },
  cardInner: { backgroundColor: theme.colors.card, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, padding: 16 },
  title: { textAlign: 'center', fontSize: 22 },
  body: { textAlign: 'center', color: theme.colors.subtext, marginTop: 6 },
});
