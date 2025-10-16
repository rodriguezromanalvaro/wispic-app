# Sistema de Gamificación de Perfiles

Este documento describe el sistema de gamificación implementado para incentivar a los usuarios a completar sus perfiles y aumentar su actividad en la plataforma.

## Características implementadas

### 1. Sistema de Perfil Completado
- **Indicador visual** de completitud del perfil
- **Badges** que muestran el nivel del perfil
- **Notificaciones** que invitan a completar secciones específicas
- **Navegación directa** a las secciones incompletas

### 2. Sistema de Estadísticas
- **Visualización de actividad** (matches, likes, visitas)
- **Actividad semanal** con indicador de progreso
- **Ranking** comparativo con otros usuarios
- **Consejos personalizados** según actividad

### 3. Sistema de Logros
- **Logros desbloqueables** por completar acciones
- **Recompensas** por logros conseguidos
- **Progreso visual** de cada logro
- **Detalles** sobre cómo conseguir logros pendientes

### 4. Sistema de Notificaciones
- **Alertas personalizables** sobre actividad
- **Recordatorios** para completar el perfil
- **Celebraciones** por logros desbloqueados
- **Configuración** individual para cada tipo de notificación

## Estructura de la Base de Datos

El sistema utiliza las siguientes tablas en Supabase:

| Tabla | Descripción |
|-------|-------------|
| `user_statistics` | Almacena estadísticas de uso e interacción |
| `achievement_templates` | Define los logros disponibles |
| `user_achievements` | Registra el progreso de logros por usuario |
| `user_levels` | Sistema de niveles y experiencia |

## Componentes Principales

| Componente | Propósito |
|------------|-----------|
| `ProfileCompletionBadge` | Muestra el nivel y progreso del perfil |
| `ProfileNotifications` | Muestra alertas y recordatorios |
| `ProfileStats` | Visualiza estadísticas de actividad |
| `ProfileAchievements` | Gestiona el sistema de logros |
| `ProfileNotificationSettings` | Configura las preferencias de notificación |

## Despliegue

Para desplegar las migraciones en Supabase:

1. Verifica que todas las migraciones estén en la carpeta `supabase/migrations/`
2. Ejecuta el comando de despliegue:

```bash
supabase db push
```

## Instalación de Dependencias

Para un funcionamiento completo, instala:

```bash
npm install react-native-svg react-native-circular-progress-indicator
```

## Configuración de Notificaciones

Para activar las notificaciones push:

1. Registrar el dispositivo al iniciar sesión
2. Configurar los tipos de notificaciones en Perfil > Configuración
3. Permitir los permisos del sistema cuando se soliciten

## Tipos de Logros

| Categoría | Ejemplos |
|-----------|----------|
| Perfil | Completar perfil, Subir fotos |
| Social | Recibir likes, Conseguir matches |
| Actividad | Conversaciones activas, Respuesta rápida |

## Flujo de Experiencia

1. El usuario recibe notificaciones sobre su perfil incompleto
2. Al completar secciones, desbloquea logros iniciales
3. Las recompensas incentivan la actividad en la plataforma
4. El sistema de niveles muestra el progreso a largo plazo

---

Desarrollado como parte de la mejora de experiencia de usuario para aumentar la retención y satisfacción de usuarios.