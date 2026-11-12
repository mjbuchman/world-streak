
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "attempts": {
                  Row: {
                    "counted_weight": number,"game_date": string,"id": string,"inputs": Json | null,"passed": boolean | null,"score": number | null,"seed": number,"started_at": string,"submitted_at": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "counted_weight": number,"game_date": string,"id"?: string,"inputs"?: Json | null,"passed"?: boolean | null,"score"?: number | null,"seed": number,"started_at"?: string,"submitted_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "counted_weight"?: number,"game_date"?: string,"id"?: string,"inputs"?: Json | null,"passed"?: boolean | null,"score"?: number | null,"seed"?: number,"started_at"?: string,"submitted_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "attempts_game_date_fkey"
      columns: ["game_date"]
isOneToOne: false
      referencedRelation: "game_days"
      referencedColumns: ["game_date"]
    },{
      foreignKeyName: "attempts_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"challenge_types": {
                  Row: {
                    "direction": string,"type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "direction": string,"type": string
                  }
                  Update: {
                    "direction"?: string,"type"?: string
                  }
                  Relationships: [
                    
                  ]
                },"cheat_flags": {
                  Row: {
                    "attempt_id": string,"created_at": string,"id": number,"reason": string,"status": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempt_id": string,"created_at"?: string,"id"?: never,"reason": string,"status"?: string,"user_id": string
                  }
                  Update: {
                    "attempt_id"?: string,"created_at"?: string,"id"?: never,"reason"?: string,"status"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cheat_flags_attempt_id_fkey"
      columns: ["attempt_id"]
isOneToOne: false
      referencedRelation: "attempts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cheat_flags_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"cycles": {
                  Row: {
                    "base_prize_cents": number,"drawn_at": string | null,"end_date": string,"goal_reached_on": string | null,"number": number,"paid_on": string | null,"rollover_in_cents": number,"start_date": string,"winner_user_id": string | null,"cycle_drawable": boolean | null
                  }
                  ComputedFields: "cycle_drawable"
                  Insert: {
                    "base_prize_cents"?: number,"drawn_at"?: string | null,"end_date": string,"goal_reached_on"?: string | null,"number": number,"paid_on"?: string | null,"rollover_in_cents"?: number,"start_date": string,"winner_user_id"?: string | null
                  }
                  Update: {
                    "base_prize_cents"?: number,"drawn_at"?: string | null,"end_date"?: string,"goal_reached_on"?: string | null,"number"?: number,"paid_on"?: string | null,"rollover_in_cents"?: number,"start_date"?: string,"winner_user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "cycles_winner_user_id_fkey"
      columns: ["winner_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"entries": {
                  Row: {
                    "attempt_id": string,"created_at": string,"cycle_number": number,"game_date": string,"id": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempt_id": string,"created_at"?: string,"cycle_number": number,"game_date": string,"id"?: never,"user_id": string
                  }
                  Update: {
                    "attempt_id"?: string,"created_at"?: string,"cycle_number"?: number,"game_date"?: string,"id"?: never,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "entries_attempt_id_fkey"
      columns: ["attempt_id"]
isOneToOne: true
      referencedRelation: "attempts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "entries_cycle_number_fkey"
      columns: ["cycle_number"]
isOneToOne: false
      referencedRelation: "cycles"
      referencedColumns: ["number"]
    },{
      foreignKeyName: "entries_cycle_number_fkey"
      columns: ["cycle_number"]
isOneToOne: false
      referencedRelation: "cycles_public"
      referencedColumns: ["number"]
    },{
      foreignKeyName: "entries_game_date_fkey"
      columns: ["game_date"]
isOneToOne: false
      referencedRelation: "game_days"
      referencedColumns: ["game_date"]
    },{
      foreignKeyName: "entries_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"game_day_counters": {
                  Row: {
                    "attempts": number,"game_date": string,"passes": number,"updated_at": string,"weighted_attempts": number,"weighted_passes": number
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"game_date": string,"passes"?: number,"updated_at"?: string,"weighted_attempts"?: number,"weighted_passes"?: number
                  }
                  Update: {
                    "attempts"?: number,"game_date"?: string,"passes"?: number,"updated_at"?: string,"weighted_attempts"?: number,"weighted_passes"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "game_day_counters_game_date_fkey"
      columns: ["game_date"]
isOneToOne: true
      referencedRelation: "game_days"
      referencedColumns: ["game_date"]
    }
                  ]
                },"game_days": {
                  Row: {
                    "challenge_type": string,"closed_at": string | null,"edited": boolean,"final_pass_rate": number | null,"game_date": string,"outcome": string | null,"pass_target": number,"survival_threshold": number
                  }
                  ComputedFields: never
                  Insert: {
                    "challenge_type": string,"closed_at"?: string | null,"edited"?: boolean,"final_pass_rate"?: number | null,"game_date": string,"outcome"?: string | null,"pass_target": number,"survival_threshold": number
                  }
                  Update: {
                    "challenge_type"?: string,"closed_at"?: string | null,"edited"?: boolean,"final_pass_rate"?: number | null,"game_date"?: string,"outcome"?: string | null,"pass_target"?: number,"survival_threshold"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "game_days_challenge_type_fkey"
      columns: ["challenge_type"]
isOneToOne: false
      referencedRelation: "challenge_types"
      referencedColumns: ["type"]
    }
                  ]
                },"game_settings": {
                  Row: {
                    "default_pass_targets": NonNullable<Json>,"default_survival_threshold": number,"full_weight_after_days": number,"id": boolean,"new_account_weight": number,"pass_target_percentile": number,"pass_target_streak_step": number,"percentile_lookback_days": number,"percentile_min_sample": number,"rotation": (string)[],"threshold_streak_step": number
                  }
                  ComputedFields: never
                  Insert: {
                    "default_pass_targets"?: NonNullable<Json>,"default_survival_threshold"?: number,"full_weight_after_days"?: number,"id"?: boolean,"new_account_weight"?: number,"pass_target_percentile"?: number,"pass_target_streak_step"?: number,"percentile_lookback_days"?: number,"percentile_min_sample"?: number,"rotation"?: (string)[],"threshold_streak_step"?: number
                  }
                  Update: {
                    "default_pass_targets"?: NonNullable<Json>,"default_survival_threshold"?: number,"full_weight_after_days"?: number,"id"?: boolean,"new_account_weight"?: number,"pass_target_percentile"?: number,"pass_target_streak_step"?: number,"percentile_lookback_days"?: number,"percentile_min_sample"?: number,"rotation"?: (string)[],"threshold_streak_step"?: number
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "birth_date": string,"country": string,"created_at": string,"flagged": boolean,"id": string,"is_admin": boolean,"weight": number
                  }
                  ComputedFields: never
                  Insert: {
                    "birth_date": string,"country": string,"created_at"?: string,"flagged"?: boolean,"id": string,"is_admin"?: boolean,"weight"?: number
                  }
                  Update: {
                    "birth_date"?: string,"country"?: string,"created_at"?: string,"flagged"?: boolean,"id"?: string,"is_admin"?: boolean,"weight"?: number
                  }
                  Relationships: [
                    
                  ]
                },"streak_runs": {
                  Row: {
                    "end_date": string | null,"id": number,"length": number,"start_date": string
                  }
                  ComputedFields: never
                  Insert: {
                    "end_date"?: string | null,"id"?: never,"length": number,"start_date": string
                  }
                  Update: {
                    "end_date"?: string | null,"id"?: never,"length"?: number,"start_date"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "cycles_public": {
                  Row: {
                    "base_prize_cents": number,"drawn_at": string | null,"end_date": string,"goal_reached_on": string | null,"number": number,"paid_on": string | null,"rollover_in_cents": number,"start_date": string
                  }
                  ComputedFields: never
                  Insert: {
                           "base_prize_cents"?: number | null,"drawn_at"?: string | null,"end_date"?: string | null,"goal_reached_on"?: string | null,"number"?: number | null,"paid_on"?: string | null,"rollover_in_cents"?: number | null,"start_date"?: string | null
                         }
                        Update: {
                           "base_prize_cents"?: number | null,"drawn_at"?: string | null,"end_date"?: string | null,"goal_reached_on"?: string | null,"number"?: number | null,"paid_on"?: string | null,"rollover_in_cents"?: number | null,"start_date"?: string | null
                         }
                        Relationships: [
                    
                  ]
                },"drawable_entries": {
                  Row: {
                    "cycle_number": number,"game_date": string,"id": number,"user_id": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "entries_cycle_number_fkey"
      columns: ["cycle_number"]
isOneToOne: false
      referencedRelation: "cycles"
      referencedColumns: ["number"]
    },{
      foreignKeyName: "entries_cycle_number_fkey"
      columns: ["cycle_number"]
isOneToOne: false
      referencedRelation: "cycles_public"
      referencedColumns: ["number"]
    },{
      foreignKeyName: "entries_game_date_fkey"
      columns: ["game_date"]
isOneToOne: false
      referencedRelation: "game_days"
      referencedColumns: ["game_date"]
    },{
      foreignKeyName: "entries_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "admin_cycle_winners":
{ Args: Record<PropertyKey, never>; Returns: {
              "cycle_number": number,"email": string,"email_verified": boolean
            }[]
                           },
"admin_draw_tickets":
{ Args: { "p_cycle": number }; Returns: {
              "tickets": number,"user_id": string
            }[]
                           },
"admin_mark_paid":
{ Args: { "p_cycle": number }; Returns: string
                           },
"admin_open_flags":
{ Args: Record<PropertyKey, never>; Returns: {
              "created_at": string,"email": string,"flag_id": number,"game_date": string,"reason": string,"score": number
            }[]
                           },
"admin_record_winner":
{ Args: { "p_cycle": number,"p_user": string }; Returns: string
                           },
"challenge_for":
{ Args: { "d": string }; Returns: string
                           },
"close_due_game_days":
{ Args: { "at"?: string }; Returns: number
                           },
"close_game_day":
{ Args: { "d": string }; Returns: string
                           },
"close_game_day_unchecked":
{ Args: { "d": string }; Returns: string
                           },
"cycle_drawable":
{ Args: { "c": Omit<Database["public"]['Tables']["cycles"]['Row'], Database["public"]['Tables']["cycles"]['ComputedFields']> }; Returns: boolean
                           },
"cycle_for":
{ Args: { "d": string }; Returns: number
                           },
"deadline_utc_hour":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"ensure_game_day":
{ Args: { "d": string }; Returns: undefined
                           },
"game_date_at":
{ Args: { "ts": string }; Returns: string
                           },
"health_check":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"my_entry_count":
{ Args: { "cycle": number }; Returns: number
                           },
"pass_target_for":
{ Args: { "challenge": string,"d": string,"streak": number }; Returns: number
                           },
"pass_targets_are_valid":
{ Args: { "targets": Json }; Returns: boolean
                           },
"prepare_next_cycle":
{ Args: { "d": string }; Returns: undefined
                           },
"record_attempt_result":
{ Args: { "p_attempt_id": string,"p_inputs": Json,"p_passed": boolean,"p_score": number }; Returns: string
                           },
"record_attempt_result_unchecked":
{ Args: { "p_attempt_id": string,"p_inputs": Json,"p_passed": boolean,"p_score": number }; Returns: string
                           },
"record_cheat_flags":
{ Args: { "p_attempt_id": string,"p_reasons": (string)[] }; Returns: undefined
                           },
"recount_game_day":
{ Args: { "d": string }; Returns: undefined
                           },
"review_cheat_flag":
{ Args: { "p_decision": string,"p_flag_id": number }; Returns: string
                           },
"world_streak":
{ Args: Record<PropertyKey, never>; Returns: {
              "best": number,"current": number,"current_start_date": string
            }[]
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
