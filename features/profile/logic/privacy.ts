import { Profile } from '../../../lib/types';

export interface FullProfile extends Profile {
  interested_in?: string[];
  seeking?: string[];
  show_orientation?: boolean;
  show_gender?: boolean;
  show_seeking?: boolean;
  // Notifications
  push_opt_in?: boolean;
  notify_messages?: boolean;
  notify_likes?: boolean;
  notify_friend_requests?: boolean;
  photos?: { id: number|string; url: string; sort_order?: number; main?: boolean }[];
  avatar_url?: string | null;
  photos_count?: number;
  prompts?: any[];
}

export function filterPublicProfile(p: FullProfile): FullProfile {
  return {
    ...p,
    gender: p.show_gender ? p.gender : null,
    interested_in: p.show_orientation ? p.interested_in : [],
    seeking: p.show_seeking ? p.seeking : [],
  };
}

export function annotateOwnerPerspective(p: FullProfile) {
  return {
    ...p,
    _locks: {
      genderHidden: !p.show_gender,
      orientationHidden: !p.show_orientation,
      seekingHidden: !p.show_seeking,
    }
  } as FullProfile & { _locks: { genderHidden: boolean; orientationHidden: boolean; seekingHidden: boolean }};
}
