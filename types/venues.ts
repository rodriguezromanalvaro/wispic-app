export type VenueType = 'nightclub' | 'concert_hall' | 'festival';

export interface Venue {
    id: number;
    name: string;
    city_id: number;
    venue_type: VenueType;
    created_at: string;
}

export const venueTypeLabels: Record<VenueType, string> = {
    nightclub: 'Discoteca',
    concert_hall: 'Sala de conciertos',
    festival: 'Festival'
};

export const venueTypeIcons: Record<VenueType, string> = {
    nightclub: '🎵',
    concert_hall: '🎸',
    festival: '🎪'
};