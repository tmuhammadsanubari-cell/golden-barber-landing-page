// Bentuk data konten. Selaras dengan skema DB PRD 4.2; M2 mengganti sumbernya ke Supabase.

export type Region = 'bandung_raya' | 'jabodetabek';

export interface Branch {
  slug: string;
  name: string;
  region: Region;
  address: string;
  district: string | null;
  city: string;
  province: string;
  postal_code: string | null;
  address_incomplete: boolean;
  maps_url: string | null;
  maps_embed_url: string | null;
  latitude: number | null;
  longitude: number | null;
  open_time: string;
  close_time: string;
  whatsapp_number: string | null;
  is_flagship: boolean;
  is_new: boolean;
  is_active: boolean;
  sort_order: number;
  photo_path: string | null;
  photo_is_placeholder: boolean;
}

export interface Barber {
  branch_slug: string;
  name: string;
  label: string | null;
  is_generic: boolean;
  haircut_price: number;
  haircut_original_price: number | null;
  long_trim_price: number;
  long_trim_original_price: number | null;
  is_active: boolean;
  sort_order: number;
}

export type ServiceCategory = 'add_on' | 'hair_colouring' | 'hair_treatment';
export type PriceType = 'fixed' | 'start_from' | 'range';

export interface Service {
  slug: string;
  name: string;
  category: ServiceCategory;
  price_type: PriceType;
  price_min: number;
  price_max: number | null;
  note: string | null;
  description: string | null;
  is_active: boolean;
  sort_order: number;
}

export type ServiceStatus = 'available' | 'soon' | 'unavailable';

export interface BranchService {
  branch_slug: string;
  service_slug: string;
  status: ServiceStatus;
  price_override_min: number | null;
  price_override_max: number | null;
}

export interface Faq {
  question: string;
  answer: string;
  is_active: boolean;
  sort_order: number;
}

export interface GalleryItem {
  title: string;
  description: string | null;
  image_path: string;
  alt_text: string;
  is_placeholder: boolean;
  is_active: boolean;
  sort_order: number;
}

export interface Testimonial {
  branch_slug: string | null;
  customer_name: string;
  rating: number;
  source: string;
  content: string;
  is_placeholder: boolean;
  is_active: boolean;
  sort_order: number;
}

export type WhatsAppTemplateKey =
  | 'general'
  | 'branch'
  | 'barber'
  | 'service'
  | 'branch_no_pricelist'
  | 'academy'
  | 'partnership';

export interface WhatsAppSettings {
  whatsapp_number: string;
  whatsapp_templates: Record<WhatsAppTemplateKey, string>;
}

export interface SiteSettings extends WhatsAppSettings {
  hero: {
    title: string;
    subtitle: string;
    primary_cta: string;
    secondary_cta: string;
    image_path: string;
    image_is_placeholder: boolean;
  };
  social_links: {
    instagram: string;
    threads: string;
    linktree: string;
    academy_instagram: string;
  };
  google_rating: { rating: number; review_count: number; scope: string; updated_at: string };
  about_highlights: { icon: string; title: string; description: string }[];
  haircut_includes: string[];
  academy_section: { title: string; description: string; is_details_available: boolean };
  partnership_section: { title: string; description: string };
  media_mentions: { title: string; outlet: string; year: number; url: string }[];
  seo_defaults: { title: string; description: string; og_image: string };
}
