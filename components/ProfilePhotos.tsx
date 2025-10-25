// components/ProfilePhotos.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { theme } from '../lib/theme';
import { decode } from 'base64-arraybuffer';
import { generateSimpleId } from '../lib/utils';

// Define el tipo para las fotos de usuario
type UserPhoto = {
  id: number;
  url: string;
  sort_order: number;
  user_id: string;
};

type ProfilePhotosProps = {
  userId: string;
};

const ProfilePhotos: React.FC<ProfilePhotosProps> = ({ userId }) => {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);

  // Consulta las fotos existentes del usuario
  const {
    data: photos,
    isLoading,
    isError,
  } = useQuery<UserPhoto[]>({
    queryKey: ['user_photos', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_photos')
        .select('*')
        .eq('user_id', userId)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  // Mutación para eliminar una foto
  const deletePhotoMutation = useMutation({
    mutationFn: async (photoId: number) => {
      // Primero obtenemos la URL para eliminar el archivo de Storage
      const { data: photoData, error: fetchError } = await supabase
        .from('user_photos')
        .select('url')
        .eq('id', photoId)
        .single();

      if (fetchError) throw fetchError;

      // Extraer el path del storage de la URL completa
      const filePathMatch = photoData.url.match(/\/storage\/v1\/object\/public\/(.+)/);
      if (!filePathMatch) throw new Error('Invalid file path format');
      
      const storagePath = filePathMatch[1];
      
      // Eliminar el archivo de Storage
      const { error: storageError } = await supabase.storage
        .from('user-photos')
        .remove([storagePath.replace('user-photos/', '')]);

      if (storageError) {
        console.error('Error removing from storage:', storageError);
        // Continuamos con la eliminación del registro incluso si falla el storage
      }

      // Eliminar el registro de la base de datos
      const { error: dbError } = await supabase
        .from('user_photos')
        .delete()
        .eq('id', photoId)
        .eq('user_id', userId);

      if (dbError) throw dbError;

      return photoId;
    },
    onSuccess: () => {
      // Invalidar todas las consultas relacionadas con el perfil
      queryClient.invalidateQueries({ queryKey: ['user_photos', userId] });
      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
      queryClient.invalidateQueries({ queryKey: ['photos_count', userId] });
      queryClient.invalidateQueries({ queryKey: ['profile_prompts', userId] });
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'No se pudo eliminar la foto');
    },
  });

  // Función para reordenar fotos
  const movePhoto = async (photoId: number, direction: 'up' | 'down') => {
    if (!photos || photos.length <= 1) return;

    // Encuentra el índice actual
    const currentIndex = photos.findIndex(p => p.id === photoId);
    if (currentIndex === -1) return;

    // Determina el nuevo índice basado en la dirección
    const newIndex = direction === 'up' 
      ? Math.max(0, currentIndex - 1) 
      : Math.min(photos.length - 1, currentIndex + 1);

    // Si no hay cambio, no hacemos nada
    if (newIndex === currentIndex) return;

    // Intercambia los órdenes
    const photoToMove = photos[currentIndex];
    const otherPhoto = photos[newIndex];

    // Actualiza los órdenes en la base de datos
    try {
      // Usamos un valor temporal para evitar conflictos de unicidad
      const tempOrder = -1000;

      await supabase
        .from('user_photos')
        .update({ sort_order: tempOrder })
        .eq('id', photoToMove.id);

      await supabase
        .from('user_photos')
        .update({ sort_order: photoToMove.sort_order })
        .eq('id', otherPhoto.id);

      await supabase
        .from('user_photos')
        .update({ sort_order: otherPhoto.sort_order })
        .eq('id', photoToMove.id);

      // Refresca los datos
      queryClient.invalidateQueries({ queryKey: ['user_photos', userId] });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudieron reordenar las fotos');
    }
  };

  // Función para seleccionar una imagen de la galería
  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images', // Usar string literal en lugar de MediaTypeOptions.Images
        allowsEditing: true,
        aspect: [4, 5],
        quality: 0.8,
        base64: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      if (!asset.base64) {
        Alert.alert('Error', 'No se pudo obtener la imagen en formato base64');
        return;
      }

      uploadImage(asset.base64);
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'No se pudo seleccionar la imagen');
    }
  };

  // Función para subir la imagen a Supabase Storage
  const uploadImage = async (base64Image: string) => {
    try {
      setUploading(true);

      // Crear un nombre único para el archivo
      const fileExt = 'jpg'; // Asumimos jpg para simplificar
      const fileName = `${generateSimpleId('photo_')}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      // Subir a Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('user-photos')
        .upload(filePath, decode(base64Image), {
          contentType: 'image/jpeg',
          upsert: true, // Permitir sobrescribir si es necesario
        });

      if (uploadError) {
        throw uploadError;
      }

      // Obtener la URL pública
      const { data: publicUrlData } = supabase.storage
        .from('user-photos')
        .getPublicUrl(filePath);

      if (!publicUrlData || !publicUrlData.publicUrl) {
        throw new Error('No se pudo obtener la URL pública de la imagen');
      }

      // Determinar el orden de la nueva foto
      const maxOrder = photos?.length ? Math.max(...photos.map(p => p.sort_order)) + 1 : 0;

      // Guardar en la base de datos
      const { error: dbError } = await supabase
        .from('user_photos')
        .insert({
          user_id: userId,
          url: publicUrlData.publicUrl,
          sort_order: maxOrder,
        });

      if (dbError) {
        throw dbError;
      }

      // Invalidar todas las consultas relacionadas con el perfil
      queryClient.invalidateQueries({ queryKey: ['user_photos', userId] });
      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
      queryClient.invalidateQueries({ queryKey: ['photos_count', userId] });
      queryClient.invalidateQueries({ queryKey: ['profile_prompts', userId] });
      
      Alert.alert('Éxito', 'Imagen subida correctamente');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo subir la imagen');
      console.error('Upload error:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePhoto = (photoId: number) => {
    Alert.alert(
      'Eliminar foto',
      '¿Estás seguro de que quieres eliminar esta foto?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => deletePhotoMutation.mutate(photoId),
        },
      ]
    );
  };

  // Renderiza el botón de subir foto
  const renderUploadButton = () => {
    const canUpload = !uploading && (!photos || photos.length < 6); // Límite de 6 fotos

    return (
      <TouchableOpacity
        style={[
          styles.uploadButton,
          !canUpload && styles.uploadButtonDisabled,
        ]}
        onPress={pickImage}
        disabled={!canUpload}
      >
        {uploading ? (
          <ActivityIndicator color={theme.colors.primary} />
        ) : (
          <>
            <FontAwesome
              name="plus"
              size={24}
              color={canUpload ? theme.colors.primary : theme.colors.border}
            />
            <Text
              style={{
                color: canUpload ? theme.colors.primary : theme.colors.border,
                marginTop: 8,
              }}
            >
              Subir foto
            </Text>
          </>
        )}
      </TouchableOpacity>
    );
  };

  // Renderiza una foto individual con sus controles
  const renderPhoto = (photo: UserPhoto, index: number) => {
    const isFirst = index === 0;
    const isLast = index === (photos?.length || 0) - 1;

    return (
      <View key={photo.id} style={styles.photoContainer}>
        <Image source={{ uri: photo.url }} style={styles.photo} />
        
        <View style={styles.photoControls}>
          <TouchableOpacity
            style={[
              styles.photoControlButton,
              isFirst && styles.photoControlButtonDisabled,
            ]}
            onPress={() => movePhoto(photo.id, 'up')}
            disabled={isFirst}
          >
            <FontAwesome
              name="arrow-up"
              size={16}
              color={isFirst ? theme.colors.border : theme.colors.text}
            />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.photoControlButton,
              isLast && styles.photoControlButtonDisabled,
            ]}
            onPress={() => movePhoto(photo.id, 'down')}
            disabled={isLast}
          >
            <FontAwesome
              name="arrow-down"
              size={16}
              color={isLast ? theme.colors.border : theme.colors.text}
            />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.photoControlButton, styles.deleteButton]}
            onPress={() => handleDeletePhoto(photo.id)}
          >
            <FontAwesome name="trash" size={16} color={theme.colors.danger} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Fotos del perfil</Text>
        <Text style={styles.subtitle}>
          Añade hasta 6 fotos para mostrar tu personalidad
        </Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color={theme.colors.primary} style={styles.loader} />
      ) : isError ? (
        <Text style={styles.errorText}>Error al cargar las fotos</Text>
      ) : (
        <>
          <ScrollView horizontal style={styles.photosContainer}>
            {photos?.map(renderPhoto)}
            {renderUploadButton()}
          </ScrollView>
          
          {photos?.length === 0 && !uploading && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                Aún no has subido ninguna foto.
              </Text>
              <Text style={styles.emptyStateSubtext}>
                Las fotos de alta calidad aumentan tus posibilidades de coincidir.
              </Text>
            </View>
          )}
          
          {photos && photos.length > 0 && (
            <Text style={styles.helpText}>
              * Arrastra las fotos para reordenarlas. La primera foto será tu foto de perfil principal.
            </Text>
          )}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: theme.spacing(1),
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius,
  },
  header: {
    marginBottom: theme.spacing(1),
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.subtext,
    marginTop: 4,
  },
  loader: {
    marginVertical: theme.spacing(2),
  },
  errorText: {
    color: theme.colors.danger,
    textAlign: 'center',
    marginVertical: theme.spacing(2),
  },
  photosContainer: {
    flexGrow: 0,
    paddingVertical: theme.spacing(1),
  },
  photoContainer: {
    marginRight: theme.spacing(1),
    position: 'relative',
  },
  photo: {
    width: 120,
    height: 150,
    borderRadius: theme.radius,
  },
  photoControls: {
    position: 'absolute',
    right: 8,
    top: 8,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: theme.radius,
    padding: 4,
    flexDirection: 'column',
    gap: 8,
  },
  photoControlButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoControlButtonDisabled: {
    opacity: 0.5,
  },
  deleteButton: {
    backgroundColor: 'white',
  },
  uploadButton: {
    width: 120,
    height: 150,
    borderRadius: theme.radius,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadButtonDisabled: {
    borderColor: theme.colors.border,
    opacity: 0.6,
  },
  emptyState: {
    paddingVertical: theme.spacing(2),
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: theme.colors.subtext,
    textAlign: 'center',
  },
  helpText: {
    fontSize: 12,
    color: theme.colors.subtext,
    fontStyle: 'italic',
    marginTop: theme.spacing(1),
  },
});

export default ProfilePhotos;