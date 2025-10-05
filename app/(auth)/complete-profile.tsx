import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function CompleteProfile() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/(auth)/complete/name');
  }, []);
  return null;
}
