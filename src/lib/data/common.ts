// Kontrak sumber data. Dua implementasi: json.ts (seed lokal) dan supabase.ts (database).
import type {
  Barber,
  Branch,
  BranchService,
  Faq,
  GalleryItem,
  Service,
  SiteSettings,
  Testimonial,
} from '@/types/content';

export interface DataSource {
  getBranches(): Promise<Branch[]>;
  getBranchBySlug(slug: string): Promise<Branch | null>;
  getBarbers(): Promise<Barber[]>;
  getBarbersByBranch(branchSlug: string): Promise<Barber[]>;
  getServices(): Promise<Service[]>;
  getBranchServices(branchSlug?: string): Promise<BranchService[]>;
  getSettings(): Promise<SiteSettings>;
  getFaqs(): Promise<Faq[]>;
  getGallery(): Promise<GalleryItem[]>;
  getTestimonials(): Promise<Testimonial[]>;
}

export const GALLERY_LIMIT = 12; // PRD F-10
export const TESTIMONIAL_LIMIT = 10; // PRD F-11

export const activeSorted = <T extends { is_active: boolean; sort_order: number }>(rows: T[]) =>
  rows.filter((row) => row.is_active).sort((a, b) => a.sort_order - b.sort_order);

/** FAQ tanpa jawaban final tidak tampil (Lampiran B). */
export const hasAnswer = (faq: Faq) => faq.answer.trim() !== '';
