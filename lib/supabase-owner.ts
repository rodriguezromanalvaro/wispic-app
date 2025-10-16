import { supabase } from './supabase';

export type VenueCategory = 'bar' | 'discoteca' | 'sala_conciertos' | 'sala_eventos' | 'pub' | 'otro';

export type OwnerOnboardingPayload = {
  userId: string;
  name: string;
  email: string | null;
  phone: string | null;
  category: VenueCategory | null;
  cityId: number | null;
  locationText: string | null;
  description: string | null;
  avatarUrl: string | null;
  promote: boolean;
  attract: boolean;
  other: string | null;
};

export async function upsertOwnerOnboarding(payload: OwnerOnboardingPayload): Promise<{ venueId: number }>{
  // The SQL function expects specific types; pass nulls when optional fields are not provided
  const { data, error } = await supabase.rpc('owner_onboarding_upsert', {
    p_user_id: payload.userId,
    p_name: payload.name,
    p_email: payload.email,
    p_phone: payload.phone,
    p_category: payload.category,
    p_city_id: payload.cityId,
    p_location_text: payload.locationText,
    p_description: payload.description,
    p_avatar_url: payload.avatarUrl,
    p_promote: payload.promote,
    p_attract: payload.attract,
    p_other: payload.other,
  });

  if (error) throw error;

  // Supabase RPC returns the scalar in data directly
  const venueId = data as unknown as number;
  return { venueId };
}
