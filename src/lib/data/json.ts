// Sumber data JSON: baca src/data/seed langsung. Untuk dev tanpa internet (DATA_SOURCE=json).
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
import { activeSorted, GALLERY_LIMIT, hasAnswer, TESTIMONIAL_LIMIT, type DataSource } from './common';

async function getBranches(): Promise<Branch[]> {
  return activeSorted(branchesJson as Branch[]);
}

async function getBarbers(): Promise<Barber[]> {
  return activeSorted(barbersJson as Barber[]);
}

export const jsonSource: DataSource = {
  getBranches,

  async getBranchBySlug(slug) {
    return (await getBranches()).find((branch) => branch.slug === slug) ?? null;
  },

  getBarbers,

  async getBarbersByBranch(branchSlug) {
    return (await getBarbers()).filter((barber) => barber.branch_slug === branchSlug);
  },

  async getServices() {
    return activeSorted(servicesJson as Service[]);
  },

  async getBranchServices(branchSlug) {
    const rows = branchServicesJson as BranchService[];
    return branchSlug ? rows.filter((row) => row.branch_slug === branchSlug) : rows;
  },

  async getSettings() {
    return settingsJson as SiteSettings;
  },

  async getFaqs() {
    return activeSorted(faqsJson as Faq[]).filter(hasAnswer);
  },

  async getGallery() {
    return activeSorted(galleryJson as GalleryItem[]).slice(0, GALLERY_LIMIT);
  },

  async getTestimonials() {
    return activeSorted(testimonialsJson as Testimonial[]).slice(0, TESTIMONIAL_LIMIT);
  },
};
