import { View, Text } from 'react-native';
import { theme } from '../../lib/theme';
import { Screen } from '../../components/ui';

export default function OwnerVenue() {
  return (
    <Screen style={{ backgroundColor: theme.colors.bg }}>
      <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '600' }}>Tu local</Text>
      <Text style={{ color: theme.colors.subtext, marginTop: 8 }}>Configura la información, fotos y horarios.</Text>
    </Screen>
  );
}
