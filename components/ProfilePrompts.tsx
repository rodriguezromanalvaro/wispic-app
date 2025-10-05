// components/ProfilePrompts.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Alert, TouchableOpacity } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { ProfilePromptTemplate, ProfilePrompt } from '../lib/types';
import { theme } from '../lib/theme';
import { FontAwesome } from '@expo/vector-icons';
import { Button } from './ui';

type PromptItemProps = {
  prompt: ProfilePrompt;
  onEdit: (prompt: ProfilePrompt) => void;
  onDelete: (promptId: number) => void;
};

const PromptItem: React.FC<PromptItemProps> = ({ prompt, onEdit, onDelete }) => {
  return (
    <View style={styles.promptItem}>
      <View style={styles.promptHeader}>
        <Text style={styles.promptQuestion}>{prompt.question}</Text>
        <View style={styles.promptActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onEdit(prompt)}
          >
            <FontAwesome name="pencil" size={16} color={theme.colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onDelete(prompt.id)}
          >
            <FontAwesome name="trash" size={16} color={theme.colors.danger} />
          </TouchableOpacity>
        </View>
      </View>
      <Text style={styles.promptResponse}>{prompt.response}</Text>
    </View>
  );
};

type PromptEditorProps = {
  userId: string;
  existingPrompt?: ProfilePrompt;
  onCancel: () => void;
  onSave: () => void;
};

