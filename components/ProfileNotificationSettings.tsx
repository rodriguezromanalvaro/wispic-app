import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch, ScrollView, Alert } from 'react-native';
import { theme } from '../lib/theme';
import { Card } from './ui';

interface NotificationSettings {
  achievement_unlocked: boolean;
  level_up: boolean;
  profile_views: boolean;
  profile_likes: boolean;
  profile_matches: boolean;
  profile_completion_reminders: boolean;
}

interface ProfileNotificationSettingsProps {
  userId: string;
}

const ProfileNotificationSettings: React.FC<ProfileNotificationSettingsProps> = ({ userId }) => {
  const [settings, setSettings] = useState<NotificationSettings>({
    achievement_unlocked: true,
    level_up: true,
    profile_views: true,
    profile_likes: true,
    profile_matches: true,
    profile_completion_reminders: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchSettings() {
      try {
        setLoading(true);
        
        // En una implementación real, obtendrías la configuración de Supabase
        // const { data, error } = await supabase
        //   .from('user_notification_settings')
        //   .select('*')
        //   .eq('user_id', userId)
        //   .single();
        
        // if (error && error.code !== 'PGRST116') throw error;
        
        // if (data) {
        //   setSettings(data);
        // }

        // Simulamos una carga de datos
        setTimeout(() => {
          setLoading(false);
        }, 500);
      } catch (error) {
        console.error('Error al cargar configuración de notificaciones:', error);
        Alert.alert('Error', 'No se pudo cargar la configuración de notificaciones');
        setLoading(false);
      }
    }

    if (userId) {
      fetchSettings();
    }
  }, [userId]);

  const handleSettingChange = async (setting: keyof NotificationSettings, value: boolean) => {
    try {
      const newSettings = { ...settings, [setting]: value };
      setSettings(newSettings);
      
      setSaving(true);
      
      // En una implementación real, guardarías la configuración en Supabase
      // const { error } = await supabase
      //   .from('user_notification_settings')
      //   .upsert({
      //     user_id: userId,
      //     ...newSettings,
      //     updated_at: new Date().toISOString()
      //   });
      
      // if (error) throw error;
      
      // Simular el guardado
      setTimeout(() => {
        setSaving(false);
      }, 500);
      
    } catch (error) {
      console.error('Error al guardar configuración:', error);
      Alert.alert('Error', 'No se pudo guardar la configuración');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card style={styles.container}>
        <Text style={styles.title}>Configuración de notificaciones</Text>
        <Text style={styles.loadingText}>Cargando configuración...</Text>
      </Card>
    );
  }

  return (
    <Card style={styles.container}>
      <Text style={styles.title}>Configuración de notificaciones</Text>
      <Text style={styles.subtitle}>
        Personaliza qué notificaciones quieres recibir sobre la actividad de tu perfil
      </Text>

      <ScrollView style={styles.settingsContainer}>
        <SettingItem 
          title="Logros desbloqueados" 
          description="Recibe notificaciones cuando desbloquees un nuevo logro"
          value={settings.achievement_unlocked}
          onValueChange={(value) => handleSettingChange('achievement_unlocked', value)}
          disabled={saving}
        />
        
        <SettingItem 
          title="Subidas de nivel" 
          description="Recibe notificaciones cuando subas de nivel"
          value={settings.level_up}
          onValueChange={(value) => handleSettingChange('level_up', value)}
          disabled={saving}
        />
        
        <SettingItem 
          title="Vistas de perfil" 
          description="Recibe notificaciones cuando alguien vea tu perfil"
          value={settings.profile_views}
          onValueChange={(value) => handleSettingChange('profile_views', value)}
          disabled={saving}
        />
        
        <SettingItem 
          title="Likes recibidos" 
          description="Recibe notificaciones cuando alguien le dé like a tu perfil"
          value={settings.profile_likes}
          onValueChange={(value) => handleSettingChange('profile_likes', value)}
          disabled={saving}
        />
        
        <SettingItem 
          title="Nuevos matches" 
          description="Recibe notificaciones cuando consigas un nuevo match"
          value={settings.profile_matches}
          onValueChange={(value) => handleSettingChange('profile_matches', value)}
          disabled={saving}
        />
        
        <SettingItem 
          title="Recordatorios de perfil" 
          description="Recibe recordatorios para completar tu perfil"
          value={settings.profile_completion_reminders}
          onValueChange={(value) => handleSettingChange('profile_completion_reminders', value)}
          disabled={saving}
        />
      </ScrollView>

      {saving && (
        <Text style={styles.savingText}>Guardando cambios...</Text>
      )}
    </Card>
  );
};

interface SettingItemProps {
  title: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}

const SettingItem: React.FC<SettingItemProps> = ({ 
  title, 
  description, 
  value, 
  onValueChange,
  disabled 
}) => (
  <View style={styles.settingItem}>
    <View style={styles.settingTextContainer}>
      <Text style={styles.settingTitle}>{title}</Text>
      <Text style={styles.settingDescription}>{description}</Text>
    </View>
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
      thumbColor={value ? theme.colors.white : '#f4f3f4'}
      disabled={disabled}
    />
  </View>
);

const styles = StyleSheet.create({
  container: {
    padding: theme.spacing(1),
    marginHorizontal: theme.spacing(1),
    marginTop: theme.spacing(1),
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing(0.5),
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.subtext,
    marginBottom: theme.spacing(1.5),
  },
  loadingText: {
    fontSize: 14,
    color: theme.colors.subtext,
    marginTop: theme.spacing(1),
  },
  savingText: {
    fontSize: 14,
    color: theme.colors.primary,
    marginTop: theme.spacing(1),
    fontStyle: 'italic',
    textAlign: 'center',
  },
  settingsContainer: {
    marginTop: theme.spacing(1),
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing(1),
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  settingTextContainer: {
    flex: 1,
    paddingRight: theme.spacing(1),
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: theme.colors.subtext,
  },
});

export default ProfileNotificationSettings;