export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      "Grocery list": {
        Row: {
          created_at: string
          id: number
          Item: string
          Quantity: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          Item: string
          Quantity?: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          Item?: string
          Quantity?: number
          user_id?: string | null
        }
        Relationships: []
      }
      "Purchase history": {
        Row: {
          created_at: string
          id: number
          Item: string
          last_bought: string
          Quantity: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          Item: string
          last_bought?: string
          Quantity?: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          Item?: string
          last_bought?: string
          Quantity?: number
          user_id?: string | null
        }
        Relationships: []
      }
      SavedlistItems: {
        Row: {
          created_at: string
          id: number
          Item: string
          Quantity: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          Item: string
          Quantity?: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          Item?: string
          Quantity?: number
          user_id?: string | null
        }
        Relationships: []
      }
      specials: {
        Row: {
          created_at: string
          id: number
          item: string
          quantity: number
          category: string | null
          price: string | null
          discount: string | null
          catalogue_date: string | null
          on_special: boolean
          discount_percentage: number | null
        }
        Insert: {
          created_at?: string
          id?: number
          item: string
          quantity?: number
          category?: string | null
          price?: string | null
          discount?: string | null
          catalogue_date?: string | null
          on_special?: boolean
          discount_percentage?: number | null
        }
        Update: {
          created_at?: string
          id?: number
          item?: string
          quantity?: number
          category?: string | null
          price?: string | null
          discount?: string | null
          catalogue_date?: string | null
          on_special?: boolean
          discount_percentage?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (DatabaseWithoutInternals["public"]["Tables"])
    | { schema: keyof DatabaseWithoutInternals["public"]["Tables"] },
  TableName extends PublicTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals["public"]["Tables"] }
    ? keyof (DatabaseWithoutInternals["public"]["Tables"][PublicTableNameOrOptions["schema"]])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals["public"]["Tables"] }
  ? (DatabaseWithoutInternals["public"]["Tables"][PublicTableNameOrOptions["schema"]])[TableName] extends {
      Row: infer R
    }
    ? {
        Row: R
      }
    : never
  : PublicTableNameOrOptions extends keyof (DatabaseWithoutInternals["public"]["Tables"])
  ? (DatabaseWithoutInternals["public"]["Tables"][PublicTableNameOrOptions]) extends {
      Row: infer R
    }
    ? {
        Row: R
      }
    : never
  : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof (DatabaseWithoutInternals["public"]["Tables"])
    | { schema: keyof DatabaseWithoutInternals["public"]["Tables"] },
  TableName extends PublicTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals["public"]["Tables"] }
    ? keyof (DatabaseWithoutInternals["public"]["Tables"][PublicTableNameOrOptions["schema"]])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals["public"]["Tables"] }
  ? (DatabaseWithoutInternals["public"]["Tables"][PublicTableNameOrOptions["schema"]])[TableName] extends {
      Insert: infer I
    }
    ? {
        Insert: I
      }
    : never
  : PublicTableNameOrOptions extends keyof (DatabaseWithoutInternals["public"]["Tables"])
  ? (DatabaseWithoutInternals["public"]["Tables"][PublicTableNameOrOptions]) extends {
      Insert: infer I
    }
    ? {
        Insert: I
      }
    : never
  : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof (DatabaseWithoutInternals["public"]["Tables"])
    | { schema: keyof DatabaseWithoutInternals["public"]["Tables"] },
  TableName extends PublicTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals["public"]["Tables"] }
    ? keyof (DatabaseWithoutInternals["public"]["Tables"][PublicTableNameOrOptions["schema"]])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals["public"]["Tables"] }
  ? (DatabaseWithoutInternals["public"]["Tables"][PublicTableNameOrOptions["schema"]])[TableName] extends {
      Update: infer U
    }
    ? {
        Update: U
      }
    : never
  : PublicTableNameOrOptions extends keyof (DatabaseWithoutInternals["public"]["Tables"])
  ? (DatabaseWithoutInternals["public"]["Tables"][PublicTableNameOrOptions]) extends {
      Update: infer U
    }
    ? {
        Update: U
      }
    : never
  : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof (DatabaseWithoutInternals["public"]["Enums"])
    | { schema: keyof DatabaseWithoutInternals["public"]["Enums"] },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals["public"]["Enums"] }
    ? keyof (DatabaseWithoutInternals["public"]["Enums"][PublicEnumNameOrOptions["schema"]])
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals["public"]["Enums"] }
  ? (DatabaseWithoutInternals["public"]["Enums"][PublicEnumNameOrOptions["schema"]])[EnumName]
  : PublicEnumNameOrOptions extends keyof (DatabaseWithoutInternals["public"]["Enums"])
  ? (DatabaseWithoutInternals["public"]["Enums"][PublicEnumNameOrOptions])
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
    Enums: {},
  },
} as const

