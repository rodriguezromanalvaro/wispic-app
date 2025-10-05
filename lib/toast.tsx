import React, { createContext, useCallback, useContext, useState } from 'react';
import { View, Text, Animated, Easing } from 'react-native';
import { theme } from './theme';

type ToastType = 'success' | 'error' | 'info';
interface Toast { id: number; message: string; type: ToastType; }

interface ToastContextValue {
  show: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast outside provider');
  return ctx;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [anim] = useState(new Animated.Value(0));

  const show = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now();
    setToasts(ts => [...ts, { id, message, type }]);
    Animated.timing(anim, { toValue: 1, duration: 200, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
    setTimeout(() => {
      setToasts(ts => ts.filter(t => t.id !== id));
      if (toasts.length <= 1) {
        Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
      }
    }, 3000);
  }, [anim, toasts.length]);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <Animated.View
        pointerEvents="none"
        accessibilityLiveRegion="polite"
        accessible
        style={{ position:'absolute', bottom:40, left:0, right:0, opacity: anim, transform:[{ translateY: anim.interpolate({ inputRange:[0,1], outputRange:[20,0] }) }], alignItems:'center' }}>
        {toasts.map(t => (
          <View key={t.id} style={{ backgroundColor: t.type === 'error' ? theme.colors.danger : t.type === 'success' ? theme.colors.positive : theme.colors.card, paddingHorizontal:16, paddingVertical:12, borderRadius:24, marginTop:8, maxWidth:'80%' }}>
            <Text style={{ color: theme.colors.text }}>{t.message}</Text>
          </View>
        ))}
      </Animated.View>
    </ToastContext.Provider>
  );
};
