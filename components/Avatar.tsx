import { View, Text } from 'react-native';

export default function Avatar({ name }: { name?: string }) {
  const initials = (name || '??').substring(0, 2).toUpperCase();
  return (
    <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#ddd', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontWeight: '700' }}>{initials}</Text>
    </View>
  );
}
