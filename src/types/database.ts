export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.18';
  };
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      admin_profiles: {
        Row: {
          created_at: string;
          email: string;
          full_name: string;
          id: string;
          is_active: boolean;
          role: Database['public']['Enums']['admin_role'];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          full_name: string;
          id: string;
          is_active?: boolean;
          role?: Database['public']['Enums']['admin_role'];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          full_name?: string;
          id?: string;
          is_active?: boolean;
          role?: Database['public']['Enums']['admin_role'];
          updated_at?: string;
        };
        Relationships: [];
      };
      barbers: {
        Row: {
          branch_id: string;
          created_at: string;
          haircut_original_price: number | null;
          haircut_price: number;
          id: string;
          is_active: boolean;
          is_generic: boolean;
          label: string | null;
          long_trim_original_price: number | null;
          long_trim_price: number | null;
          name: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          branch_id: string;
          created_at?: string;
          haircut_original_price?: number | null;
          haircut_price: number;
          id?: string;
          is_active?: boolean;
          is_generic?: boolean;
          label?: string | null;
          long_trim_original_price?: number | null;
          long_trim_price?: number | null;
          name: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          branch_id?: string;
          created_at?: string;
          haircut_original_price?: number | null;
          haircut_price?: number;
          id?: string;
          is_active?: boolean;
          is_generic?: boolean;
          label?: string | null;
          long_trim_original_price?: number | null;
          long_trim_price?: number | null;
          name?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'barbers_branch_id_fkey';
            columns: ['branch_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['id'];
          },
        ];
      };
      branch_services: {
        Row: {
          branch_id: string;
          price_override_max: number | null;
          price_override_min: number | null;
          service_id: string;
          status: Database['public']['Enums']['availability_status'];
          updated_at: string;
        };
        Insert: {
          branch_id: string;
          price_override_max?: number | null;
          price_override_min?: number | null;
          service_id: string;
          status?: Database['public']['Enums']['availability_status'];
          updated_at?: string;
        };
        Update: {
          branch_id?: string;
          price_override_max?: number | null;
          price_override_min?: number | null;
          service_id?: string;
          status?: Database['public']['Enums']['availability_status'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'branch_services_branch_id_fkey';
            columns: ['branch_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'branch_services_service_id_fkey';
            columns: ['service_id'];
            isOneToOne: false;
            referencedRelation: 'services';
            referencedColumns: ['id'];
          },
        ];
      };
      branches: {
        Row: {
          address: string;
          address_incomplete: boolean;
          city: string;
          close_time: string;
          created_at: string;
          district: string | null;
          id: string;
          internal_note: string | null;
          is_active: boolean;
          is_flagship: boolean;
          is_new: boolean;
          latitude: number | null;
          longitude: number | null;
          maps_embed_url: string | null;
          maps_url: string | null;
          name: string;
          open_time: string;
          photo_is_placeholder: boolean;
          photo_path: string | null;
          postal_code: string | null;
          province: string;
          region: Database['public']['Enums']['region_type'];
          slug: string;
          sort_order: number;
          updated_at: string;
          whatsapp_number: string | null;
        };
        Insert: {
          address: string;
          address_incomplete?: boolean;
          city: string;
          close_time?: string;
          created_at?: string;
          district?: string | null;
          id?: string;
          internal_note?: string | null;
          is_active?: boolean;
          is_flagship?: boolean;
          is_new?: boolean;
          latitude?: number | null;
          longitude?: number | null;
          maps_embed_url?: string | null;
          maps_url?: string | null;
          name: string;
          open_time?: string;
          photo_is_placeholder?: boolean;
          photo_path?: string | null;
          postal_code?: string | null;
          province: string;
          region: Database['public']['Enums']['region_type'];
          slug: string;
          sort_order?: number;
          updated_at?: string;
          whatsapp_number?: string | null;
        };
        Update: {
          address?: string;
          address_incomplete?: boolean;
          city?: string;
          close_time?: string;
          created_at?: string;
          district?: string | null;
          id?: string;
          internal_note?: string | null;
          is_active?: boolean;
          is_flagship?: boolean;
          is_new?: boolean;
          latitude?: number | null;
          longitude?: number | null;
          maps_embed_url?: string | null;
          maps_url?: string | null;
          name?: string;
          open_time?: string;
          photo_is_placeholder?: boolean;
          photo_path?: string | null;
          postal_code?: string | null;
          province?: string;
          region?: Database['public']['Enums']['region_type'];
          slug?: string;
          sort_order?: number;
          updated_at?: string;
          whatsapp_number?: string | null;
        };
        Relationships: [];
      };
      faqs: {
        Row: {
          answer: string;
          created_at: string;
          id: string;
          is_active: boolean;
          question: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          answer: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          question: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          answer?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          question?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      gallery_items: {
        Row: {
          alt_text: string;
          created_at: string;
          description: string | null;
          id: string;
          image_path: string;
          is_active: boolean;
          is_placeholder: boolean;
          sort_order: number;
          title: string;
          updated_at: string;
        };
        Insert: {
          alt_text: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          image_path: string;
          is_active?: boolean;
          is_placeholder?: boolean;
          sort_order?: number;
          title: string;
          updated_at?: string;
        };
        Update: {
          alt_text?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          image_path?: string;
          is_active?: boolean;
          is_placeholder?: boolean;
          sort_order?: number;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      leads: {
        Row: {
          admin_note: string | null;
          city: string;
          consent: boolean;
          created_at: string;
          extra: Json;
          full_name: string;
          handled_by: string | null;
          id: string;
          ip_hash: string;
          message: string | null;
          source_path: string | null;
          status: Database['public']['Enums']['lead_status'];
          type: Database['public']['Enums']['lead_type'];
          updated_at: string;
          user_agent: string | null;
          whatsapp_number: string;
        };
        Insert: {
          admin_note?: string | null;
          city: string;
          consent: boolean;
          created_at?: string;
          extra?: Json;
          full_name: string;
          handled_by?: string | null;
          id?: string;
          ip_hash: string;
          message?: string | null;
          source_path?: string | null;
          status?: Database['public']['Enums']['lead_status'];
          type: Database['public']['Enums']['lead_type'];
          updated_at?: string;
          user_agent?: string | null;
          whatsapp_number: string;
        };
        Update: {
          admin_note?: string | null;
          city?: string;
          consent?: boolean;
          created_at?: string;
          extra?: Json;
          full_name?: string;
          handled_by?: string | null;
          id?: string;
          ip_hash?: string;
          message?: string | null;
          source_path?: string | null;
          status?: Database['public']['Enums']['lead_status'];
          type?: Database['public']['Enums']['lead_type'];
          updated_at?: string;
          user_agent?: string | null;
          whatsapp_number?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'leads_handled_by_fkey';
            columns: ['handled_by'];
            isOneToOne: false;
            referencedRelation: 'admin_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      publish_logs: {
        Row: {
          created_at: string;
          error_message: string | null;
          id: string;
          response_code: number | null;
          status: Database['public']['Enums']['publish_status'];
          triggered_by: string;
        };
        Insert: {
          created_at?: string;
          error_message?: string | null;
          id?: string;
          response_code?: number | null;
          status: Database['public']['Enums']['publish_status'];
          triggered_by: string;
        };
        Update: {
          created_at?: string;
          error_message?: string | null;
          id?: string;
          response_code?: number | null;
          status?: Database['public']['Enums']['publish_status'];
          triggered_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'publish_logs_triggered_by_fkey';
            columns: ['triggered_by'];
            isOneToOne: false;
            referencedRelation: 'admin_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      services: {
        Row: {
          category: Database['public']['Enums']['service_category'];
          created_at: string;
          description: string | null;
          id: string;
          is_active: boolean;
          name: string;
          note: string | null;
          price_max: number | null;
          price_min: number;
          price_type: Database['public']['Enums']['price_type'];
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          category: Database['public']['Enums']['service_category'];
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          note?: string | null;
          price_max?: number | null;
          price_min: number;
          price_type: Database['public']['Enums']['price_type'];
          slug: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          category?: Database['public']['Enums']['service_category'];
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          note?: string | null;
          price_max?: number | null;
          price_min?: number;
          price_type?: Database['public']['Enums']['price_type'];
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      site_settings: {
        Row: {
          key: string;
          updated_at: string;
          updated_by: string | null;
          value: Json;
        };
        Insert: {
          key: string;
          updated_at?: string;
          updated_by?: string | null;
          value: Json;
        };
        Update: {
          key?: string;
          updated_at?: string;
          updated_by?: string | null;
          value?: Json;
        };
        Relationships: [
          {
            foreignKeyName: 'site_settings_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'admin_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      testimonials: {
        Row: {
          branch_id: string | null;
          content: string;
          created_at: string;
          customer_name: string;
          id: string;
          is_active: boolean;
          is_placeholder: boolean;
          rating: number;
          sort_order: number;
          source: string;
          updated_at: string;
        };
        Insert: {
          branch_id?: string | null;
          content: string;
          created_at?: string;
          customer_name: string;
          id?: string;
          is_active?: boolean;
          is_placeholder?: boolean;
          rating: number;
          sort_order?: number;
          source: string;
          updated_at?: string;
        };
        Update: {
          branch_id?: string | null;
          content?: string;
          created_at?: string;
          customer_name?: string;
          id?: string;
          is_active?: boolean;
          is_placeholder?: boolean;
          rating?: number;
          sort_order?: number;
          source?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'testimonials_branch_id_fkey';
            columns: ['branch_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_admin: { Args: never; Returns: boolean };
      is_super_admin: { Args: never; Returns: boolean };
    };
    Enums: {
      admin_role: 'super_admin' | 'editor';
      availability_status: 'available' | 'soon' | 'unavailable';
      lead_status: 'new' | 'contacted' | 'closed' | 'spam';
      lead_type: 'academy' | 'partnership';
      price_type: 'fixed' | 'start_from' | 'range';
      publish_status: 'triggered' | 'failed';
      region_type: 'bandung_raya' | 'jabodetabek';
      service_category: 'add_on' | 'hair_colouring' | 'hair_treatment';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      admin_role: ['super_admin', 'editor'],
      availability_status: ['available', 'soon', 'unavailable'],
      lead_status: ['new', 'contacted', 'closed', 'spam'],
      lead_type: ['academy', 'partnership'],
      price_type: ['fixed', 'start_from', 'range'],
      publish_status: ['triggered', 'failed'],
      region_type: ['bandung_raya', 'jabodetabek'],
      service_category: ['add_on', 'hair_colouring', 'hair_treatment'],
    },
  },
} as const;
