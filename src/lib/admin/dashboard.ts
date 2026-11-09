// Data Dashboard admin (PRD F-15). Fungsi murni `attentionItems` mudah diuji; `loadDashboard`
// membaca database dengan klien sesi admin (RLS berlaku).
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { listLeads } from './leads-db';
import type { LeadRow } from './leads';

type Client = SupabaseClient<Database>;

export interface BranchInfo {
  id: string;
  name: string;
  region: 'bandung_raya' | 'jabodetabek';
  is_active: boolean;
  address_incomplete: boolean;
}

export interface AttentionItem {
  tag: 'Data' | 'Alamat' | 'Konten';
  text: string;
}

/** "A", "A dan B", "A, B, dan C". */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  if (names.length === 2) return `${names[0]} dan ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, dan ${names[names.length - 1]}`;
}

export interface AttentionInput {
  branches: BranchInfo[];
  /** Jumlah barber aktif per branch_id. */
  activeBarbersByBranch: Record<string, number>;
  placeholderTestimonials: number;
  placeholderGallery: number;
  inactiveFaqs: number;
}

/** Hal yang perlu ditindaklanjuti admin, dihitung dari data (bukan teks tetap). */
export function attentionItems(input: AttentionInput): AttentionItem[] {
  const items: AttentionItem[] = [];
  const active = input.branches.filter((branch) => branch.is_active);

  const withoutPricelist = active
    .filter((branch) => (input.activeBarbersByBranch[branch.id] ?? 0) === 0)
    .map((branch) => branch.name);
  if (withoutPricelist.length > 0) {
    items.push({ tag: 'Data', text: `Pricelist ${joinNames(withoutPricelist)} belum diisi.` });
  }

  const incomplete = active.filter((branch) => branch.address_incomplete).map((b) => b.name);
  if (incomplete.length > 0) {
    items.push({ tag: 'Alamat', text: `Alamat ${joinNames(incomplete)} belum lengkap.` });
  }

  if (input.placeholderTestimonials > 0) {
    items.push({
      tag: 'Konten',
      text: `${input.placeholderTestimonials} testimoni masih contoh. Ganti dengan ulasan asli sebelum launch.`,
    });
  }
  if (input.placeholderGallery > 0) {
    items.push({
      tag: 'Konten',
      text: `${input.placeholderGallery} foto galeri masih ilustrasi. Ganti dengan foto asli.`,
    });
  }
  if (input.inactiveFaqs > 0) {
    items.push({
      tag: 'Konten',
      text: `${input.inactiveFaqs} FAQ belum tayang (menunggu jawaban pemilik).`,
    });
  }
  return items;
}

export interface DashboardData {
  activeBranches: number;
  regionCounts: { bandung_raya: number; jabodetabek: number };
  activeBarbers: number;
  branchesWithBarbers: number;
  newLeads: { total: number; academy: number; partnership: number };
  latestLeads: LeadRow[];
  lastPublish: { created_at: string; status: 'triggered' | 'failed' } | null;
  attention: AttentionItem[];
}

function must<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

export async function loadDashboard(supabase: Client): Promise<DashboardData> {
  const [
    branchesRes,
    barbersRes,
    leadsRes,
    latest,
    publishRes,
    testimonialsRes,
    galleryRes,
    faqsRes,
  ] = await Promise.all([
    supabase.from('branches').select('id, name, region, is_active, address_incomplete'),
    supabase.from('barbers').select('branch_id').eq('is_active', true).limit(10_000),
    supabase.from('leads').select('type').eq('status', 'new').limit(10_000),
    listLeads(supabase, {}, 1),
    supabase
      .from('publish_logs')
      .select('created_at, status')
      .order('created_at', { ascending: false })
      .limit(1),
    supabase
      .from('testimonials')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .eq('is_placeholder', true),
    supabase
      .from('gallery_items')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .eq('is_placeholder', true),
    supabase.from('faqs').select('id', { count: 'exact', head: true }).eq('is_active', false),
  ]);

  const branches = must(branchesRes) as BranchInfo[];
  const barbers = must(barbersRes);
  const newLeadRows = must(leadsRes);
  const publishLogs = must(publishRes);
  for (const res of [testimonialsRes, galleryRes, faqsRes]) {
    if (res.error) throw new Error(res.error.message);
  }

  const active = branches.filter((branch) => branch.is_active);
  const activeBarbersByBranch: Record<string, number> = {};
  for (const barber of barbers) {
    activeBarbersByBranch[barber.branch_id] = (activeBarbersByBranch[barber.branch_id] ?? 0) + 1;
  }
  const academy = newLeadRows.filter((row) => row.type === 'academy').length;

  return {
    activeBranches: active.length,
    regionCounts: {
      bandung_raya: active.filter((branch) => branch.region === 'bandung_raya').length,
      jabodetabek: active.filter((branch) => branch.region === 'jabodetabek').length,
    },
    activeBarbers: barbers.length,
    branchesWithBarbers: Object.keys(activeBarbersByBranch).length,
    newLeads: { total: newLeadRows.length, academy, partnership: newLeadRows.length - academy },
    latestLeads: latest.rows.slice(0, 5),
    lastPublish: publishLogs[0] ?? null,
    attention: attentionItems({
      branches,
      activeBarbersByBranch,
      placeholderTestimonials: testimonialsRes.count ?? 0,
      placeholderGallery: galleryRes.count ?? 0,
      inactiveFaqs: faqsRes.count ?? 0,
    }),
  };
}