const PromptEditor: React.FC<PromptEditorProps> = ({ userId, existingPrompt, onCancel, onSave }) => {
  const queryClient = useQueryClient();
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(
    existingPrompt?.prompt_id || null
  );
  const [response, setResponse] = useState(existingPrompt?.response || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: templates } = useQuery<ProfilePromptTemplate[]>({
    queryKey: ['prompt_templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profile_prompt_templates')
        .select('*')
        .eq('active', true)
        .order('created_at');

      if (error) throw error;
      return data;
    },
  });

  // Si estamos editando, buscamos la pregunta seleccionada
  useEffect(() => {
    if (existingPrompt?.prompt_id) {
      setSelectedTemplateId(existingPrompt.prompt_id);
    }
  }, [existingPrompt]);

  // Mutation para guardar la respuesta
  const savePromptMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTemplateId || !response.trim() || !userId) {
        throw new Error('Debes seleccionar una pregunta y escribir una respuesta');
      }

      const payload: any = {
        profile_id: userId,
        prompt_id: selectedTemplateId,
        answer: response.trim(),
      };

      let result;
      if (existingPrompt?.id) {
        // Actualizar prompt existente
        result = await supabase
          .from('profile_prompts')
          .update(payload)
          .eq('id', existingPrompt.id)
          .select()
          .single();
      } else {
        // Insertar nuevo prompt
        result = await supabase
          .from('profile_prompts')
          .insert(payload)
          .select()
          .single();
      }

      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile_prompts', userId] });
      onSave();
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'No se pudo guardar la respuesta');
    },
  });

  const handleSave = async () => {
    if (!selectedTemplateId) {
      Alert.alert('Error', 'Selecciona una pregunta');
      return;
    }

    if (!response.trim()) {
      Alert.alert('Error', 'Escribe una respuesta');
      return;
    }

    setIsSubmitting(true);
    await savePromptMutation.mutateAsync();
    setIsSubmitting(false);
  };

  // Filtrar las plantillas ya usadas en otros prompts
  const { data: userPrompts } = useQuery<ProfilePrompt[]>({
    queryKey: ['profile_prompts', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profile_prompts')
  .select('*, profile_prompt_templates(question)')
        .eq('profile_id', userId);

      if (error) throw error;
  return data.map(d => ({ ...d, response: (d as any).answer })) as any;
    },
    enabled: !!userId,
  });

  const usedTemplateIds = userPrompts
    ?.filter(p => p.id !== existingPrompt?.id)
    .map(p => p.prompt_id) || [];

  const availableTemplates = templates?.filter(
    template => !usedTemplateIds.includes(template.id) || template.id === existingPrompt?.prompt_id
  );

  return (
    <View style={styles.editorContainer}>
      <Text style={styles.editorTitle}>
        {existingPrompt ? 'Editar respuesta' : 'Añadir nueva respuesta'}
      </Text>

      <Text style={styles.inputLabel}>Pregunta</Text>
      {availableTemplates?.length === 0 ? (
        <Text style={styles.noTemplates}>
          Has respondido a todas las preguntas disponibles.
        </Text>
      ) : (
        <View style={styles.templateSelector}>
          {availableTemplates?.map(template => (
            <TouchableOpacity
              key={template.id}
              style={[
                styles.templateOption,
                selectedTemplateId === template.id && styles.selectedTemplate,
              ]}
              onPress={() => setSelectedTemplateId(template.id)}
            >
              <Text
                style={[
                  styles.templateText,
                  selectedTemplateId === template.id && styles.selectedTemplateText,
                ]}
              >
                {template.question}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Text style={styles.inputLabel}>Tu respuesta</Text>
      <TextInput
        value={response}
        onChangeText={setResponse}
        style={styles.responseInput}
        placeholder="Tu respuesta"
        placeholderTextColor={theme.colors.subtext}
        multiline
        numberOfLines={3}
      />

      <View style={styles.buttonRow}>
        <Button title="Cancelar" onPress={onCancel} variant="ghost" />
        <Button
          title="Guardar"
          onPress={handleSave}
          disabled={!selectedTemplateId || !response.trim() || isSubmitting}
        />
      </View>
    </View>
  );
};

type ProfilePromptsProps = {
  userId: string;
};

const ProfilePrompts: React.FC<ProfilePromptsProps> = ({ userId }) => {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<ProfilePrompt | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // Consulta de prompts del usuario
  const { data: prompts, isLoading } = useQuery<ProfilePrompt[]>({
    queryKey: ['profile_prompts', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profile_prompts')
  .select('id, prompt_id, answer, profile_prompt_templates(question)')
        .eq('profile_id', userId);

      if (error) throw error;
      return data.map((prompt: any) => ({
        id: prompt.id,
        prompt_id: prompt.prompt_id,
        profile_id: userId,
        response: prompt.answer,
        question: prompt.profile_prompt_templates?.question
      })) as any;
    },
    enabled: !!userId,
  });

  // Mutación para eliminar un prompt
  const deletePromptMutation = useMutation({
    mutationFn: async (promptId: number) => {
      const { error } = await supabase
        .from('profile_prompts')
        .delete()
        .eq('id', promptId)
        .eq('profile_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile_prompts', userId] });
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'No se pudo eliminar la respuesta');
    },
  });

  const handleEdit = (prompt: ProfilePrompt) => {
    setEditing(prompt);
    setIsAdding(false);
  };

  const handleDelete = (promptId: number) => {
    Alert.alert(
      'Eliminar respuesta',
      '¿Estás seguro de que quieres eliminar esta respuesta?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Eliminar', 
          style: 'destructive', 
          onPress: () => deletePromptMutation.mutate(promptId) 
        },
      ]
    );
  };

  const handleAdd = () => {
    setEditing(null);
    setIsAdding(true);
  };

  const handleCancel = () => {
    setEditing(null);
    setIsAdding(false);
  };

  const handleSave = () => {
    setEditing(null);
    setIsAdding(false);
  };

  // Mostrar el editor cuando se está añadiendo o editando
  if (isAdding || editing) {
    return (
      <PromptEditor
        userId={userId}
        existingPrompt={editing || undefined}
        onCancel={handleCancel}
        onSave={handleSave}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Prompts de perfil</Text>
        <Button
          title="Añadir"
          onPress={handleAdd}
          variant="ghost"
          style={styles.addButton}
        />
      </View>

      {isLoading ? (
        <Text style={styles.loading}>Cargando prompts...</Text>
      ) : prompts?.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            No has respondido a ninguna pregunta todavía.
          </Text>
          <Text style={styles.emptySubtext}>
            Añade respuestas a preguntas para mostrar más de tu personalidad.
          </Text>
        </View>
      ) : (
        <View style={styles.promptsList}>
          {prompts?.map(prompt => (
            <PromptItem
              key={prompt.id}
              prompt={prompt}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  addButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  promptsList: {
    gap: 16,
  },
  promptItem: {
    gap: 8,
  },
  promptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  promptQuestion: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    flex: 1,
  },
  promptActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 6,
  },
  promptResponse: {
    fontSize: 14,
    color: theme.colors.subtext,
  },
  editorContainer: {
    padding: 16,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius,
    gap: 12,
  },
  editorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 6,
  },
  templateSelector: {
    gap: 8,
    marginBottom: 8,
  },
  templateOption: {
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius,
  },
  selectedTemplate: {
    borderColor: theme.colors.primary,
    backgroundColor: `${theme.colors.primary}20`,
  },
  templateText: {
    color: theme.colors.text,
  },
  selectedTemplateText: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  responseInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius,
    padding: 12,
    color: theme.colors.text,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  loading: {
    color: theme.colors.subtext,
    textAlign: 'center',
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.colors.subtext,
    textAlign: 'center',
  },
  noTemplates: {
    color: theme.colors.subtext,
    textAlign: 'center',
    padding: 16,
    fontStyle: 'italic',
  },
});

export default ProfilePrompts;