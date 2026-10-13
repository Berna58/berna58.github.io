export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          id: string
          slug: string
          sort_order: number
        }
        Insert: {
          id?: string
          slug: string
          sort_order?: number
        }
        Update: {
          id?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      category_translations: {
        Row: {
          category_id: string
          locale: Database["public"]["Enums"]["app_locale"]
          name: string
        }
        Insert: {
          category_id: string
          locale: Database["public"]["Enums"]["app_locale"]
          name: string
        }
        Update: {
          category_id?: string
          locale?: Database["public"]["Enums"]["app_locale"]
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_translations_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      cv_files: {
        Row: {
          locale: Database["public"]["Enums"]["app_locale"]
          media_id: string
          updated_at: string
        }
        Insert: {
          locale: Database["public"]["Enums"]["app_locale"]
          media_id: string
          updated_at?: string
        }
        Update: {
          locale?: Database["public"]["Enums"]["app_locale"]
          media_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cv_files_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
        ]
      }
      education: {
        Row: {
          end_date: string | null
          id: string
          institution: string
          sort_order: number
          start_date: string
          updated_at: string
        }
        Insert: {
          end_date?: string | null
          id?: string
          institution: string
          sort_order?: number
          start_date: string
          updated_at?: string
        }
        Update: {
          end_date?: string | null
          id?: string
          institution?: string
          sort_order?: number
          start_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      education_translations: {
        Row: {
          degree: string
          description: string | null
          education_id: string
          locale: Database["public"]["Enums"]["app_locale"]
        }
        Insert: {
          degree: string
          description?: string | null
          education_id: string
          locale: Database["public"]["Enums"]["app_locale"]
        }
        Update: {
          degree?: string
          description?: string | null
          education_id?: string
          locale?: Database["public"]["Enums"]["app_locale"]
        }
        Relationships: [
          {
            foreignKeyName: "education_translations_education_id_fkey"
            columns: ["education_id"]
            isOneToOne: false
            referencedRelation: "education"
            referencedColumns: ["id"]
          },
        ]
      }
      experience_technologies: {
        Row: {
          experience_id: string
          sort_order: number
          technology_id: string
        }
        Insert: {
          experience_id: string
          sort_order?: number
          technology_id: string
        }
        Update: {
          experience_id?: string
          sort_order?: number
          technology_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "experience_technologies_experience_id_fkey"
            columns: ["experience_id"]
            isOneToOne: false
            referencedRelation: "experiences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experience_technologies_technology_id_fkey"
            columns: ["technology_id"]
            isOneToOne: false
            referencedRelation: "technologies"
            referencedColumns: ["id"]
          },
        ]
      }
      experience_translations: {
        Row: {
          description: string | null
          experience_id: string
          highlights: Json
          locale: Database["public"]["Enums"]["app_locale"]
          role: string
        }
        Insert: {
          description?: string | null
          experience_id: string
          highlights?: Json
          locale: Database["public"]["Enums"]["app_locale"]
          role: string
        }
        Update: {
          description?: string | null
          experience_id?: string
          highlights?: Json
          locale?: Database["public"]["Enums"]["app_locale"]
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "experience_translations_experience_id_fkey"
            columns: ["experience_id"]
            isOneToOne: false
            referencedRelation: "experiences"
            referencedColumns: ["id"]
          },
        ]
      }
      experiences: {
        Row: {
          employment_type: Database["public"]["Enums"]["employment_type"]
          end_date: string | null
          id: string
          org_url: string | null
          organization: string
          sort_order: number
          start_date: string
          updated_at: string
        }
        Insert: {
          employment_type: Database["public"]["Enums"]["employment_type"]
          end_date?: string | null
          id?: string
          org_url?: string | null
          organization: string
          sort_order?: number
          start_date: string
          updated_at?: string
        }
        Update: {
          employment_type?: Database["public"]["Enums"]["employment_type"]
          end_date?: string | null
          id?: string
          org_url?: string | null
          organization?: string
          sort_order?: number
          start_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      links: {
        Row: {
          id: string
          kind: Database["public"]["Enums"]["link_kind"]
          label: string | null
          placements: Database["public"]["Enums"]["link_placement"][]
          sort_order: number
          url: string
        }
        Insert: {
          id?: string
          kind: Database["public"]["Enums"]["link_kind"]
          label?: string | null
          placements: Database["public"]["Enums"]["link_placement"][]
          sort_order?: number
          url: string
        }
        Update: {
          id?: string
          kind?: Database["public"]["Enums"]["link_kind"]
          label?: string | null
          placements?: Database["public"]["Enums"]["link_placement"][]
          sort_order?: number
          url?: string
        }
        Relationships: []
      }
      media: {
        Row: {
          byte_size: number | null
          created_at: string
          height: number | null
          id: string
          mime_type: string
          storage_path: string
          width: number | null
        }
        Insert: {
          byte_size?: number | null
          created_at?: string
          height?: number | null
          id?: string
          mime_type: string
          storage_path: string
          width?: number | null
        }
        Update: {
          byte_size?: number | null
          created_at?: string
          height?: number | null
          id?: string
          mime_type?: string
          storage_path?: string
          width?: number | null
        }
        Relationships: []
      }
      media_translations: {
        Row: {
          alt: string
          caption: string | null
          locale: Database["public"]["Enums"]["app_locale"]
          media_id: string
        }
        Insert: {
          alt: string
          caption?: string | null
          locale: Database["public"]["Enums"]["app_locale"]
          media_id: string
        }
        Update: {
          alt?: string
          caption?: string | null
          locale?: Database["public"]["Enums"]["app_locale"]
          media_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_translations_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
        ]
      }
      profile: {
        Row: {
          available: boolean
          email: string
          full_name: string
          id: number
          photo_media_id: string | null
          updated_at: string
          work_modes: Database["public"]["Enums"]["work_mode"][]
          work_zones: string[]
        }
        Insert: {
          available?: boolean
          email: string
          full_name: string
          id?: number
          photo_media_id?: string | null
          updated_at?: string
          work_modes?: Database["public"]["Enums"]["work_mode"][]
          work_zones?: string[]
        }
        Update: {
          available?: boolean
          email?: string
          full_name?: string
          id?: number
          photo_media_id?: string | null
          updated_at?: string
          work_modes?: Database["public"]["Enums"]["work_mode"][]
          work_zones?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "profile_photo_media_id_fkey"
            columns: ["photo_media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_translations: {
        Row: {
          ai_note: string | null
          bio_long: string
          bio_short: string
          headline: string
          locale: Database["public"]["Enums"]["app_locale"]
          location: string
          principles: Json
          role_line: string
        }
        Insert: {
          ai_note?: string | null
          bio_long: string
          bio_short: string
          headline: string
          locale: Database["public"]["Enums"]["app_locale"]
          location: string
          principles?: Json
          role_line: string
        }
        Update: {
          ai_note?: string | null
          bio_long?: string
          bio_short?: string
          headline?: string
          locale?: Database["public"]["Enums"]["app_locale"]
          location?: string
          principles?: Json
          role_line?: string
        }
        Relationships: []
      }
      project_media: {
        Row: {
          media_id: string
          project_id: string
          sort_order: number
        }
        Insert: {
          media_id: string
          project_id: string
          sort_order?: number
        }
        Update: {
          media_id?: string
          project_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_media_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_media_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_technologies: {
        Row: {
          project_id: string
          sort_order: number
          technology_id: string
        }
        Insert: {
          project_id: string
          sort_order?: number
          technology_id: string
        }
        Update: {
          project_id?: string
          sort_order?: number
          technology_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_technologies_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_technologies_technology_id_fkey"
            columns: ["technology_id"]
            isOneToOne: false
            referencedRelation: "technologies"
            referencedColumns: ["id"]
          },
        ]
      }
      project_translations: {
        Row: {
          ai_usage: string | null
          audience: string | null
          challenges: Json
          decisions: Json
          features: Json
          locale: Database["public"]["Enums"]["app_locale"]
          problem: string | null
          project_id: string
          results: string | null
          role: string | null
          seo_description: string | null
          seo_title: string | null
          solution: string | null
          summary: string
          title: string
        }
        Insert: {
          ai_usage?: string | null
          audience?: string | null
          challenges?: Json
          decisions?: Json
          features?: Json
          locale: Database["public"]["Enums"]["app_locale"]
          problem?: string | null
          project_id: string
          results?: string | null
          role?: string | null
          seo_description?: string | null
          seo_title?: string | null
          solution?: string | null
          summary?: string
          title?: string
        }
        Update: {
          ai_usage?: string | null
          audience?: string | null
          challenges?: Json
          decisions?: Json
          features?: Json
          locale?: Database["public"]["Enums"]["app_locale"]
          problem?: string | null
          project_id?: string
          results?: string | null
          role?: string | null
          seo_description?: string | null
          seo_title?: string | null
          solution?: string | null
          summary?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_translations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          category_id: string | null
          code_visibility: Database["public"]["Enums"]["code_visibility"]
          cover_media_id: string | null
          created_at: string
          demo_url: string | null
          featured: boolean
          id: string
          kind: Database["public"]["Enums"]["project_kind"]
          project_state: Database["public"]["Enums"]["project_state"] | null
          published_at: string | null
          repo_url: string | null
          slug: string
          sort_order: number
          status: Database["public"]["Enums"]["publish_status"]
          updated_at: string
          video_url: string | null
          year: number | null
        }
        Insert: {
          category_id?: string | null
          code_visibility?: Database["public"]["Enums"]["code_visibility"]
          cover_media_id?: string | null
          created_at?: string
          demo_url?: string | null
          featured?: boolean
          id?: string
          kind?: Database["public"]["Enums"]["project_kind"]
          project_state?: Database["public"]["Enums"]["project_state"] | null
          published_at?: string | null
          repo_url?: string | null
          slug: string
          sort_order?: number
          status?: Database["public"]["Enums"]["publish_status"]
          updated_at?: string
          video_url?: string | null
          year?: number | null
        }
        Update: {
          category_id?: string | null
          code_visibility?: Database["public"]["Enums"]["code_visibility"]
          cover_media_id?: string | null
          created_at?: string
          demo_url?: string | null
          featured?: boolean
          id?: string
          kind?: Database["public"]["Enums"]["project_kind"]
          project_state?: Database["public"]["Enums"]["project_state"] | null
          published_at?: string | null
          repo_url?: string | null
          slug?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["publish_status"]
          updated_at?: string
          video_url?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_cover_media_id_fkey"
            columns: ["cover_media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          id: number
          og_media_id: string | null
        }
        Insert: {
          id?: number
          og_media_id?: string | null
        }
        Update: {
          id?: number
          og_media_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "site_settings_og_media_id_fkey"
            columns: ["og_media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings_translations: {
        Row: {
          description: string
          locale: Database["public"]["Enums"]["app_locale"]
          title: string
        }
        Insert: {
          description: string
          locale: Database["public"]["Enums"]["app_locale"]
          title: string
        }
        Update: {
          description?: string
          locale?: Database["public"]["Enums"]["app_locale"]
          title?: string
        }
        Relationships: []
      }
      technologies: {
        Row: {
          id: string
          name: string
          sort_order: number
          tech_group: Database["public"]["Enums"]["tech_group"]
        }
        Insert: {
          id?: string
          name: string
          sort_order?: number
          tech_group: Database["public"]["Enums"]["tech_group"]
        }
        Update: {
          id?: string
          name?: string
          sort_order?: number
          tech_group?: Database["public"]["Enums"]["tech_group"]
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      export_published_content: { Args: never; Returns: Json }
      is_admin: { Args: never; Returns: boolean }
      media_json: { Args: { media_id: string }; Returns: Json }
      move_item: {
        Args: { direction: number; item_id: string; item_table: string }
        Returns: undefined
      }
      move_project: {
        Args: { direction: number; project_id: string }
        Returns: undefined
      }
      project_publish_issues: {
        Args: { p: Database["public"]["Tables"]["projects"]["Row"] }
        Returns: string[]
      }
      project_publish_issues_by_id: {
        Args: { project_id: string }
        Returns: string[]
      }
      save_category: { Args: { payload: Json }; Returns: string }
      save_education: { Args: { payload: Json }; Returns: string }
      save_experience: { Args: { payload: Json }; Returns: string }
      save_profile: { Args: { payload: Json }; Returns: undefined }
      save_project: { Args: { payload: Json }; Returns: string }
      save_site_settings: { Args: { payload: Json }; Returns: undefined }
      set_project_status: {
        Args: {
          new_status: Database["public"]["Enums"]["publish_status"]
          project_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_locale: "pt" | "en"
      code_visibility: "public" | "private" | "confidential"
      employment_type: "full_time" | "part_time" | "internship" | "freelance"
      link_kind:
        | "linkedin"
        | "github"
        | "behance"
        | "instagram"
        | "facebook"
        | "email"
        | "other"
      link_placement: "hero" | "contact" | "footer" | "design"
      project_kind: "case_study" | "showcase"
      project_state:
        | "production"
        | "in_development"
        | "experimental"
        | "completed"
      publish_status: "draft" | "published" | "unpublished"
      tech_group: "backend" | "frontend" | "data" | "design" | "tools"
      work_mode: "remote" | "hybrid" | "onsite"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_locale: ["pt", "en"],
      code_visibility: ["public", "private", "confidential"],
      employment_type: ["full_time", "part_time", "internship", "freelance"],
      link_kind: [
        "linkedin",
        "github",
        "behance",
        "instagram",
        "facebook",
        "email",
        "other",
      ],
      link_placement: ["hero", "contact", "footer", "design"],
      project_kind: ["case_study", "showcase"],
      project_state: [
        "production",
        "in_development",
        "experimental",
        "completed",
      ],
      publish_status: ["draft", "published", "unpublished"],
      tech_group: ["backend", "frontend", "data", "design", "tools"],
      work_mode: ["remote", "hybrid", "onsite"],
    },
  },
} as const

