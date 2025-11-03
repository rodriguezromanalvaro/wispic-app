import React, { createContext, useCallback, useContext, useState } from 'react';

import { View, Text, Animated, Easing } from 'react-native';

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
        style={{ position:'absolute', left:0, right:0, top:0, bottom:0, opacity: anim, alignItems:'center', justifyContent:'center' }}>
        {toasts.length > 0 && (
          <View style={{ alignItems:'center', justifyContent:'center', padding:20, borderRadius:16, backgroundColor: 'rgba(0,0,0,0.6)', maxWidth: '80%' }}>
            <Text style={{ fontSize: 28, textAlign:'center', marginBottom:8 }}>
              {toasts[toasts.length-1].type === 'success' ? '✅' : toasts[toasts.length-1].type === 'error' ? '⚠️' : 'ℹ️'}
            </Text>
            <Text style={{ color: '#fff', fontSize: 16, textAlign:'center' }}>{toasts[toasts.length-1].message}</Text>
          </View>
        )}
      </Animated.View>
    </ToastContext.Provider>
  );
};
