// Pintu masuk data situs. Antarmuka tetap sama dengan M1; sumbernya dipilih lewat env
// DATA_SOURCE: `supabase` (default) atau `json` (src/data/seed, untuk dev tanpa internet).
import { env } from '@/lib/env';
import type { DataSource } from './common';
import { jsonSource } from './json';
import { supabaseSource } from './supabase';

const name = env('DATA_SOURCE') ?? 'supabase';
if (name !== 'json' && name !== 'supabase') {
  throw new Error(`DATA_SOURCE tidak dikenal: "${name}". Pakai "json" atau "supabase".`);
}

const source: DataSource = name === 'json' ? jsonSource : supabaseSource;

export const getBranches = () => source.getBranches();
export const getBranchBySlug = (slug: string) => source.getBranchBySlug(slug);
export const getBarbers = () => source.getBarbers();
export const getBarbersByBranch = (branchSlug: string) => source.getBarbersByBranch(branchSlug);
export const getServices = () => source.getServices();
export const getBranchServices = (branchSlug?: string) => source.getBranchServices(branchSlug);
export const getSettings = () => source.getSettings();
export const getFaqs = () => source.getFaqs();
export const getGallery = () => source.getGallery();
export const getTestimonials = () => source.getTestimonials();
