// Loader data M1: baca JSON seed. M2 mengganti isi fungsi ke Supabase, antarmukanya tetap.
import barbersJson from '@/data/seed/barbers.json';
import branchServicesJson from '@/data/seed/branch-services.json';
import branchesJson from '@/data/seed/branches.json';
import faqsJson from '@/data/seed/faqs.json';
import galleryJson from '@/data/seed/gallery.json';
import servicesJson from '@/data/seed/services.json';
import settingsJson from '@/data/seed/site-settings.json';
import testimonialsJson from '@/data/seed/testimonials.json';
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

const activeSorted = <T extends { is_active: boolean; sort_order: number }>(rows: T[]) =>
  rows.filter((row) => row.is_active).sort((a, b) => a.sort_order - b.sort_order);

const GALLERY_LIMIT = 12; // PRD F-10
const TESTIMONIAL_LIMIT = 10; // PRD F-11

export async function getBranches(): Promise<Branch[]> {
  return activeSorted(branchesJson as Branch[]);
}

export async function getBranchBySlug(slug: string): Promise<Branch | null> {
  return (await getBranches()).find((branch) => branch.slug === slug) ?? null;
}

export async function getBarbers(): Promise<Barber[]> {
  return activeSorted(barbersJson as Barber[]);
}

export async function getBarbersByBranch(branchSlug: string): Promise<Barber[]> {
  return (await getBarbers()).filter((barber) => barber.branch_slug === branchSlug);
}

export async function getServices(): Promise<Service[]> {
  return activeSorted(servicesJson as Service[]);
}

export async function getBranchServices(branchSlug?: string): Promise<BranchService[]> {
  const rows = branchServicesJson as BranchService[];
  return branchSlug ? rows.filter((row) => row.branch_slug === branchSlug) : rows;
}

export async function getSettings(): Promise<SiteSettings> {
  return settingsJson as SiteSettings;
}

export async function getFaqs(): Promise<Faq[]> {
  return activeSorted(faqsJson as Faq[]).filter((faq) => faq.answer.trim() !== '');
}

export async function getGallery(): Promise<GalleryItem[]> {
  return activeSorted(galleryJson as GalleryItem[]).slice(0, GALLERY_LIMIT);
}

export async function getTestimonials(): Promise<Testimonial[]> {
  return activeSorted(testimonialsJson as Testimonial[]).slice(0, TESTIMONIAL_LIMIT);
}
