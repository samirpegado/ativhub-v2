// Generated from Supabase project ativhub. Do not edit by hand.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      asset: {
        Row: {
          acquisition_cost: number | null
          additional_infos: string | null
          archived: boolean
          area: string | null
          bar_code: string | null
          category_id: string | null
          created_at: string
          custom_id: string | null
          description: string | null
          id: string
          image_url: string | null
          in_service_date: string | null
          location_id: string | null
          manufacturer: string | null
          model: string | null
          name: string
          parent_id: string | null
          power: string | null
          primary_user_id: string | null
          serial_number: string | null
          status: string
          tenant_id: string
          updated_at: string
          warranty_expiration_date: string | null
        }
        Insert: {
          acquisition_cost?: number | null
          additional_infos?: string | null
          archived?: boolean
          area?: string | null
          bar_code?: string | null
          category_id?: string | null
          created_at?: string
          custom_id?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          in_service_date?: string | null
          location_id?: string | null
          manufacturer?: string | null
          model?: string | null
          name: string
          parent_id?: string | null
          power?: string | null
          primary_user_id?: string | null
          serial_number?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
          warranty_expiration_date?: string | null
        }
        Update: {
          acquisition_cost?: number | null
          additional_infos?: string | null
          archived?: boolean
          area?: string | null
          bar_code?: string | null
          category_id?: string | null
          created_at?: string
          custom_id?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          in_service_date?: string | null
          location_id?: string | null
          manufacturer?: string | null
          model?: string | null
          name?: string
          parent_id?: string | null
          power?: string | null
          primary_user_id?: string | null
          serial_number?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          warranty_expiration_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "asset"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_primary_user_id_fkey"
            columns: ["primary_user_id"]
            isOneToOne: false
            referencedRelation: "membership"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_assignee: {
        Row: {
          asset_id: string
          membership_id: string
        }
        Insert: {
          asset_id: string
          membership_id: string
        }
        Update: {
          asset_id?: string
          membership_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_assignee_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "asset"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_assignee_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "membership"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_downtime: {
        Row: {
          asset_id: string
          duration_seconds: number
          id: string
          started_at: string
          tenant_id: string
        }
        Insert: {
          asset_id: string
          duration_seconds?: number
          id?: string
          started_at?: string
          tenant_id: string
        }
        Update: {
          asset_id?: string
          duration_seconds?: number
          id?: string
          started_at?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_downtime_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "asset"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_downtime_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_team: {
        Row: {
          asset_id: string
          team_id: string
        }
        Insert: {
          asset_id: string
          team_id: string
        }
        Update: {
          asset_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_team_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "asset"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_team_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team"
            referencedColumns: ["id"]
          },
        ]
      }
      category: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          tenant_id: string
          type: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          tenant_id: string
          type: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          tenant_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist: {
        Row: {
          created_at: string
          id: string
          name: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_task: {
        Row: {
          checklist_id: string
          id: string
          label: string
          options: Json
          order_index: number
          task_type: string
          tenant_id: string
        }
        Insert: {
          checklist_id: string
          id?: string
          label: string
          options?: Json
          order_index?: number
          task_type?: string
          tenant_id: string
        }
        Update: {
          checklist_id?: string
          id?: string
          label?: string
          options?: Json
          order_index?: number
          task_type?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_task_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "checklist"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_task_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      counter: {
        Row: {
          entity: string
          tenant_id: string
          value: number
        }
        Insert: {
          entity: string
          tenant_id: string
          value?: number
        }
        Update: {
          entity?: string
          tenant_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "counter_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      customer: {
        Row: {
          created_at: string
          customer_type: string | null
          description: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          tenant_id: string
          website: string | null
        }
        Insert: {
          created_at?: string
          customer_type?: string | null
          description?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          tenant_id: string
          website?: string | null
        }
        Update: {
          created_at?: string
          customer_type?: string | null
          description?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          tenant_id?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      file: {
        Row: {
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          name: string
          tenant_id: string
          url: string
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          name: string
          tenant_id: string
          url: string
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          name?: string
          tenant_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "file_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      labor: {
        Row: {
          duration_seconds: number
          hourly_rate: number | null
          id: string
          logged: boolean
          membership_id: string | null
          started_at: string | null
          tenant_id: string
          work_order_id: string
        }
        Insert: {
          duration_seconds?: number
          hourly_rate?: number | null
          id?: string
          logged?: boolean
          membership_id?: string | null
          started_at?: string | null
          tenant_id: string
          work_order_id: string
        }
        Update: {
          duration_seconds?: number
          hourly_rate?: number | null
          id?: string
          logged?: boolean
          membership_id?: string | null
          started_at?: string | null
          tenant_id?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "labor_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "membership"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "labor_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "labor_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_order"
            referencedColumns: ["id"]
          },
        ]
      }
      location: {
        Row: {
          address: string | null
          city: string | null
          complement: string | null
          created_at: string
          custom_id: string | null
          id: string
          image_url: string | null
          latitude: number | null
          longitude: number | null
          name: string
          neighborhood: string | null
          number: string | null
          parent_id: string | null
          postal_code: string | null
          state: string | null
          street: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          complement?: string | null
          created_at?: string
          custom_id?: string | null
          id?: string
          image_url?: string | null
          latitude?: number | null
          longitude?: number | null
          name: string
          neighborhood?: string | null
          number?: string | null
          parent_id?: string | null
          postal_code?: string | null
          state?: string | null
          street?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          complement?: string | null
          created_at?: string
          custom_id?: string | null
          id?: string
          image_url?: string | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          neighborhood?: string | null
          number?: string | null
          parent_id?: string | null
          postal_code?: string | null
          state?: string | null
          street?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      membership: {
        Row: {
          created_at: string
          email: string | null
          enabled: boolean
          first_name: string
          id: string
          image_url: string | null
          is_owner: boolean
          job_title: string | null
          last_name: string
          phone: string | null
          rate: number | null
          role_id: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          enabled?: boolean
          first_name: string
          id?: string
          image_url?: string | null
          is_owner?: boolean
          job_title?: string | null
          last_name: string
          phone?: string | null
          rate?: number | null
          role_id: string
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          enabled?: boolean
          first_name?: string
          id?: string
          image_url?: string | null
          is_owner?: boolean
          job_title?: string | null
          last_name?: string
          phone?: string | null
          rate?: number | null
          role_id?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "role"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      part: {
        Row: {
          area: string | null
          bar_code: string | null
          category_id: string | null
          cost: number
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          min_quantity: number
          name: string
          non_stock: boolean
          quantity: number
          tenant_id: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          area?: string | null
          bar_code?: string | null
          category_id?: string | null
          cost?: number
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          min_quantity?: number
          name: string
          non_stock?: boolean
          quantity?: number
          tenant_id: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          area?: string | null
          bar_code?: string | null
          category_id?: string | null
          cost?: number
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          min_quantity?: number
          name?: string
          non_stock?: boolean
          quantity?: number
          tenant_id?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "part_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "part_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_task_template: {
        Row: {
          id: string
          label: string
          order_index: number
          pm_id: string
          task_type: string
          tenant_id: string
        }
        Insert: {
          id?: string
          label: string
          order_index?: number
          pm_id: string
          task_type?: string
          tenant_id: string
        }
        Update: {
          id?: string
          label?: string
          order_index?: number
          pm_id?: string
          task_type?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_task_template_pm_id_fkey"
            columns: ["pm_id"]
            isOneToOne: false
            referencedRelation: "preventive_maintenance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_task_template_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      preventive_maintenance: {
        Row: {
          asset_id: string | null
          category_id: string | null
          created_at: string
          custom_id: string | null
          days_of_week: number[] | null
          description: string | null
          disabled: boolean
          due_date_delay: number | null
          ends_on: string | null
          estimated_duration: number | null
          frequency: number
          id: string
          location_id: string | null
          name: string
          next_run_at: string | null
          primary_user_id: string | null
          priority: string
          recurrence_based_on: string
          recurrence_type: string
          starts_on: string
          team_id: string | null
          tenant_id: string
          title: string
        }
        Insert: {
          asset_id?: string | null
          category_id?: string | null
          created_at?: string
          custom_id?: string | null
          days_of_week?: number[] | null
          description?: string | null
          disabled?: boolean
          due_date_delay?: number | null
          ends_on?: string | null
          estimated_duration?: number | null
          frequency?: number
          id?: string
          location_id?: string | null
          name: string
          next_run_at?: string | null
          primary_user_id?: string | null
          priority?: string
          recurrence_based_on?: string
          recurrence_type?: string
          starts_on?: string
          team_id?: string | null
          tenant_id: string
          title: string
        }
        Update: {
          asset_id?: string | null
          category_id?: string | null
          created_at?: string
          custom_id?: string | null
          days_of_week?: number[] | null
          description?: string | null
          disabled?: boolean
          due_date_delay?: number | null
          ends_on?: string | null
          estimated_duration?: number | null
          frequency?: number
          id?: string
          location_id?: string | null
          name?: string
          next_run_at?: string | null
          primary_user_id?: string | null
          priority?: string
          recurrence_based_on?: string
          recurrence_type?: string
          starts_on?: string
          team_id?: string | null
          tenant_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "preventive_maintenance_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "asset"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preventive_maintenance_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preventive_maintenance_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preventive_maintenance_primary_user_id_fkey"
            columns: ["primary_user_id"]
            isOneToOne: false
            referencedRelation: "membership"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preventive_maintenance_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preventive_maintenance_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      request: {
        Row: {
          asset_id: string | null
          cancellation_reason: string | null
          cancelled: boolean
          category_id: string | null
          created_at: string
          custom_id: string | null
          description: string | null
          id: string
          location_id: string | null
          primary_user_id: string | null
          priority: string
          tenant_id: string
          title: string
          work_order_id: string | null
        }
        Insert: {
          asset_id?: string | null
          cancellation_reason?: string | null
          cancelled?: boolean
          category_id?: string | null
          created_at?: string
          custom_id?: string | null
          description?: string | null
          id?: string
          location_id?: string | null
          primary_user_id?: string | null
          priority?: string
          tenant_id: string
          title: string
          work_order_id?: string | null
        }
        Update: {
          asset_id?: string | null
          cancellation_reason?: string | null
          cancelled?: boolean
          category_id?: string | null
          created_at?: string
          custom_id?: string | null
          description?: string | null
          id?: string
          location_id?: string | null
          primary_user_id?: string | null
          priority?: string
          tenant_id?: string
          title?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "request_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "asset"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_primary_user_id_fkey"
            columns: ["primary_user_id"]
            isOneToOne: false
            referencedRelation: "membership"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_order"
            referencedColumns: ["id"]
          },
        ]
      }
      role: {
        Row: {
          code: string
          description: string | null
          id: string
          is_default: boolean
          name: string
          permissions: Json
          tenant_id: string
        }
        Insert: {
          code?: string
          description?: string | null
          id?: string
          is_default?: boolean
          name: string
          permissions?: Json
          tenant_id: string
        }
        Update: {
          code?: string
          description?: string | null
          id?: string
          is_default?: boolean
          name?: string
          permissions?: Json
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movement: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          part_id: string
          quantity: number
          reason: string | null
          tenant_id: string
          work_order_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          part_id: string
          quantity: number
          reason?: string | null
          tenant_id: string
          work_order_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          part_id?: string
          quantity?: number
          reason?: string | null
          tenant_id?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movement_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "part"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movement_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movement_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_order"
            referencedColumns: ["id"]
          },
        ]
      }
      task: {
        Row: {
          asset_id: string | null
          id: string
          label: string
          membership_id: string | null
          options: Json
          order_index: number
          task_type: string
          tenant_id: string
          value: string | null
          work_order_id: string
        }
        Insert: {
          asset_id?: string | null
          id?: string
          label: string
          membership_id?: string | null
          options?: Json
          order_index?: number
          task_type?: string
          tenant_id: string
          value?: string | null
          work_order_id: string
        }
        Update: {
          asset_id?: string | null
          id?: string
          label?: string
          membership_id?: string | null
          options?: Json
          order_index?: number
          task_type?: string
          tenant_id?: string
          value?: string | null
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_order"
            referencedColumns: ["id"]
          },
        ]
      }
      team: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      team_member: {
        Row: {
          membership_id: string
          team_id: string
        }
        Insert: {
          membership_id: string
          team_id: string
        }
        Update: {
          membership_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_member_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "membership"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_member_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant: {
        Row: {
          created_at: string
          id: string
          logo_url: string | null
          name: string
          settings: Json
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          settings?: Json
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          settings?: Json
        }
        Relationships: []
      }
      vendor: {
        Row: {
          company_name: string
          created_at: string
          description: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          rate: number | null
          tenant_id: string
          vendor_type: string | null
          website: string | null
        }
        Insert: {
          company_name: string
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          rate?: number | null
          tenant_id: string
          vendor_type?: string | null
          website?: string | null
        }
        Update: {
          company_name?: string
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          rate?: number | null
          tenant_id?: string
          vendor_type?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order: {
        Row: {
          archived: boolean
          asset_id: string | null
          category_id: string | null
          completed_by: string | null
          completed_on: string | null
          created_at: string
          created_by: string | null
          custom_id: string | null
          description: string | null
          due_date: string | null
          estimated_duration: number | null
          estimated_start_date: string | null
          feedback: string | null
          first_time_to_react: string | null
          id: string
          location_id: string | null
          parent_pm_id: string | null
          parent_request_id: string | null
          primary_user_id: string | null
          priority: string
          required_signature: boolean
          signature_url: string | null
          status: string
          team_id: string | null
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          archived?: boolean
          asset_id?: string | null
          category_id?: string | null
          completed_by?: string | null
          completed_on?: string | null
          created_at?: string
          created_by?: string | null
          custom_id?: string | null
          description?: string | null
          due_date?: string | null
          estimated_duration?: number | null
          estimated_start_date?: string | null
          feedback?: string | null
          first_time_to_react?: string | null
          id?: string
          location_id?: string | null
          parent_pm_id?: string | null
          parent_request_id?: string | null
          primary_user_id?: string | null
          priority?: string
          required_signature?: boolean
          signature_url?: string | null
          status?: string
          team_id?: string | null
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          archived?: boolean
          asset_id?: string | null
          category_id?: string | null
          completed_by?: string | null
          completed_on?: string | null
          created_at?: string
          created_by?: string | null
          custom_id?: string | null
          description?: string | null
          due_date?: string | null
          estimated_duration?: number | null
          estimated_start_date?: string | null
          feedback?: string | null
          first_time_to_react?: string | null
          id?: string
          location_id?: string | null
          parent_pm_id?: string | null
          parent_request_id?: string | null
          primary_user_id?: string | null
          priority?: string
          required_signature?: boolean
          signature_url?: string | null
          status?: string
          team_id?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "asset"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "membership"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "membership"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_parent_pm_id_fkey"
            columns: ["parent_pm_id"]
            isOneToOne: false
            referencedRelation: "preventive_maintenance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_parent_request_id_fkey"
            columns: ["parent_request_id"]
            isOneToOne: false
            referencedRelation: "request"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_primary_user_id_fkey"
            columns: ["primary_user_id"]
            isOneToOne: false
            referencedRelation: "membership"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_assignee: {
        Row: {
          membership_id: string
          work_order_id: string
        }
        Insert: {
          membership_id: string
          work_order_id: string
        }
        Update: {
          membership_id?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_assignee_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "membership"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_assignee_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_order"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_part: {
        Row: {
          id: string
          part_id: string
          quantity: number
          tenant_id: string
          work_order_id: string
        }
        Insert: {
          id?: string
          part_id: string
          quantity?: number
          tenant_id: string
          work_order_id: string
        }
        Update: {
          id?: string
          part_id?: string
          quantity?: number
          tenant_id?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_part_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "part"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_part_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_part_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_order"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_update: {
        Row: {
          body: string
          created_at: string
          id: string
          membership_id: string | null
          tenant_id: string
          work_order_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          membership_id?: string | null
          tenant_id: string
          work_order_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          membership_id?: string | null
          tenant_id?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_update_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "membership"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_update_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_update_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_order"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bootstrap_tenant: {
        Args: { p_first_name: string; p_last_name: string; p_name: string }
        Returns: string
      }
      current_tenant_id: { Args: never; Returns: string }
      work_orders_screen: {
        Args: {
          p_include_calendar?: boolean
          p_limit?: number
          p_offset?: number
          p_priorities?: string[]
          p_search?: string
          p_statuses?: string[]
        }
        Returns: Json
      }
      work_order_detail: { Args: { p_work_order_id: string }; Returns: Json }
      next_custom_id: {
        Args: { p_entity: string; p_prefix: string; p_tenant_id: string }
        Returns: string
      }
      seed_default_roles: { Args: { p_tenant_id: string }; Returns: undefined }
      switch_tenant: { Args: { p_tenant_id: string }; Returns: undefined }
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

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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

