export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          full_name: string
          role: 'organizer' | 'manager' | 'coordinator' | 'volunteer'
        }
        Insert: {
          id?: string
          full_name: string
          role?: 'organizer' | 'manager' | 'coordinator' | 'volunteer'
        }
        Update: {
          id?: string
          full_name?: string
          role?: 'organizer' | 'manager' | 'coordinator' | 'volunteer'
        }
      }
      equipment: {
        Row: {
          id: string
          name: string
          category: string
          serial_number: string
          status: 'available' | 'checked_out' | 'maintenance'
        }
        Insert: {
          id?: string
          name: string
          category: string
          serial_number: string
          status?: 'available' | 'checked_out' | 'maintenance'
        }
        Update: {
          id?: string
          name?: string
          category?: string
          serial_number?: string
          status?: 'available' | 'checked_out' | 'maintenance'
        }
      }
      checkout_logs: {
        Row: {
          id: string
          equipment_id: string
          user_id: string
          checkout_time: string
          expected_return_time: string | null
          actual_return_time: string | null
        }
        Insert: {
          id?: string
          equipment_id: string
          user_id: string
          checkout_time?: string
          expected_return_time?: string | null
          actual_return_time?: string | null
        }
        Update: {
          id?: string
          equipment_id?: string
          user_id?: string
          checkout_time?: string
          expected_return_time?: string | null
          actual_return_time?: string | null
        }
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
  }
}
