import { supabase } from 'lib/supabase';

export type OwnerOnboardingPayload = {
  userId: string;
  name: string;
  category: string; // maps to public.venue_category
  cityId: number | null;
  locationText: string | null;
  lat?: number | null;
  lng?: number | null;
  description: string | null;
  avatarUrl: string | null;
  placeId?: string | null;
  promote: boolean;
  attract: boolean;
  other: string | null;
  increaseSales?: boolean; // new: maps to owner_onboarding_goals.increase_sales
};

export async function upsertOwnerOnboarding(payload: OwnerOnboardingPayload): Promise<{ id: string }> {
  const { userId, name, category, cityId, locationText, description, avatarUrl, promote, attract, other } = payload;

  // Try v3 (with lat/lng); fallback to v2 for backwards-compat
  let data: any, error: any;
  const argsV3 = {
    p_user_id: userId,
    p_name: name,
    p_category: category as any,
    p_city_id: cityId,
    p_location_text: locationText,
    p_description: description,
    p_avatar_url: avatarUrl,
    p_promote: promote,
    p_attract: attract,
    p_other: other,
    p_place_id: payload.placeId ?? null,
    p_increase_sales: payload.increaseSales ?? false,
    p_lat: payload.lat ?? null,
    p_lng: payload.lng ?? null,
  } as const;

  ({ data, error } = await supabase.rpc('owner_onboarding_upsert_v3', argsV3));
  if (error && (error as any).code === '42883') {
    // undefined_function -> older DB: retry v2 without lat/lng
    ({ data, error } = await supabase.rpc('owner_onboarding_upsert_v2', {
      p_user_id: argsV3.p_user_id,
      p_name: argsV3.p_name,
      p_category: argsV3.p_category,
      p_city_id: argsV3.p_city_id,
      p_location_text: argsV3.p_location_text,
      p_description: argsV3.p_description,
      p_avatar_url: argsV3.p_avatar_url,
      p_promote: argsV3.p_promote,
      p_attract: argsV3.p_attract,
      p_other: argsV3.p_other,
      p_place_id: argsV3.p_place_id,
      p_increase_sales: argsV3.p_increase_sales,
    }));
  }

  if (error) {
    const msg = (error.message || '').toLowerCase();
    if (error.code === '23505' || msg.includes('venues_name_city_id_key') || msg.includes('nombre') && msg.includes('ciudad')) {
      throw new Error('Ya existe un local con ese nombre en esa ciudad. Prueba con otro nombre.');
    }
    throw new Error(error.message || 'owner_onboarding_upsert failed');
  }
  // Function returns bigint (venue_id or onboarding id). Normalize to string
  const id = (data as any)?.toString?.() ?? String(data);
  return { id };
}
