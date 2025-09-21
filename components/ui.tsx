import { Text, View, Pressable, TextInput as RNTextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../lib/theme';

export const Screen: React.FC<{ children: any; style?: any }> = ({ children, style }) => (
  <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['bottom']}>
    <View
      style={[
        {
          flex: 1,
          padding: theme.spacing(2),
          gap: theme.spacing(2),
        },
        style,
      ]}
    >
      {children}
    </View>
  </SafeAreaView>
);

export const Card: React.FC<{
  children: any;
  style?: any;
  onPress?: () => void;
}> = ({ children, style, onPress }) => {
  const baseStyle = {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius,
    padding: theme.spacing(2),
    borderWidth: 1,
    borderColor: theme.colors.border,
  } as const;

  if (onPress) {
    return (
      <Pressable style={[baseStyle, style]} onPress={onPress}>
        {children}
      </Pressable>
    );
  }

  return <View style={[baseStyle, style]}>{children}</View>;
};

export const Button: React.FC<{
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
  style?: any;
}> = ({ title, onPress, variant = 'primary', disabled, style }) => {
  const bg =
    variant === 'primary'
      ? theme.colors.primary
      : variant === 'danger'
      ? theme.colors.danger
      : 'transparent';
  const color = variant === 'primary' ? theme.colors.primaryText : theme.colors.text;
  const border = variant === 'ghost' ? theme.colors.border : 'transparent';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        {
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: theme.radius,
          backgroundColor: disabled ? '#3a3f47' : bg,
          borderWidth: 1,
          borderColor: border,
          opacity: disabled ? 0.7 : 1,
        },
        style,
      ]}
    >
      <Text style={{ textAlign: 'center', color, fontWeight: '700' }}>{title}</Text>
    </Pressable>
  );
};

export const TextInput: React.FC<{
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  multiline?: boolean;
  secureTextEntry?: boolean;
  keyboardType?: any;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  style?: any;
}> = ({
  value,
  onChangeText,
  placeholder,
  multiline,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  style,
}) => (
  <RNTextInput
    value={value}
    onChangeText={onChangeText}
    placeholder={placeholder}
    placeholderTextColor={theme.colors.subtext}
    multiline={multiline}
    secureTextEntry={secureTextEntry}
    keyboardType={keyboardType}
    autoCapitalize={autoCapitalize}
    style={[
      {
        color: theme.colors.text,
        backgroundColor: theme.colors.card,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.radius,
        padding: 12,
        minHeight: multiline ? 100 : undefined,
      },
      style,
    ]}
  />
);

export const H1: React.FC<{ children: any; style?: any }> = ({ children, style }) => (
  <Text style={[{ fontSize: 26, fontWeight: '800', color: theme.colors.text }, style]}>
    {children}
  </Text>
);

export const P: React.FC<{ children: any; style?: any }> = ({ children, style }) => (
  <Text style={[{ color: theme.colors.subtext }, style]}>{children}</Text>
);
