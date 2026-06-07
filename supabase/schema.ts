export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      allcompid: {
        Row: {
          clk_pos: number | null
          code: string | null
          comp_group: string | null
          comp_id: number
          del: number | null
          depth: number | null
          description: string | null
          dist: number | null
          elv_1: number | null
          elv_2: number | null
          f_leg: string | null
          f_node: string | null
          face: string | null
          fp: number | null
          id_chk: number | null
          id_no: string
          lvl: string | null
          q_id: string
          s_leg: string | null
          s_node: string | null
          str_id: number
          top_und: string | null
          x_cord: string | null
          y_cord: string | null
        }
        Insert: {
          clk_pos?: number | null
          code?: string | null
          comp_group?: string | null
          comp_id: number
          del?: number | null
          depth?: number | null
          description?: string | null
          dist?: number | null
          elv_1?: number | null
          elv_2?: number | null
          f_leg?: string | null
          f_node?: string | null
          face?: string | null
          fp?: number | null
          id_chk?: number | null
          id_no: string
          lvl?: string | null
          q_id: string
          s_leg?: string | null
          s_node?: string | null
          str_id: number
          top_und?: string | null
          x_cord?: string | null
          y_cord?: string | null
        }
        Update: {
          clk_pos?: number | null
          code?: string | null
          comp_group?: string | null
          comp_id?: number
          del?: number | null
          depth?: number | null
          description?: string | null
          dist?: number | null
          elv_1?: number | null
          elv_2?: number | null
          f_leg?: string | null
          f_node?: string | null
          face?: string | null
          fp?: number | null
          id_chk?: number | null
          id_no?: string
          lvl?: string | null
          q_id?: string
          s_leg?: string | null
          s_node?: string | null
          str_id?: number
          top_und?: string | null
          x_cord?: string | null
          y_cord?: string | null
        }
        Relationships: []
      }
      attachment: {
        Row: {
          created_at: string
          id: number
          meta: Json | null
          name: string | null
          path: string | null
          source_id: number | null
          source_type: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          meta?: Json | null
          name?: string | null
          path?: string | null
          source_id?: number | null
          source_type?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          meta?: Json | null
          name?: string | null
          path?: string | null
          source_id?: number | null
          source_type?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      comment: {
        Row: {
          component_id: number | null
          created_at: string
          id: number
          is_deleted: boolean | null
          structure_id: number
          structure_type: string | null
          text: string | null
          user_id: string | null
        }
        Insert: {
          component_id?: number | null
          created_at?: string
          id?: number
          is_deleted?: boolean | null
          structure_id: number
          structure_type?: string | null
          text?: string | null
          user_id?: string | null
        }
        Update: {
          component_id?: number | null
          created_at?: string
          id?: number
          is_deleted?: boolean | null
          structure_id?: number
          structure_type?: string | null
          text?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_comment_structure"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structure"
            referencedColumns: ["str_id"]
          },
          {
            foreignKeyName: "fk_comment_structure"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "v_smart_query_structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_comment_structure"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "v_structure_details"
            referencedColumns: ["str_id"]
          },
        ]
      }
      comp_type: {
        Row: {
          brdg: number | null
          code: string
          comp_ico: string | null
          descrip: string | null
          pipe: number | null
          plat: number | null
          sbm: number | null
          tank: number | null
        }
        Insert: {
          brdg?: number | null
          code: string
          comp_ico?: string | null
          descrip?: string | null
          pipe?: number | null
          plat?: number | null
          sbm?: number | null
          tank?: number | null
        }
        Update: {
          brdg?: number | null
          code?: string
          comp_ico?: string | null
          descrip?: string | null
          pipe?: number | null
          plat?: number | null
          sbm?: number | null
          tank?: number | null
        }
        Relationships: []
      }
      companies: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          max_users: number | null
          name: string
          settings: Json | null
          slug: string
          subscription_plan: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          max_users?: number | null
          name: string
          settings?: Json | null
          slug: string
          subscription_plan?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          max_users?: number | null
          name?: string
          settings?: Json | null
          slug?: string
          subscription_plan?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      company_memberships: {
        Row: {
          company_id: string
          created_at: string
          id: string
          invited_by: string | null
          is_active: boolean
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          invited_by?: string | null
          is_active?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          invited_by?: string | null
          is_active?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_memberships_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_memberships_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          company_name: string
          created_at: string | null
          def_unit: string
          department_name: string | null
          id: number
          logo_path: string | null
          serial_no: string | null
          storage_config: Json
          storage_provider: string
          updated_at: string | null
        }
        Insert: {
          company_name?: string
          created_at?: string | null
          def_unit?: string
          department_name?: string | null
          id?: number
          logo_path?: string | null
          serial_no?: string | null
          storage_config?: Json
          storage_provider?: string
          updated_at?: string | null
        }
        Update: {
          company_name?: string
          created_at?: string | null
          def_unit?: string
          department_name?: string | null
          id?: number
          logo_path?: string | null
          serial_no?: string | null
          storage_config?: Json
          storage_provider?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      component: {
        Row: {
          category_id: number | null
          created_at: string | null
          created_by: string | null
          data: Json | null
          id: number
          modified_by: string | null
          type_id: number | null
          updated_at: string | null
        }
        Insert: {
          category_id?: number | null
          created_at?: string | null
          created_by?: string | null
          data?: Json | null
          id: number
          modified_by?: string | null
          type_id?: number | null
          updated_at?: string | null
        }
        Update: {
          category_id?: number | null
          created_at?: string | null
          created_by?: string | null
          data?: Json | null
          id?: number
          modified_by?: string | null
          type_id?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      components: {
        Row: {
          brdg: number | null
          code: string | null
          comp_ico: string | null
          descrip: string | null
          id: number
          is_active: boolean
          name: string | null
          pipe: number | null
          plat: number | null
          sbm: number | null
          tank: number | null
        }
        Insert: {
          brdg?: number | null
          code?: string | null
          comp_ico?: string | null
          descrip?: string | null
          id?: number
          is_active?: boolean
          name?: string | null
          pipe?: number | null
          plat?: number | null
          sbm?: number | null
          tank?: number | null
        }
        Update: {
          brdg?: number | null
          code?: string | null
          comp_ico?: string | null
          descrip?: string | null
          id?: number
          is_active?: boolean
          name?: string | null
          pipe?: number | null
          plat?: number | null
          sbm?: number | null
          tank?: number | null
        }
        Relationships: []
      }
      defect_criteria_custom_params: {
        Row: {
          created_at: string | null
          description: string | null
          id: number
          is_active: boolean | null
          parameter_label: string
          parameter_name: string
          parameter_type: string | null
          parameter_unit: string | null
          procedure_id: number | null
          validation_rules: Json | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: number
          is_active?: boolean | null
          parameter_label: string
          parameter_name: string
          parameter_type?: string | null
          parameter_unit?: string | null
          procedure_id?: number | null
          validation_rules?: Json | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: number
          is_active?: boolean | null
          parameter_label?: string
          parameter_name?: string
          parameter_type?: string | null
          parameter_unit?: string | null
          procedure_id?: number | null
          validation_rules?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "defect_criteria_custom_params_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "defect_criteria_procedures"
            referencedColumns: ["id"]
          },
        ]
      }
      defect_criteria_procedures: {
        Row: {
          created_at: string | null
          created_by: string | null
          effective_date: string
          id: number
          notes: string | null
          procedure_name: string
          procedure_number: string
          status: string | null
          version: number
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          effective_date: string
          id?: number
          notes?: string | null
          procedure_name: string
          procedure_number: string
          status?: string | null
          version?: number
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          effective_date?: string
          id?: number
          notes?: string | null
          procedure_name?: string
          procedure_number?: string
          status?: string | null
          version?: number
        }
        Relationships: []
      }
      defect_criteria_rules: {
        Row: {
          alert_message: string
          auto_flag: boolean | null
          created_at: string | null
          custom_parameters: Json | null
          defect_code_id: string
          defect_type_id: string
          elevation_max: number | null
          elevation_min: number | null
          evaluation_priority: number
          field_name: string | null
          id: number
          jobpack_type: string | null
          nominal_thickness: number | null
          priority_id: string
          procedure_id: number | null
          rule_order: number
          structure_group: string
          threshold_operator: string | null
          threshold_text: string | null
          threshold_value: number | null
          updated_at: string | null
        }
        Insert: {
          alert_message: string
          auto_flag?: boolean | null
          created_at?: string | null
          custom_parameters?: Json | null
          defect_code_id: string
          defect_type_id: string
          elevation_max?: number | null
          elevation_min?: number | null
          evaluation_priority?: number
          field_name?: string | null
          id?: number
          jobpack_type?: string | null
          nominal_thickness?: number | null
          priority_id: string
          procedure_id?: number | null
          rule_order?: number
          structure_group: string
          threshold_operator?: string | null
          threshold_text?: string | null
          threshold_value?: number | null
          updated_at?: string | null
        }
        Update: {
          alert_message?: string
          auto_flag?: boolean | null
          created_at?: string | null
          custom_parameters?: Json | null
          defect_code_id?: string
          defect_type_id?: string
          elevation_max?: number | null
          elevation_min?: number | null
          evaluation_priority?: number
          field_name?: string | null
          id?: number
          jobpack_type?: string | null
          nominal_thickness?: number | null
          priority_id?: string
          procedure_id?: number | null
          rule_order?: number
          structure_group?: string
          threshold_operator?: string | null
          threshold_text?: string | null
          threshold_value?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "defect_criteria_rules_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "defect_criteria_procedures"
            referencedColumns: ["id"]
          },
        ]
      }
      deleted_record: {
        Row: {
          data: Json
          deleted_at: string
          id: string
          object_id: string
          table_name: string
          updated_at: string
        }
        Insert: {
          data: Json
          deleted_at?: string
          id?: string
          object_id: string
          table_name: string
          updated_at?: string
        }
        Update: {
          data?: Json
          deleted_at?: string
          id?: string
          object_id?: string
          table_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      insp_ai_analysis_queue: {
        Row: {
          analysis_id: number | null
          completed_at: string | null
          current_retry: number | null
          inspection_id: number | null
          last_error: string | null
          max_retries: number | null
          media_id: number
          priority: number | null
          queue_id: number
          queue_status: string | null
          queued_at: string | null
          started_at: string | null
        }
        Insert: {
          analysis_id?: number | null
          completed_at?: string | null
          current_retry?: number | null
          inspection_id?: number | null
          last_error?: string | null
          max_retries?: number | null
          media_id: number
          priority?: number | null
          queue_id?: number
          queue_status?: string | null
          queued_at?: string | null
          started_at?: string | null
        }
        Update: {
          analysis_id?: number | null
          completed_at?: string | null
          current_retry?: number | null
          inspection_id?: number | null
          last_error?: string | null
          max_retries?: number | null
          media_id?: number
          priority?: number | null
          queue_id?: number
          queue_status?: string | null
          queued_at?: string | null
          started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insp_ai_analysis_queue_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "insp_ai_image_analysis"
            referencedColumns: ["analysis_id"]
          },
          {
            foreignKeyName: "insp_ai_analysis_queue_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "vw_ai_analysis_results"
            referencedColumns: ["analysis_id"]
          },
          {
            foreignKeyName: "insp_ai_analysis_queue_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "insp_records"
            referencedColumns: ["insp_id"]
          },
          {
            foreignKeyName: "insp_ai_analysis_queue_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "v_anomaly_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insp_ai_analysis_queue_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "v_smart_query_incomplete"
            referencedColumns: ["insp_id"]
          },
          {
            foreignKeyName: "insp_ai_analysis_queue_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "v_smart_query_inspection_records"
            referencedColumns: ["insp_id"]
          },
          {
            foreignKeyName: "insp_ai_analysis_queue_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "vw_anomalies_detail"
            referencedColumns: ["insp_id"]
          },
          {
            foreignKeyName: "insp_ai_analysis_queue_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "vw_dive_inspections"
            referencedColumns: ["insp_id"]
          },
          {
            foreignKeyName: "insp_ai_analysis_queue_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "vw_rov_inspections"
            referencedColumns: ["insp_id"]
          },
          {
            foreignKeyName: "insp_ai_analysis_queue_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "insp_media"
            referencedColumns: ["media_id"]
          },
        ]
      }
      insp_ai_image_analysis: {
        Row: {
          ai_accuracy: string | null
          ai_provider: string
          analysis_id: number
          analysis_status: string | null
          anomaly_confidence: number | null
          anomaly_description: string | null
          anomaly_detected: boolean | null
          api_cost_usd: number | null
          component_id: number | null
          cr_date: string | null
          cr_user: string | null
          detected_conditions: Json | null
          error_message: string | null
          human_feedback: string | null
          human_review_date: string | null
          human_reviewer: string | null
          inspection_id: number | null
          md_date: string | null
          md_user: string | null
          media_id: number
          model_version: string | null
          overall_confidence: number | null
          processing_time_ms: number | null
          retry_count: number | null
          reviewed_by_human: boolean | null
          suggested_defect_type: string | null
          suggested_overall_condition: string | null
          suggested_priority: string | null
          suggested_remarks: string | null
          workunit: string | null
        }
        Insert: {
          ai_accuracy?: string | null
          ai_provider: string
          analysis_id?: number
          analysis_status?: string | null
          anomaly_confidence?: number | null
          anomaly_description?: string | null
          anomaly_detected?: boolean | null
          api_cost_usd?: number | null
          component_id?: number | null
          cr_date?: string | null
          cr_user?: string | null
          detected_conditions?: Json | null
          error_message?: string | null
          human_feedback?: string | null
          human_review_date?: string | null
          human_reviewer?: string | null
          inspection_id?: number | null
          md_date?: string | null
          md_user?: string | null
          media_id: number
          model_version?: string | null
          overall_confidence?: number | null
          processing_time_ms?: number | null
          retry_count?: number | null
          reviewed_by_human?: boolean | null
          suggested_defect_type?: string | null
          suggested_overall_condition?: string | null
          suggested_priority?: string | null
          suggested_remarks?: string | null
          workunit?: string | null
        }
        Update: {
          ai_accuracy?: string | null
          ai_provider?: string
          analysis_id?: number
          analysis_status?: string | null
          anomaly_confidence?: number | null
          anomaly_description?: string | null
          anomaly_detected?: boolean | null
          api_cost_usd?: number | null
          component_id?: number | null
          cr_date?: string | null
          cr_user?: string | null
          detected_conditions?: Json | null
          error_message?: string | null
          human_feedback?: string | null
          human_review_date?: string | null
          human_reviewer?: string | null
          inspection_id?: number | null
          md_date?: string | null
          md_user?: string | null
          media_id?: number
          model_version?: string | null
          overall_confidence?: number | null
          processing_time_ms?: number | null
          retry_count?: number | null
          reviewed_by_human?: boolean | null
          suggested_defect_type?: string | null
          suggested_overall_condition?: string | null
          suggested_priority?: string | null
          suggested_remarks?: string | null
          workunit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insp_ai_image_analysis_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "insp_records"
            referencedColumns: ["insp_id"]
          },
          {
            foreignKeyName: "insp_ai_image_analysis_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "v_anomaly_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insp_ai_image_analysis_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "v_smart_query_incomplete"
            referencedColumns: ["insp_id"]
          },
          {
            foreignKeyName: "insp_ai_image_analysis_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "v_smart_query_inspection_records"
            referencedColumns: ["insp_id"]
          },
          {
            foreignKeyName: "insp_ai_image_analysis_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "vw_anomalies_detail"
            referencedColumns: ["insp_id"]
          },
          {
            foreignKeyName: "insp_ai_image_analysis_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "vw_dive_inspections"
            referencedColumns: ["insp_id"]
          },
          {
            foreignKeyName: "insp_ai_image_analysis_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "vw_rov_inspections"
            referencedColumns: ["insp_id"]
          },
          {
            foreignKeyName: "insp_ai_image_analysis_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "insp_media"
            referencedColumns: ["media_id"]
          },
        ]
      }
      insp_ai_model_metrics: {
        Row: {
          accuracy_percentage: number | null
          accurate_predictions: number | null
          ai_provider: string
          anomaly_detection_accuracy: number | null
          avg_confidence: number | null
          avg_processing_time_ms: number | null
          condition_detection_accuracy: number | null
          defect_detection_accuracy: number | null
          failed_analyses: number | null
          inaccurate_predictions: number | null
          last_updated: string | null
          metric_date: string
          metric_id: number
          model_version: string
          partially_accurate_predictions: number | null
          successful_analyses: number | null
          total_analyses: number | null
          total_api_cost_usd: number | null
        }
        Insert: {
          accuracy_percentage?: number | null
          accurate_predictions?: number | null
          ai_provider: string
          anomaly_detection_accuracy?: number | null
          avg_confidence?: number | null
          avg_processing_time_ms?: number | null
          condition_detection_accuracy?: number | null
          defect_detection_accuracy?: number | null
          failed_analyses?: number | null
          inaccurate_predictions?: number | null
          last_updated?: string | null
          metric_date?: string
          metric_id?: number
          model_version: string
          partially_accurate_predictions?: number | null
          successful_analyses?: number | null
          total_analyses?: number | null
          total_api_cost_usd?: number | null
        }
        Update: {
          accuracy_percentage?: number | null
          accurate_predictions?: number | null
          ai_provider?: string
          anomaly_detection_accuracy?: number | null
          avg_confidence?: number | null
          avg_processing_time_ms?: number | null
          condition_detection_accuracy?: number | null
          defect_detection_accuracy?: number | null
          failed_analyses?: number | null
          inaccurate_predictions?: number | null
          last_updated?: string | null
          metric_date?: string
          metric_id?: number
          model_version?: string
          partially_accurate_predictions?: number | null
          successful_analyses?: number | null
          total_analyses?: number | null
          total_api_cost_usd?: number | null
        }
        Relationships: []
      }
      insp_ai_prompt_templates: {
        Row: {
          component_type: string | null
          cr_date: string | null
          cr_user: string | null
          inspection_type_code: string | null
          is_active: boolean | null
          max_tokens: number | null
          md_date: string | null
          md_user: string | null
          response_format: Json | null
          system_prompt: string
          temperature: number | null
          template_id: number
          template_name: string
          user_prompt_template: string
          version: number | null
          workunit: string | null
        }
        Insert: {
          component_type?: string | null
          cr_date?: string | null
          cr_user?: string | null
          inspection_type_code?: string | null
          is_active?: boolean | null
          max_tokens?: number | null
          md_date?: string | null
          md_user?: string | null
          response_format?: Json | null
          system_prompt: string
          temperature?: number | null
          template_id?: number
          template_name: string
          user_prompt_template: string
          version?: number | null
          workunit?: string | null
        }
        Update: {
          component_type?: string | null
          cr_date?: string | null
          cr_user?: string | null
          inspection_type_code?: string | null
          is_active?: boolean | null
          max_tokens?: number | null
          md_date?: string | null
          md_user?: string | null
          response_format?: Json | null
          system_prompt?: string
          temperature?: number | null
          template_id?: number
          template_name?: string
          user_prompt_template?: string
          version?: number | null
          workunit?: string | null
        }
        Relationships: []
      }
      insp_ai_training_data: {
        Row: {
          actual_condition: string
          actual_defect_type: string | null
          actual_has_anomaly: boolean | null
          actual_remarks: string | null
          analysis_id: number | null
          condition_match: boolean | null
          cr_date: string | null
          cr_user: string | null
          defect_type_match: boolean | null
          manual_labels: Json | null
          media_id: number | null
          predicted_condition: string | null
          predicted_defect_type: string | null
          predicted_has_anomaly: boolean | null
          prediction_correct: boolean | null
          training_id: number
          training_weight: number | null
          use_for_training: boolean | null
          workunit: string | null
        }
        Insert: {
          actual_condition: string
          actual_defect_type?: string | null
          actual_has_anomaly?: boolean | null
          actual_remarks?: string | null
          analysis_id?: number | null
          condition_match?: boolean | null
          cr_date?: string | null
          cr_user?: string | null
          defect_type_match?: boolean | null
          manual_labels?: Json | null
          media_id?: number | null
          predicted_condition?: string | null
          predicted_defect_type?: string | null
          predicted_has_anomaly?: boolean | null
          prediction_correct?: boolean | null
          training_id?: number
          training_weight?: number | null
          use_for_training?: boolean | null
          workunit?: string | null
        }
        Update: {
          actual_condition?: string
          actual_defect_type?: string | null
          actual_has_anomaly?: boolean | null
          actual_remarks?: string | null
          analysis_id?: number | null
          condition_match?: boolean | null
          cr_date?: string | null
          cr_user?: string | null
          defect_type_match?: boolean | null
          manual_labels?: Json | null
          media_id?: number | null
          predicted_condition?: string | null
          predicted_defect_type?: string | null
          predicted_has_anomaly?: boolean | null
          prediction_correct?: boolean | null
          training_id?: number
          training_weight?: number | null
          use_for_training?: boolean | null
          workunit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insp_ai_training_data_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "insp_ai_image_analysis"
            referencedColumns: ["analysis_id"]
          },
          {
            foreignKeyName: "insp_ai_training_data_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "vw_ai_analysis_results"
            referencedColumns: ["analysis_id"]
          },
          {
            foreignKeyName: "insp_ai_training_data_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "insp_media"
            referencedColumns: ["media_id"]
          },
        ]
      }
      insp_anomalies: {
        Row: {
          action_deadline: string | null
          action_priority: string | null
          amended_by: string | null
          amended_date: string | null
          amended_remarks: string | null
          anomaly_id: number
          anomaly_ref_no: string
          approved_by: string | null
          approved_date: string | null
          closed_by: string | null
          closed_date: string | null
          cr_date: string | null
          cr_user: string | null
          defect_category_code: string
          defect_description: string
          defect_type_code: string
          follow_up_notes: string | null
          follow_up_required: boolean | null
          inspection_id: number
          is_amended: boolean | null
          is_rectified: boolean | null
          md_date: string | null
          md_user: string | null
          priority_code: string
          recommended_action: string | null
          record_category: string | null
          rectified_by: string | null
          rectified_date: string | null
          rectified_remarks: string | null
          reviewed_by: string | null
          reviewed_date: string | null
          sequence_no: number | null
          severity: string | null
          status: string | null
          workunit: string | null
        }
        Insert: {
          action_deadline?: string | null
          action_priority?: string | null
          amended_by?: string | null
          amended_date?: string | null
          amended_remarks?: string | null
          anomaly_id?: number
          anomaly_ref_no: string
          approved_by?: string | null
          approved_date?: string | null
          closed_by?: string | null
          closed_date?: string | null
          cr_date?: string | null
          cr_user?: string | null
          defect_category_code: string
          defect_description: string
          defect_type_code: string
          follow_up_notes?: string | null
          follow_up_required?: boolean | null
          inspection_id: number
          is_amended?: boolean | null
          is_rectified?: boolean | null
          md_date?: string | null
          md_user?: string | null
          priority_code: string
          recommended_action?: string | null
          record_category?: string | null
          rectified_by?: string | null
          rectified_date?: string | null
          rectified_remarks?: string | null
          reviewed_by?: string | null
          reviewed_date?: string | null
          sequence_no?: number | null
          severity?: string | null
          status?: string | null
          workunit?: string | null
        }
        Update: {
          action_deadline?: string | null
          action_priority?: string | null
          amended_by?: string | null
          amended_date?: string | null
          amended_remarks?: string | null
          anomaly_id?: number
          anomaly_ref_no?: string
          approved_by?: string | null
          approved_date?: string | null
          closed_by?: string | null
          closed_date?: string | null
          cr_date?: string | null
          cr_user?: string | null
          defect_category_code?: string
          defect_description?: string
          defect_type_code?: string
          follow_up_notes?: string | null
          follow_up_required?: boolean | null
          inspection_id?: number
          is_amended?: boolean | null
          is_rectified?: boolean | null
          md_date?: string | null
          md_user?: string | null
          priority_code?: string
          recommended_action?: string | null
          record_category?: string | null
          rectified_by?: string | null
          rectified_date?: string | null
          rectified_remarks?: string | null
          reviewed_by?: string | null
          reviewed_date?: string | null
          sequence_no?: number | null
          severity?: string | null
          status?: string | null
          workunit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insp_anomalies_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "insp_records"
            referencedColumns: ["insp_id"]
          },
          {
            foreignKeyName: "insp_anomalies_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "v_anomaly_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insp_anomalies_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "v_smart_query_incomplete"
            referencedColumns: ["insp_id"]
          },
          {
            foreignKeyName: "insp_anomalies_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "v_smart_query_inspection_records"
            referencedColumns: ["insp_id"]
          },
          {
            foreignKeyName: "insp_anomalies_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "vw_anomalies_detail"
            referencedColumns: ["insp_id"]
          },
          {
            foreignKeyName: "insp_anomalies_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "vw_dive_inspections"
            referencedColumns: ["insp_id"]
          },
          {
            foreignKeyName: "insp_anomalies_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "vw_rov_inspections"
            referencedColumns: ["insp_id"]
          },
        ]
      }
      insp_dive_jobs: {
        Row: {
          additional_info: Json | null
          bell_operator: string | null
          cr_date: string | null
          cr_user: string | null
          dive_date: string
          dive_job_id: number
          dive_no: string
          dive_supervisor: string
          dive_type: string
          diver_name: string
          end_time: string | null
          jobpack_id: number | null
          life_support_technician: string | null
          md_date: string | null
          md_user: string | null
          report_coordinator: string
          sow_report_no: string | null
          standby_diver: string | null
          start_time: string | null
          status: string | null
          structure_id: number
          workunit: string | null
        }
        Insert: {
          additional_info?: Json | null
          bell_operator?: string | null
          cr_date?: string | null
          cr_user?: string | null
          dive_date?: string
          dive_job_id?: number
          dive_no: string
          dive_supervisor: string
          dive_type?: string
          diver_name: string
          end_time?: string | null
          jobpack_id?: number | null
          life_support_technician?: string | null
          md_date?: string | null
          md_user?: string | null
          report_coordinator: string
          sow_report_no?: string | null
          standby_diver?: string | null
          start_time?: string | null
          status?: string | null
          structure_id: number
          workunit?: string | null
        }
        Update: {
          additional_info?: Json | null
          bell_operator?: string | null
          cr_date?: string | null
          cr_user?: string | null
          dive_date?: string
          dive_job_id?: number
          dive_no?: string
          dive_supervisor?: string
          dive_type?: string
          diver_name?: string
          end_time?: string | null
          jobpack_id?: number | null
          life_support_technician?: string | null
          md_date?: string | null
          md_user?: string | null
          report_coordinator?: string
          sow_report_no?: string | null
          standby_diver?: string | null
          start_time?: string | null
          status?: string | null
          structure_id?: number
          workunit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insp_dive_jobs_jobpack_id_fkey"
            columns: ["jobpack_id"]
            isOneToOne: false
            referencedRelation: "jobpack"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insp_dive_jobs_jobpack_id_fkey"
            columns: ["jobpack_id"]
            isOneToOne: false
            referencedRelation: "v_smart_query_jobpacks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insp_dive_jobs_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structure"
            referencedColumns: ["str_id"]
          },
          {
            foreignKeyName: "insp_dive_jobs_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "v_smart_query_structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insp_dive_jobs_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "v_structure_details"
            referencedColumns: ["str_id"]
          },
        ]
      }
      insp_dive_movements: {
        Row: {
          bell_depth_meters: number | null
          cr_date: string | null
          cr_user: string | null
          depth_meters: number | null
          dive_job_id: number
          movement_id: number
          movement_time: string
          movement_type: string
          pressure_bar: number | null
          remarks: string | null
          workunit: string | null
        }
        Insert: {
          bell_depth_meters?: number | null
          cr_date?: string | null
          cr_user?: string | null
          depth_meters?: number | null
          dive_job_id: number
          movement_id?: number
          movement_time?: string
          movement_type: string
          pressure_bar?: number | null
          remarks?: string | null
          workunit?: string | null
        }
        Update: {
          bell_depth_meters?: number | null
          cr_date?: string | null
          cr_user?: string | null
          depth_meters?: number | null
          dive_job_id?: number
          movement_id?: number
          movement_time?: string
          movement_type?: string
          pressure_bar?: number | null
          remarks?: string | null
          workunit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insp_dive_movements_dive_job_id_fkey"
            columns: ["dive_job_id"]
            isOneToOne: false
            referencedRelation: "insp_dive_jobs"
            referencedColumns: ["dive_job_id"]
          },
          {
            foreignKeyName: "insp_dive_movements_dive_job_id_fkey"
            columns: ["dive_job_id"]
            isOneToOne: false
            referencedRelation: "v_anomaly_details"
            referencedColumns: ["dive_job_id"]
          },
        ]
      }
      insp_media: {
        Row: {
          anomaly_id: number | null
          captured_at: string | null
          captured_by: string | null
          cr_date: string | null
          cr_user: string | null
          description: string | null
          file_name: string
          file_path: string
          file_size_bytes: number | null
          inspection_id: number | null
          md_date: string | null
          md_user: string | null
          media_id: number
          media_type: string
          mime_type: string | null
          source: string | null
          thumbnail_path: string | null
          workunit: string | null
        }
        Insert: {
          anomaly_id?: number | null
          captured_at?: string | null
          captured_by?: string | null
          cr_date?: string | null
          cr_user?: string | null
          description?: string | null
          file_name: string
          file_path: string
          file_size_bytes?: number | null
          inspection_id?: number | null
          md_date?: string | null
          md_user?: string | null
          media_id?: number
          media_type: string
          mime_type?: string | null
          source?: string | null
          thumbnail_path?: string | null
          workunit?: string | null
        }
        Update: {
          anomaly_id?: number | null
          captured_at?: string | null
          captured_by?: string | null
          cr_date?: string | null
          cr_user?: string | null
          description?: string | null
          file_name?: string
          file_path?: string
          file_size_bytes?: number | null
          inspection_id?: number | null
          md_date?: string | null
          md_user?: string | null
          media_id?: number
          media_type?: string
          mime_type?: string | null
          source?: string | null
          thumbnail_path?: string | null
          workunit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insp_media_anomaly_id_fkey"
            columns: ["anomaly_id"]
            isOneToOne: false
            referencedRelation: "insp_anomalies"
            referencedColumns: ["anomaly_id"]
          },
          {
            foreignKeyName: "insp_media_anomaly_id_fkey"
            columns: ["anomaly_id"]
            isOneToOne: false
            referencedRelation: "v_anomaly_details"
            referencedColumns: ["anomaly_id"]
          },
          {
            foreignKeyName: "insp_media_anomaly_id_fkey"
            columns: ["anomaly_id"]
            isOneToOne: false
            referencedRelation: "v_smart_query_anomalies"
            referencedColumns: ["anomaly_id"]
          },
          {
            foreignKeyName: "insp_media_anomaly_id_fkey"
            columns: ["anomaly_id"]
            isOneToOne: false
            referencedRelation: "v_smart_query_findings"
            referencedColumns: ["anomaly_id"]
          },
          {
            foreignKeyName: "insp_media_anomaly_id_fkey"
            columns: ["anomaly_id"]
            isOneToOne: false
            referencedRelation: "vw_anomalies_detail"
            referencedColumns: ["anomaly_id"]
          },
          {
            foreignKeyName: "insp_media_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "insp_records"
            referencedColumns: ["insp_id"]
          },
          {
            foreignKeyName: "insp_media_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "v_anomaly_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insp_media_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "v_smart_query_incomplete"
            referencedColumns: ["insp_id"]
          },
          {
            foreignKeyName: "insp_media_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "v_smart_query_inspection_records"
            referencedColumns: ["insp_id"]
          },
          {
            foreignKeyName: "insp_media_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "vw_anomalies_detail"
            referencedColumns: ["insp_id"]
          },
          {
            foreignKeyName: "insp_media_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "vw_dive_inspections"
            referencedColumns: ["insp_id"]
          },
          {
            foreignKeyName: "insp_media_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "vw_rov_inspections"
            referencedColumns: ["insp_id"]
          },
        ]
      }
      insp_numbering_patterns: {
        Row: {
          confidence_score: number | null
          cr_date: string | null
          last_sequence_number: number | null
          last_used_date: string | null
          pattern_format: string
          pattern_id: number
          pattern_type: string
          sample_values: string[] | null
          usage_count: number | null
          user_id: string
        }
        Insert: {
          confidence_score?: number | null
          cr_date?: string | null
          last_sequence_number?: number | null
          last_used_date?: string | null
          pattern_format: string
          pattern_id?: number
          pattern_type: string
          sample_values?: string[] | null
          usage_count?: number | null
          user_id: string
        }
        Update: {
          confidence_score?: number | null
          cr_date?: string | null
          last_sequence_number?: number | null
          last_used_date?: string | null
          pattern_format?: string
          pattern_id?: number
          pattern_type?: string
          sample_values?: string[] | null
          usage_count?: number | null
          user_id?: string
        }
        Relationships: []
      }
      insp_personnel_history: {
        Row: {
          assignment_date: string | null
          coordinator: string | null
          frequency_count: number | null
          history_id: number
          job_type: string
          primary_person: string | null
          structure_id: number | null
          supervisor: string | null
          user_id: string
        }
        Insert: {
          assignment_date?: string | null
          coordinator?: string | null
          frequency_count?: number | null
          history_id?: number
          job_type: string
          primary_person?: string | null
          structure_id?: number | null
          supervisor?: string | null
          user_id: string
        }
        Update: {
          assignment_date?: string | null
          coordinator?: string | null
          frequency_count?: number | null
          history_id?: number
          job_type?: string
          primary_person?: string | null
          structure_id?: number | null
          supervisor?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "insp_personnel_history_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structure"
            referencedColumns: ["str_id"]
          },
          {
            foreignKeyName: "insp_personnel_history_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "v_smart_query_structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insp_personnel_history_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "v_structure_details"
            referencedColumns: ["str_id"]
          },
        ]
      }
      insp_prog: {
        Row: {
          insp_prog: string
          inspcode: string
          prog_type: number | null
        }
        Insert: {
          insp_prog: string
          inspcode: string
          prog_type?: number | null
        }
        Update: {
          insp_prog?: string
          inspcode?: string
          prog_type?: number | null
        }
        Relationships: []
      }
      insp_records: {
        Row: {
          approved_by: string | null
          approved_date: string | null
          archived_data: Json | null
          component_id: number
          component_type: string | null
          cr_date: string | null
          cr_user: string | null
          description: string | null
          dive_job_id: number | null
          elevation: number | null
          fp_kp: string | null
          has_anomaly: boolean | null
          incomplete_reason: string | null
          insp_id: number
          inspection_data: Json
          inspection_date: string
          inspection_time: string
          inspection_type_code: string
          inspection_type_id: number | null
          jobpack_id: number | null
          md_date: string | null
          md_user: string | null
          reviewed_by: string | null
          reviewed_date: string | null
          rov_data_snapshot: Json | null
          rov_data_timestamp: string | null
          rov_job_id: number | null
          sow_report_no: string | null
          status: string | null
          structure_id: number
          tape_count_no: string | null
          tape_id: number | null
          video_frame_grabbed: boolean | null
          video_frame_media_id: number | null
          workunit: string | null
        }
        Insert: {
          approved_by?: string | null
          approved_date?: string | null
          archived_data?: Json | null
          component_id: number
          component_type?: string | null
          cr_date?: string | null
          cr_user?: string | null
          description?: string | null
          dive_job_id?: number | null
          elevation?: number | null
          fp_kp?: string | null
          has_anomaly?: boolean | null
          incomplete_reason?: string | null
          insp_id?: number
          inspection_data?: Json
          inspection_date?: string
          inspection_time?: string
          inspection_type_code: string
          inspection_type_id?: number | null
          jobpack_id?: number | null
          md_date?: string | null
          md_user?: string | null
          reviewed_by?: string | null
          reviewed_date?: string | null
          rov_data_snapshot?: Json | null
          rov_data_timestamp?: string | null
          rov_job_id?: number | null
          sow_report_no?: string | null
          status?: string | null
          structure_id: number
          tape_count_no?: string | null
          tape_id?: number | null
          video_frame_grabbed?: boolean | null
          video_frame_media_id?: number | null
          workunit?: string | null
        }
        Update: {
          approved_by?: string | null
          approved_date?: string | null
          archived_data?: Json | null
          component_id?: number
          component_type?: string | null
          cr_date?: string | null
          cr_user?: string | null
          description?: string | null
          dive_job_id?: number | null
          elevation?: number | null
          fp_kp?: string | null
          has_anomaly?: boolean | null
          incomplete_reason?: string | null
          insp_id?: number
          inspection_data?: Json
          inspection_date?: string
          inspection_time?: string
          inspection_type_code?: string
          inspection_type_id?: number | null
          jobpack_id?: number | null
          md_date?: string | null
          md_user?: string | null
          reviewed_by?: string | null
          reviewed_date?: string | null
          rov_data_snapshot?: Json | null
          rov_data_timestamp?: string | null
          rov_job_id?: number | null
          sow_report_no?: string | null
          status?: string | null
          structure_id?: number
          tape_count_no?: string | null
          tape_id?: number | null
          video_frame_grabbed?: boolean | null
          video_frame_media_id?: number | null
          workunit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_insp_records_structure"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structure"
            referencedColumns: ["str_id"]
          },
          {
            foreignKeyName: "fk_insp_records_structure"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "v_smart_query_structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_insp_records_structure"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "v_structure_details"
            referencedColumns: ["str_id"]
          },
          {
            foreignKeyName: "insp_records_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "structure_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insp_records_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "v_anomaly_details"
            referencedColumns: ["component_id"]
          },
          {
            foreignKeyName: "insp_records_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "v_smart_query_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insp_records_dive_job_id_fkey"
            columns: ["dive_job_id"]
            isOneToOne: false
            referencedRelation: "insp_dive_jobs"
            referencedColumns: ["dive_job_id"]
          },
          {
            foreignKeyName: "insp_records_dive_job_id_fkey"
            columns: ["dive_job_id"]
            isOneToOne: false
            referencedRelation: "v_anomaly_details"
            referencedColumns: ["dive_job_id"]
          },
          {
            foreignKeyName: "insp_records_inspection_type_id_fkey"
            columns: ["inspection_type_id"]
            isOneToOne: false
            referencedRelation: "inspection_type"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insp_records_jobpack_id_fkey"
            columns: ["jobpack_id"]
            isOneToOne: false
            referencedRelation: "jobpack"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insp_records_jobpack_id_fkey"
            columns: ["jobpack_id"]
            isOneToOne: false
            referencedRelation: "v_smart_query_jobpacks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insp_records_rov_job_id_fkey"
            columns: ["rov_job_id"]
            isOneToOne: false
            referencedRelation: "insp_rov_jobs"
            referencedColumns: ["rov_job_id"]
          },
          {
            foreignKeyName: "insp_records_rov_job_id_fkey"
            columns: ["rov_job_id"]
            isOneToOne: false
            referencedRelation: "v_anomaly_details"
            referencedColumns: ["rov_job_id"]
          },
          {
            foreignKeyName: "insp_records_rov_job_id_fkey"
            columns: ["rov_job_id"]
            isOneToOne: false
            referencedRelation: "vw_rov_inspections_with_settings"
            referencedColumns: ["rov_job_id"]
          },
          {
            foreignKeyName: "insp_records_tape_id_fkey"
            columns: ["tape_id"]
            isOneToOne: false
            referencedRelation: "insp_video_tapes"
            referencedColumns: ["tape_id"]
          },
          {
            foreignKeyName: "insp_records_video_frame_media_id_fkey"
            columns: ["video_frame_media_id"]
            isOneToOne: false
            referencedRelation: "insp_media"
            referencedColumns: ["media_id"]
          },
        ]
      }
      insp_rov_jobs: {
        Row: {
          additional_info: Json | null
          auto_capture_data: boolean | null
          auto_grab_video: boolean | null
          cr_date: string | null
          cr_user: string | null
          deployment_date: string
          deployment_no: string
          end_time: string | null
          jobpack_id: number | null
          md_date: string | null
          md_user: string | null
          report_coordinator: string
          rov_data_config_id: number | null
          rov_job_id: number
          rov_operator: string
          rov_serial_no: string
          rov_supervisor: string
          rov_telemetry: Json | null
          rov_type: string | null
          sow_report_no: string | null
          start_time: string | null
          status: string | null
          structure_id: number
          video_grab_config_id: number | null
          workunit: string | null
        }
        Insert: {
          additional_info?: Json | null
          auto_capture_data?: boolean | null
          auto_grab_video?: boolean | null
          cr_date?: string | null
          cr_user?: string | null
          deployment_date?: string
          deployment_no: string
          end_time?: string | null
          jobpack_id?: number | null
          md_date?: string | null
          md_user?: string | null
          report_coordinator: string
          rov_data_config_id?: number | null
          rov_job_id?: number
          rov_operator: string
          rov_serial_no: string
          rov_supervisor: string
          rov_telemetry?: Json | null
          rov_type?: string | null
          sow_report_no?: string | null
          start_time?: string | null
          status?: string | null
          structure_id: number
          video_grab_config_id?: number | null
          workunit?: string | null
        }
        Update: {
          additional_info?: Json | null
          auto_capture_data?: boolean | null
          auto_grab_video?: boolean | null
          cr_date?: string | null
          cr_user?: string | null
          deployment_date?: string
          deployment_no?: string
          end_time?: string | null
          jobpack_id?: number | null
          md_date?: string | null
          md_user?: string | null
          report_coordinator?: string
          rov_data_config_id?: number | null
          rov_job_id?: number
          rov_operator?: string
          rov_serial_no?: string
          rov_supervisor?: string
          rov_telemetry?: Json | null
          rov_type?: string | null
          sow_report_no?: string | null
          start_time?: string | null
          status?: string | null
          structure_id?: number
          video_grab_config_id?: number | null
          workunit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insp_rov_jobs_jobpack_id_fkey"
            columns: ["jobpack_id"]
            isOneToOne: false
            referencedRelation: "jobpack"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insp_rov_jobs_jobpack_id_fkey"
            columns: ["jobpack_id"]
            isOneToOne: false
            referencedRelation: "v_smart_query_jobpacks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insp_rov_jobs_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structure"
            referencedColumns: ["str_id"]
          },
          {
            foreignKeyName: "insp_rov_jobs_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "v_smart_query_structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insp_rov_jobs_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "v_structure_details"
            referencedColumns: ["str_id"]
          },
        ]
      }
      insp_rov_movements: {
        Row: {
          altitude_meters: number | null
          cr_date: string | null
          cr_user: string | null
          depth_meters: number | null
          heading_degrees: number | null
          latitude: number | null
          longitude: number | null
          movement_id: number
          movement_time: string
          movement_type: string
          remarks: string | null
          rov_job_id: number
          telemetry_data: Json | null
          workunit: string | null
        }
        Insert: {
          altitude_meters?: number | null
          cr_date?: string | null
          cr_user?: string | null
          depth_meters?: number | null
          heading_degrees?: number | null
          latitude?: number | null
          longitude?: number | null
          movement_id?: number
          movement_time?: string
          movement_type: string
          remarks?: string | null
          rov_job_id: number
          telemetry_data?: Json | null
          workunit?: string | null
        }
        Update: {
          altitude_meters?: number | null
          cr_date?: string | null
          cr_user?: string | null
          depth_meters?: number | null
          heading_degrees?: number | null
          latitude?: number | null
          longitude?: number | null
          movement_id?: number
          movement_time?: string
          movement_type?: string
          remarks?: string | null
          rov_job_id?: number
          telemetry_data?: Json | null
          workunit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insp_rov_movements_rov_job_id_fkey"
            columns: ["rov_job_id"]
            isOneToOne: false
            referencedRelation: "insp_rov_jobs"
            referencedColumns: ["rov_job_id"]
          },
          {
            foreignKeyName: "insp_rov_movements_rov_job_id_fkey"
            columns: ["rov_job_id"]
            isOneToOne: false
            referencedRelation: "v_anomaly_details"
            referencedColumns: ["rov_job_id"]
          },
          {
            foreignKeyName: "insp_rov_movements_rov_job_id_fkey"
            columns: ["rov_job_id"]
            isOneToOne: false
            referencedRelation: "vw_rov_inspections_with_settings"
            referencedColumns: ["rov_job_id"]
          },
        ]
      }
      insp_text_patterns: {
        Row: {
          component_type: string | null
          cr_date: string | null
          field_name: string
          inspection_type_code: string
          last_used_date: string | null
          normalized_text: string | null
          pattern_text: string
          quality_score: number | null
          text_pattern_id: number
          usage_count: number | null
          user_count: number | null
          word_tokens: string[] | null
        }
        Insert: {
          component_type?: string | null
          cr_date?: string | null
          field_name: string
          inspection_type_code: string
          last_used_date?: string | null
          normalized_text?: string | null
          pattern_text: string
          quality_score?: number | null
          text_pattern_id?: number
          usage_count?: number | null
          user_count?: number | null
          word_tokens?: string[] | null
        }
        Update: {
          component_type?: string | null
          cr_date?: string | null
          field_name?: string
          inspection_type_code?: string
          last_used_date?: string | null
          normalized_text?: string | null
          pattern_text?: string
          quality_score?: number | null
          text_pattern_id?: number
          usage_count?: number | null
          user_count?: number | null
          word_tokens?: string[] | null
        }
        Relationships: []
      }
      insp_type: {
        Row: {
          code: string
          itype_id: number | null
          name: string | null
          pipe: number | null
          plat: number | null
          sbm: number | null
          sname: string | null
          tank: number | null
        }
        Insert: {
          code: string
          itype_id?: number | null
          name?: string | null
          pipe?: number | null
          plat?: number | null
          sbm?: number | null
          sname?: string | null
          tank?: number | null
        }
        Update: {
          code?: string
          itype_id?: number | null
          name?: string | null
          pipe?: number | null
          plat?: number | null
          sbm?: number | null
          sname?: string | null
          tank?: number | null
        }
        Relationships: []
      }
      insp_video_counters: {
        Row: {
          counter_format: string | null
          counter_id: number
          cr_date: string | null
          current_counter_value: number | null
          is_running: boolean | null
          md_date: string | null
          started_at: string | null
          stopped_at: string | null
          tape_id: number
        }
        Insert: {
          counter_format?: string | null
          counter_id?: number
          cr_date?: string | null
          current_counter_value?: number | null
          is_running?: boolean | null
          md_date?: string | null
          started_at?: string | null
          stopped_at?: string | null
          tape_id: number
        }
        Update: {
          counter_format?: string | null
          counter_id?: number
          cr_date?: string | null
          current_counter_value?: number | null
          is_running?: boolean | null
          md_date?: string | null
          started_at?: string | null
          stopped_at?: string | null
          tape_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "insp_video_counters_tape_id_fkey"
            columns: ["tape_id"]
            isOneToOne: true
            referencedRelation: "insp_video_tapes"
            referencedColumns: ["tape_id"]
          },
        ]
      }
      insp_video_logs: {
        Row: {
          counter_format: string | null
          cr_date: string | null
          cr_user: string | null
          event_time: string
          event_type: string
          inspection_id: number | null
          remarks: string | null
          tape_counter_end: number | null
          tape_counter_start: number | null
          tape_id: number
          timecode_end: string | null
          timecode_start: string | null
          video_log_id: number
          workunit: string | null
        }
        Insert: {
          counter_format?: string | null
          cr_date?: string | null
          cr_user?: string | null
          event_time?: string
          event_type: string
          inspection_id?: number | null
          remarks?: string | null
          tape_counter_end?: number | null
          tape_counter_start?: number | null
          tape_id: number
          timecode_end?: string | null
          timecode_start?: string | null
          video_log_id?: number
          workunit?: string | null
        }
        Update: {
          counter_format?: string | null
          cr_date?: string | null
          cr_user?: string | null
          event_time?: string
          event_type?: string
          inspection_id?: number | null
          remarks?: string | null
          tape_counter_end?: number | null
          tape_counter_start?: number | null
          tape_id?: number
          timecode_end?: string | null
          timecode_start?: string | null
          video_log_id?: number
          workunit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insp_video_logs_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "insp_records"
            referencedColumns: ["insp_id"]
          },
          {
            foreignKeyName: "insp_video_logs_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "v_anomaly_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insp_video_logs_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "v_smart_query_incomplete"
            referencedColumns: ["insp_id"]
          },
          {
            foreignKeyName: "insp_video_logs_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "v_smart_query_inspection_records"
            referencedColumns: ["insp_id"]
          },
          {
            foreignKeyName: "insp_video_logs_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "vw_anomalies_detail"
            referencedColumns: ["insp_id"]
          },
          {
            foreignKeyName: "insp_video_logs_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "vw_dive_inspections"
            referencedColumns: ["insp_id"]
          },
          {
            foreignKeyName: "insp_video_logs_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "vw_rov_inspections"
            referencedColumns: ["insp_id"]
          },
          {
            foreignKeyName: "insp_video_logs_tape_id_fkey"
            columns: ["tape_id"]
            isOneToOne: false
            referencedRelation: "insp_video_tapes"
            referencedColumns: ["tape_id"]
          },
        ]
      }
      insp_video_tapes: {
        Row: {
          chapter_no: string | null
          cr_date: string | null
          cr_user: string | null
          dive_job_id: number | null
          md_date: string | null
          md_user: string | null
          remarks: string | null
          rov_job_id: number | null
          status: string | null
          tape_id: number
          tape_no: string
          tape_type: string | null
          total_duration_minutes: number | null
          workunit: string | null
        }
        Insert: {
          chapter_no?: string | null
          cr_date?: string | null
          cr_user?: string | null
          dive_job_id?: number | null
          md_date?: string | null
          md_user?: string | null
          remarks?: string | null
          rov_job_id?: number | null
          status?: string | null
          tape_id?: number
          tape_no: string
          tape_type?: string | null
          total_duration_minutes?: number | null
          workunit?: string | null
        }
        Update: {
          chapter_no?: string | null
          cr_date?: string | null
          cr_user?: string | null
          dive_job_id?: number | null
          md_date?: string | null
          md_user?: string | null
          remarks?: string | null
          rov_job_id?: number | null
          status?: string | null
          tape_id?: number
          tape_no?: string
          tape_type?: string | null
          total_duration_minutes?: number | null
          workunit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insp_video_tapes_dive_job_id_fkey"
            columns: ["dive_job_id"]
            isOneToOne: false
            referencedRelation: "insp_dive_jobs"
            referencedColumns: ["dive_job_id"]
          },
          {
            foreignKeyName: "insp_video_tapes_dive_job_id_fkey"
            columns: ["dive_job_id"]
            isOneToOne: false
            referencedRelation: "v_anomaly_details"
            referencedColumns: ["dive_job_id"]
          },
          {
            foreignKeyName: "insp_video_tapes_rov_job_id_fkey"
            columns: ["rov_job_id"]
            isOneToOne: false
            referencedRelation: "insp_rov_jobs"
            referencedColumns: ["rov_job_id"]
          },
          {
            foreignKeyName: "insp_video_tapes_rov_job_id_fkey"
            columns: ["rov_job_id"]
            isOneToOne: false
            referencedRelation: "v_anomaly_details"
            referencedColumns: ["rov_job_id"]
          },
          {
            foreignKeyName: "insp_video_tapes_rov_job_id_fkey"
            columns: ["rov_job_id"]
            isOneToOne: false
            referencedRelation: "vw_rov_inspections_with_settings"
            referencedColumns: ["rov_job_id"]
          },
        ]
      }
      inspection_planning: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: number
          metadata: Json | null
          modified_by: string | null
          name: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: number
          metadata?: Json | null
          modified_by?: string | null
          name?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: number
          metadata?: Json | null
          modified_by?: string | null
          name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      inspection_program: {
        Row: {
          code: string | null
          created_at: string | null
          created_by: string | null
          id: number
          modified_by: string | null
          program: string | null
          type: number
          updated_at: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: number
          modified_by?: string | null
          program?: string | null
          type?: number
          updated_at?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: number
          modified_by?: string | null
          program?: string | null
          type?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      inspection_type: {
        Row: {
          category: string | null
          code: string | null
          cr_date: string | null
          cr_user: string | null
          created_at: string | null
          created_by: string | null
          default_properties: Json | null
          description: string | null
          id: number
          is_active: boolean | null
          md_date: string | null
          md_user: string | null
          metadata: Json | null
          min_photo_count: number | null
          modified_by: string | null
          name: string | null
          requires_photos: boolean | null
          requires_video: boolean | null
          sname: string | null
          updated_at: string | null
          workunit: string | null
        }
        Insert: {
          category?: string | null
          code?: string | null
          cr_date?: string | null
          cr_user?: string | null
          created_at?: string | null
          created_by?: string | null
          default_properties?: Json | null
          description?: string | null
          id?: number
          is_active?: boolean | null
          md_date?: string | null
          md_user?: string | null
          metadata?: Json | null
          min_photo_count?: number | null
          modified_by?: string | null
          name?: string | null
          requires_photos?: boolean | null
          requires_video?: boolean | null
          sname?: string | null
          updated_at?: string | null
          workunit?: string | null
        }
        Update: {
          category?: string | null
          code?: string | null
          cr_date?: string | null
          cr_user?: string | null
          created_at?: string | null
          created_by?: string | null
          default_properties?: Json | null
          description?: string | null
          id?: number
          is_active?: boolean | null
          md_date?: string | null
          md_user?: string | null
          metadata?: Json | null
          min_photo_count?: number | null
          modified_by?: string | null
          name?: string | null
          requires_photos?: boolean | null
          requires_video?: boolean | null
          sname?: string | null
          updated_at?: string | null
          workunit?: string | null
        }
        Relationships: []
      }
      insptype_sub: {
        Row: {
          CODE: string
          ITYPE_ID: number | null
          NAME: string
          PIPE: number | null
          PLAT: number | null
          SBM: number | null
          SCODE: string
          TANK: number | null
        }
        Insert: {
          CODE: string
          ITYPE_ID?: number | null
          NAME: string
          PIPE?: number | null
          PLAT?: number | null
          SBM?: number | null
          SCODE: string
          TANK?: number | null
        }
        Update: {
          CODE?: string
          ITYPE_ID?: number | null
          NAME?: string
          PIPE?: number | null
          PLAT?: number | null
          SBM?: number | null
          SCODE?: string
          TANK?: number | null
        }
        Relationships: []
      }
      jobpack: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: number
          metadata: Json | null
          mgi_profile_id: number | null
          modified_by: string | null
          name: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: number
          metadata?: Json | null
          mgi_profile_id?: number | null
          modified_by?: string | null
          name?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: number
          metadata?: Json | null
          mgi_profile_id?: number | null
          modified_by?: string | null
          name?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobpack_mgi_profile_id_fkey"
            columns: ["mgi_profile_id"]
            isOneToOne: false
            referencedRelation: "mgi_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mgi_profiles: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: number
          is_active: boolean | null
          is_archived: boolean | null
          is_job_specific: boolean | null
          name: string
          thresholds: Json | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: number
          is_active?: boolean | null
          is_archived?: boolean | null
          is_job_specific?: boolean | null
          name: string
          thresholds?: Json | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: number
          is_active?: boolean | null
          is_archived?: boolean | null
          is_job_specific?: boolean | null
          name?: string
          thresholds?: Json | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      module: {
        Row: {
          category_id: number | null
          created_at: string
          created_by: string | null
          data: Json | null
          id: number
          modified_by: string | null
          type_id: number | null
          updated_at: string | null
        }
        Insert: {
          category_id?: number | null
          created_at?: string
          created_by?: string | null
          data?: Json | null
          id?: number
          modified_by?: string | null
          type_id?: number | null
          updated_at?: string | null
        }
        Update: {
          category_id?: number | null
          created_at?: string
          created_by?: string | null
          data?: Json | null
          id?: number
          modified_by?: string | null
          type_id?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "module_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "module_category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "type"
            referencedColumns: ["id"]
          },
        ]
      }
      module_category: {
        Row: {
          created_at: string
          created_by: string | null
          id: number
          modified_by: string | null
          name: string | null
          remark: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: number
          modified_by?: string | null
          name?: string | null
          remark?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: number
          modified_by?: string | null
          name?: string | null
          remark?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      module_type: {
        Row: {
          created_at: string
          created_by: string | null
          id: number
          modified_by: string | null
          name: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: number
          modified_by?: string | null
          name?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: number
          modified_by?: string | null
          name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      notes: {
        Row: {
          id: number
          title: string | null
        }
        Insert: {
          id?: number
          title?: string | null
        }
        Update: {
          id?: number
          title?: string | null
        }
        Relationships: []
      }
      pipe_geo: {
        Row: {
          cr_date: string | null
          cr_user: string | null
          geo_datum: string | null
          geo_dir: string | null
          geo_dx: number | null
          geo_dx_u: string | null
          geo_dy: number | null
          geo_dy_u: string | null
          geo_dz: number | null
          geo_dz_u: string | null
          geo_elli_sph: string | null
          geo_proj_nam: string
          geo_units: string | null
          str_id: number
          workunit: string | null
        }
        Insert: {
          cr_date?: string | null
          cr_user?: string | null
          geo_datum?: string | null
          geo_dir?: string | null
          geo_dx?: number | null
          geo_dx_u?: string | null
          geo_dy?: number | null
          geo_dy_u?: string | null
          geo_dz?: number | null
          geo_dz_u?: string | null
          geo_elli_sph?: string | null
          geo_proj_nam: string
          geo_units?: string | null
          str_id: number
          workunit?: string | null
        }
        Update: {
          cr_date?: string | null
          cr_user?: string | null
          geo_datum?: string | null
          geo_dir?: string | null
          geo_dx?: number | null
          geo_dx_u?: string | null
          geo_dy?: number | null
          geo_dy_u?: string | null
          geo_dz?: number | null
          geo_dz_u?: string | null
          geo_elli_sph?: string | null
          geo_proj_nam?: string
          geo_units?: string | null
          str_id?: number
          workunit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_pipe_geo"
            columns: ["str_id"]
            isOneToOne: false
            referencedRelation: "structure"
            referencedColumns: ["str_id"]
          },
          {
            foreignKeyName: "fk_pipe_geo"
            columns: ["str_id"]
            isOneToOne: false
            referencedRelation: "v_smart_query_structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_pipe_geo"
            columns: ["str_id"]
            isOneToOne: false
            referencedRelation: "v_structure_details"
            referencedColumns: ["str_id"]
          },
        ]
      }
      pl_comp: {
        Row: {
          clk_pos: number | null
          code: string | null
          comp_group: string | null
          comp_id: number
          cr_date: string | null
          cr_user: string | null
          del: number | null
          depth: number | null
          description: string | null
          diameter: number | null
          dist: number | null
          elv_1: number | null
          elv_2: number | null
          f_insp: string | null
          f_leg: string | null
          f_node: string | null
          face: string | null
          icycle: number | null
          id_chk: number | null
          id_no: string
          itime: number | null
          l_insp: string | null
          level: string | null
          material: string | null
          n_insp: string | null
          q_id: string
          s_leg: string | null
          s_node: string | null
          str_id: number
          thetype: string | null
          top_und: string | null
          wall_thk: number | null
          workunit: string | null
        }
        Insert: {
          clk_pos?: number | null
          code?: string | null
          comp_group?: string | null
          comp_id: number
          cr_date?: string | null
          cr_user?: string | null
          del?: number | null
          depth?: number | null
          description?: string | null
          diameter?: number | null
          dist?: number | null
          elv_1?: number | null
          elv_2?: number | null
          f_insp?: string | null
          f_leg?: string | null
          f_node?: string | null
          face?: string | null
          icycle?: number | null
          id_chk?: number | null
          id_no: string
          itime?: number | null
          l_insp?: string | null
          level?: string | null
          material?: string | null
          n_insp?: string | null
          q_id: string
          s_leg?: string | null
          s_node?: string | null
          str_id: number
          thetype?: string | null
          top_und?: string | null
          wall_thk?: number | null
          workunit?: string | null
        }
        Update: {
          clk_pos?: number | null
          code?: string | null
          comp_group?: string | null
          comp_id?: number
          cr_date?: string | null
          cr_user?: string | null
          del?: number | null
          depth?: number | null
          description?: string | null
          diameter?: number | null
          dist?: number | null
          elv_1?: number | null
          elv_2?: number | null
          f_insp?: string | null
          f_leg?: string | null
          f_node?: string | null
          face?: string | null
          icycle?: number | null
          id_chk?: number | null
          id_no?: string
          itime?: number | null
          l_insp?: string | null
          level?: string | null
          material?: string | null
          n_insp?: string | null
          q_id?: string
          s_leg?: string | null
          s_node?: string | null
          str_id?: number
          thetype?: string | null
          top_und?: string | null
          wall_thk?: number | null
          workunit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_pl_comp"
            columns: ["str_id"]
            isOneToOne: false
            referencedRelation: "structure"
            referencedColumns: ["str_id"]
          },
          {
            foreignKeyName: "fk_pl_comp"
            columns: ["str_id"]
            isOneToOne: false
            referencedRelation: "v_smart_query_structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_pl_comp"
            columns: ["str_id"]
            isOneToOne: false
            referencedRelation: "v_structure_details"
            referencedColumns: ["str_id"]
          },
        ]
      }
      planning2: {
        Row: {
          comp_id: number
          compcode: string
          cr_date: string | null
          cr_user: string | null
          freq: number | null
          insp_prog: string
          inspcode: string
          inspno: string | null
          next_date: string | null
          status: string | null
          str_id: number
          subsea: number
          topside: number
          workunit: string | null
        }
        Insert: {
          comp_id: number
          compcode: string
          cr_date?: string | null
          cr_user?: string | null
          freq?: number | null
          insp_prog: string
          inspcode: string
          inspno?: string | null
          next_date?: string | null
          status?: string | null
          str_id: number
          subsea: number
          topside: number
          workunit?: string | null
        }
        Update: {
          comp_id?: number
          compcode?: string
          cr_date?: string | null
          cr_user?: string | null
          freq?: number | null
          insp_prog?: string
          inspcode?: string
          inspno?: string | null
          next_date?: string | null
          status?: string | null
          str_id?: number
          subsea?: number
          topside?: number
          workunit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_planning2"
            columns: ["str_id"]
            isOneToOne: false
            referencedRelation: "structure"
            referencedColumns: ["str_id"]
          },
          {
            foreignKeyName: "fk_planning2"
            columns: ["str_id"]
            isOneToOne: false
            referencedRelation: "v_smart_query_structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_planning2"
            columns: ["str_id"]
            isOneToOne: false
            referencedRelation: "v_structure_details"
            referencedColumns: ["str_id"]
          },
        ]
      }
      platform: {
        Row: {
          an_qty: number | null
          an_type: string | null
          caisson: number | null
          conduct: number | null
          corr_ctg: string | null
          cp_system: string | null
          cr_date: string | null
          cr_user: string | null
          crane: number | null
          cslot: number | null
          def_unit: string | null
          depth: number | null
          desg_life: number | null
          dleg: number | null
          fender: number | null
          helipad: string | null
          inst_ctr: string | null
          inst_date: string | null
          leg_t1: string | null
          leg_t10: string | null
          leg_t11: string | null
          leg_t12: string | null
          leg_t13: string | null
          leg_t14: string | null
          leg_t15: string | null
          leg_t16: string | null
          leg_t17: string | null
          leg_t18: string | null
          leg_t19: string | null
          leg_t2: string | null
          leg_t20: string | null
          leg_t3: string | null
          leg_t4: string | null
          leg_t5: string | null
          leg_t6: string | null
          leg_t7: string | null
          leg_t8: string | null
          leg_t9: string | null
          manned: string | null
          material: string | null
          nleg_t1: string | null
          nleg_t2: string | null
          north_angle: number | null
          north_side: string | null
          pdesc: string | null
          pfield: string | null
          pileint: number | null
          pileskt: number | null
          plat_id: number
          plegs: number | null
          process: string | null
          ptype: string | null
          riser: number | null
          sent: string | null
          st_east: string | null
          st_north: string | null
          sump: number | null
          title: string
          wall_thk: number | null
          workunit: string | null
        }
        Insert: {
          an_qty?: number | null
          an_type?: string | null
          caisson?: number | null
          conduct?: number | null
          corr_ctg?: string | null
          cp_system?: string | null
          cr_date?: string | null
          cr_user?: string | null
          crane?: number | null
          cslot?: number | null
          def_unit?: string | null
          depth?: number | null
          desg_life?: number | null
          dleg?: number | null
          fender?: number | null
          helipad?: string | null
          inst_ctr?: string | null
          inst_date?: string | null
          leg_t1?: string | null
          leg_t10?: string | null
          leg_t11?: string | null
          leg_t12?: string | null
          leg_t13?: string | null
          leg_t14?: string | null
          leg_t15?: string | null
          leg_t16?: string | null
          leg_t17?: string | null
          leg_t18?: string | null
          leg_t19?: string | null
          leg_t2?: string | null
          leg_t20?: string | null
          leg_t3?: string | null
          leg_t4?: string | null
          leg_t5?: string | null
          leg_t6?: string | null
          leg_t7?: string | null
          leg_t8?: string | null
          leg_t9?: string | null
          manned?: string | null
          material?: string | null
          nleg_t1?: string | null
          nleg_t2?: string | null
          north_angle?: number | null
          north_side?: string | null
          pdesc?: string | null
          pfield?: string | null
          pileint?: number | null
          pileskt?: number | null
          plat_id?: number
          plegs?: number | null
          process?: string | null
          ptype?: string | null
          riser?: number | null
          sent?: string | null
          st_east?: string | null
          st_north?: string | null
          sump?: number | null
          title: string
          wall_thk?: number | null
          workunit?: string | null
        }
        Update: {
          an_qty?: number | null
          an_type?: string | null
          caisson?: number | null
          conduct?: number | null
          corr_ctg?: string | null
          cp_system?: string | null
          cr_date?: string | null
          cr_user?: string | null
          crane?: number | null
          cslot?: number | null
          def_unit?: string | null
          depth?: number | null
          desg_life?: number | null
          dleg?: number | null
          fender?: number | null
          helipad?: string | null
          inst_ctr?: string | null
          inst_date?: string | null
          leg_t1?: string | null
          leg_t10?: string | null
          leg_t11?: string | null
          leg_t12?: string | null
          leg_t13?: string | null
          leg_t14?: string | null
          leg_t15?: string | null
          leg_t16?: string | null
          leg_t17?: string | null
          leg_t18?: string | null
          leg_t19?: string | null
          leg_t2?: string | null
          leg_t20?: string | null
          leg_t3?: string | null
          leg_t4?: string | null
          leg_t5?: string | null
          leg_t6?: string | null
          leg_t7?: string | null
          leg_t8?: string | null
          leg_t9?: string | null
          manned?: string | null
          material?: string | null
          nleg_t1?: string | null
          nleg_t2?: string | null
          north_angle?: number | null
          north_side?: string | null
          pdesc?: string | null
          pfield?: string | null
          pileint?: number | null
          pileskt?: number | null
          plat_id?: number
          plegs?: number | null
          process?: string | null
          ptype?: string | null
          riser?: number | null
          sent?: string | null
          st_east?: string | null
          st_north?: string | null
          sump?: number | null
          title?: string
          wall_thk?: number | null
          workunit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_plat_id_fkey"
            columns: ["plat_id"]
            isOneToOne: true
            referencedRelation: "structure"
            referencedColumns: ["str_id"]
          },
          {
            foreignKeyName: "platform_plat_id_fkey"
            columns: ["plat_id"]
            isOneToOne: true
            referencedRelation: "v_smart_query_structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_plat_id_fkey"
            columns: ["plat_id"]
            isOneToOne: true
            referencedRelation: "v_structure_details"
            referencedColumns: ["str_id"]
          },
        ]
      }
      platform_3d_scenes: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          platform_id: string
          scene_data: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          platform_id: string
          scene_data?: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          platform_id?: string
          scene_data?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          designation: string | null
          email: string
          full_name: string | null
          id: string
          is_active: boolean
          last_sign_in: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          designation?: string | null
          email: string
          full_name?: string | null
          id: string
          is_active?: boolean
          last_sign_in?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          designation?: string | null
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          last_sign_in?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      report_aliases: {
        Row: {
          alias: string
          created_at: string
          id: number
          template_id: string
          updated_at: string
        }
        Insert: {
          alias: string
          created_at?: string
          id?: number
          template_id: string
          updated_at?: string
        }
        Update: {
          alias?: string
          created_at?: string
          id?: number
          template_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      report_templates: {
        Row: {
          created_at: string | null
          description: string | null
          id: number
          is_active: boolean | null
          is_default: boolean | null
          name: string
          storage_path: string
          type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: number
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          storage_path: string
          type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: number
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          storage_path?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      rov_data_acquisition_config: {
        Row: {
          config_id: number
          config_name: string
          connection_params: Json
          connection_type: string
          cr_date: string | null
          cr_user: string | null
          data_format: Json
          default_data_sources: Json | null
          field_mappings: Json
          is_active: boolean | null
          is_default: boolean | null
          md_date: string | null
          md_user: string | null
          parsing_method: string
          structure_type: string | null
          workunit: string | null
        }
        Insert: {
          config_id?: number
          config_name: string
          connection_params?: Json
          connection_type: string
          cr_date?: string | null
          cr_user?: string | null
          data_format?: Json
          default_data_sources?: Json | null
          field_mappings?: Json
          is_active?: boolean | null
          is_default?: boolean | null
          md_date?: string | null
          md_user?: string | null
          parsing_method: string
          structure_type?: string | null
          workunit?: string | null
        }
        Update: {
          config_id?: number
          config_name?: string
          connection_params?: Json
          connection_type?: string
          cr_date?: string | null
          cr_user?: string | null
          data_format?: Json
          default_data_sources?: Json | null
          field_mappings?: Json
          is_active?: boolean | null
          is_default?: boolean | null
          md_date?: string | null
          md_user?: string | null
          parsing_method?: string
          structure_type?: string | null
          workunit?: string | null
        }
        Relationships: []
      }
      rov_video_grab_config: {
        Row: {
          auto_grab_on_anomaly: boolean | null
          auto_grab_on_inspection: boolean | null
          config_id: number
          config_name: string
          cr_date: string | null
          cr_user: string | null
          enable_overlay: boolean | null
          grab_format: string | null
          grab_interval_seconds: number | null
          grab_quality: number | null
          is_active: boolean | null
          is_default: boolean | null
          md_date: string | null
          md_user: string | null
          overlay_template: Json | null
          resolution_height: number | null
          resolution_width: number | null
          storage_bucket: string | null
          storage_path_template: string | null
          video_source: string | null
          video_source_type: string | null
          workunit: string | null
        }
        Insert: {
          auto_grab_on_anomaly?: boolean | null
          auto_grab_on_inspection?: boolean | null
          config_id?: number
          config_name: string
          cr_date?: string | null
          cr_user?: string | null
          enable_overlay?: boolean | null
          grab_format?: string | null
          grab_interval_seconds?: number | null
          grab_quality?: number | null
          is_active?: boolean | null
          is_default?: boolean | null
          md_date?: string | null
          md_user?: string | null
          overlay_template?: Json | null
          resolution_height?: number | null
          resolution_width?: number | null
          storage_bucket?: string | null
          storage_path_template?: string | null
          video_source?: string | null
          video_source_type?: string | null
          workunit?: string | null
        }
        Update: {
          auto_grab_on_anomaly?: boolean | null
          auto_grab_on_inspection?: boolean | null
          config_id?: number
          config_name?: string
          cr_date?: string | null
          cr_user?: string | null
          enable_overlay?: boolean | null
          grab_format?: string | null
          grab_interval_seconds?: number | null
          grab_quality?: number | null
          is_active?: boolean | null
          is_default?: boolean | null
          md_date?: string | null
          md_user?: string | null
          overlay_template?: Json | null
          resolution_height?: number | null
          resolution_width?: number | null
          storage_bucket?: string | null
          storage_path_template?: string | null
          video_source?: string | null
          video_source_type?: string | null
          workunit?: string | null
        }
        Relationships: []
      }
      smart_queries: {
        Row: {
          config: Json
          created_at: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          config?: Json
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          config?: Json
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      str_elv: {
        Row: {
          cr_date: string | null
          cr_user: string | null
          elv: number
          orient: string | null
          plat_id: number
          workunit: string | null
        }
        Insert: {
          cr_date?: string | null
          cr_user?: string | null
          elv: number
          orient?: string | null
          plat_id: number
          workunit?: string | null
        }
        Update: {
          cr_date?: string | null
          cr_user?: string | null
          elv?: number
          orient?: string | null
          plat_id?: number
          workunit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_str_elv"
            columns: ["plat_id"]
            isOneToOne: false
            referencedRelation: "structure"
            referencedColumns: ["str_id"]
          },
          {
            foreignKeyName: "fk_str_elv"
            columns: ["plat_id"]
            isOneToOne: false
            referencedRelation: "v_smart_query_structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_str_elv"
            columns: ["plat_id"]
            isOneToOne: false
            referencedRelation: "v_structure_details"
            referencedColumns: ["str_id"]
          },
        ]
      }
      str_faces: {
        Row: {
          cr_date: string | null
          cr_user: string | null
          face: string
          face_desc: string | null
          face_from: string | null
          face_to: string | null
          plat_id: number
          workunit: string | null
        }
        Insert: {
          cr_date?: string | null
          cr_user?: string | null
          face: string
          face_desc?: string | null
          face_from?: string | null
          face_to?: string | null
          plat_id: number
          workunit?: string | null
        }
        Update: {
          cr_date?: string | null
          cr_user?: string | null
          face?: string
          face_desc?: string | null
          face_from?: string | null
          face_to?: string | null
          plat_id?: number
          workunit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_str_faces"
            columns: ["plat_id"]
            isOneToOne: false
            referencedRelation: "structure"
            referencedColumns: ["str_id"]
          },
          {
            foreignKeyName: "fk_str_faces"
            columns: ["plat_id"]
            isOneToOne: false
            referencedRelation: "v_smart_query_structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_str_faces"
            columns: ["plat_id"]
            isOneToOne: false
            referencedRelation: "v_structure_details"
            referencedColumns: ["str_id"]
          },
        ]
      }
      str_level: {
        Row: {
          cr_date: string | null
          cr_user: string | null
          elv_from: number | null
          elv_to: number | null
          level_name: string
          plat_id: number
          workunit: string | null
        }
        Insert: {
          cr_date?: string | null
          cr_user?: string | null
          elv_from?: number | null
          elv_to?: number | null
          level_name: string
          plat_id: number
          workunit?: string | null
        }
        Update: {
          cr_date?: string | null
          cr_user?: string | null
          elv_from?: number | null
          elv_to?: number | null
          level_name?: string
          plat_id?: number
          workunit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_str_level"
            columns: ["plat_id"]
            isOneToOne: false
            referencedRelation: "structure"
            referencedColumns: ["str_id"]
          },
          {
            foreignKeyName: "fk_str_level"
            columns: ["plat_id"]
            isOneToOne: false
            referencedRelation: "v_smart_query_structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_str_level"
            columns: ["plat_id"]
            isOneToOne: false
            referencedRelation: "v_structure_details"
            referencedColumns: ["str_id"]
          },
        ]
      }
      structure: {
        Row: {
          str_id: number
          str_type: string | null
        }
        Insert: {
          str_id: number
          str_type?: string | null
        }
        Update: {
          str_id?: number
          str_type?: string | null
        }
        Relationships: []
      }
      structure_components: {
        Row: {
          code: string | null
          comp_id: number
          created_at: string | null
          created_by: string | null
          id: number
          id_no: string
          is_deleted: boolean
          metadata: Json | null
          modified_by: string | null
          q_id: string
          structure_id: number
          updated_at: string | null
        }
        Insert: {
          code?: string | null
          comp_id: number
          created_at?: string | null
          created_by?: string | null
          id?: number
          id_no: string
          is_deleted?: boolean
          metadata?: Json | null
          modified_by?: string | null
          q_id: string
          structure_id: number
          updated_at?: string | null
        }
        Update: {
          code?: string | null
          comp_id?: number
          created_at?: string | null
          created_by?: string | null
          id?: number
          id_no?: string
          is_deleted?: boolean
          metadata?: Json | null
          modified_by?: string | null
          q_id?: string
          structure_id?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_structure_components_structure"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structure"
            referencedColumns: ["str_id"]
          },
          {
            foreignKeyName: "fk_structure_components_structure"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "v_smart_query_structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_structure_components_structure"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "v_structure_details"
            referencedColumns: ["str_id"]
          },
        ]
      }
      taskcomp: {
        Row: {
          closed_by: string | null
          closed_on: string | null
          comp_id: number
          inspno: string
          status: string
          str_id: number
          workunit: string | null
        }
        Insert: {
          closed_by?: string | null
          closed_on?: string | null
          comp_id: number
          inspno: string
          status: string
          str_id: number
          workunit?: string | null
        }
        Update: {
          closed_by?: string | null
          closed_on?: string | null
          comp_id?: number
          inspno?: string
          status?: string
          str_id?: number
          workunit?: string | null
        }
        Relationships: []
      }
      taskinsp: {
        Row: {
          closed_by: string | null
          closed_on: string | null
          comp_id: number
          compcode: string
          insp_prog: string | null
          inspcode: string
          inspno: string
          plantype: string | null
          status: string | null
          str_id: number
          subsea: number
          topside: number
          workunit: string | null
        }
        Insert: {
          closed_by?: string | null
          closed_on?: string | null
          comp_id: number
          compcode: string
          insp_prog?: string | null
          inspcode: string
          inspno: string
          plantype?: string | null
          status?: string | null
          str_id: number
          subsea: number
          topside: number
          workunit?: string | null
        }
        Update: {
          closed_by?: string | null
          closed_on?: string | null
          comp_id?: number
          compcode?: string
          insp_prog?: string | null
          inspcode?: string
          inspno?: string
          plantype?: string | null
          status?: string | null
          str_id?: number
          subsea?: number
          topside?: number
          workunit?: string | null
        }
        Relationships: []
      }
      taskstr: {
        Row: {
          closed_by: string | null
          closed_on: string | null
          cr_date: string | null
          cr_user: string | null
          inspno: string
          job_type: string | null
          status: string | null
          str_id: number
          workunit: string | null
        }
        Insert: {
          closed_by?: string | null
          closed_on?: string | null
          cr_date?: string | null
          cr_user?: string | null
          inspno: string
          job_type?: string | null
          status?: string | null
          str_id: number
          workunit?: string | null
        }
        Update: {
          closed_by?: string | null
          closed_on?: string | null
          cr_date?: string | null
          cr_user?: string | null
          inspno?: string
          job_type?: string | null
          status?: string | null
          str_id?: number
          workunit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_taskstr"
            columns: ["str_id"]
            isOneToOne: false
            referencedRelation: "structure"
            referencedColumns: ["str_id"]
          },
          {
            foreignKeyName: "fk_taskstr"
            columns: ["str_id"]
            isOneToOne: false
            referencedRelation: "v_smart_query_structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_taskstr"
            columns: ["str_id"]
            isOneToOne: false
            referencedRelation: "v_structure_details"
            referencedColumns: ["str_id"]
          },
        ]
      }
      type: {
        Row: {
          created_at: string
          created_by: string | null
          id: number
          modified_by: string | null
          module_category: number | null
          name: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: number
          modified_by?: string | null
          module_category?: number | null
          name?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: number
          modified_by?: string | null
          module_category?: number | null
          name?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "type_module_category_fkey"
            columns: ["module_category"]
            isOneToOne: false
            referencedRelation: "module_category"
            referencedColumns: ["id"]
          },
        ]
      }
      u_executive_summaries: {
        Row: {
          created_at: string | null
          id: number
          jobpack_id: number
          metadata: Json | null
          sections: Json | null
          sow_report_no: string
          structure_id: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          jobpack_id: number
          metadata?: Json | null
          sections?: Json | null
          sow_report_no: string
          structure_id: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          jobpack_id?: number
          metadata?: Json | null
          sections?: Json | null
          sow_report_no?: string
          structure_id?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      u_lib_combo: {
        Row: {
          code_1: string
          code_2: string
          cr_date: string | null
          cr_user: string | null
          hidden_item: string
          lib_code: string
          lib_com: string | null
          lib_delete: number | null
          workunit: string | null
        }
        Insert: {
          code_1: string
          code_2: string
          cr_date?: string | null
          cr_user?: string | null
          hidden_item?: string
          lib_code: string
          lib_com?: string | null
          lib_delete?: number | null
          workunit?: string | null
        }
        Update: {
          code_1?: string
          code_2?: string
          cr_date?: string | null
          cr_user?: string | null
          hidden_item?: string
          lib_code?: string
          lib_com?: string | null
          lib_delete?: number | null
          workunit?: string | null
        }
        Relationships: []
      }
      u_lib_list: {
        Row: {
          cr_date: string | null
          cr_user: string | null
          hidden_item: string | null
          lib_code: string
          lib_com: string | null
          lib_delete: number | null
          lib_desc: string | null
          lib_id: string
          logo_url: string | null
          workunit: string | null
        }
        Insert: {
          cr_date?: string | null
          cr_user?: string | null
          hidden_item?: string | null
          lib_code: string
          lib_com?: string | null
          lib_delete?: number | null
          lib_desc?: string | null
          lib_id: string
          logo_url?: string | null
          workunit?: string | null
        }
        Update: {
          cr_date?: string | null
          cr_user?: string | null
          hidden_item?: string | null
          lib_code?: string
          lib_com?: string | null
          lib_delete?: number | null
          lib_desc?: string | null
          lib_id?: string
          logo_url?: string | null
          workunit?: string | null
        }
        Relationships: []
      }
      u_lib_mast: {
        Row: {
          comment: string | null
          hidden_item: string
          lib_code: string
          lib_name: string
        }
        Insert: {
          comment?: string | null
          hidden_item?: string
          lib_code: string
          lib_name: string
        }
        Update: {
          comment?: string | null
          hidden_item?: string
          lib_code?: string
          lib_name?: string
        }
        Relationships: []
      }
      u_pipeline: {
        Row: {
          an_qty: number | null
          an_type: string | null
          burial: number | null
          conc_ctg: string | null
          conc_ctg_per: number | null
          corr_ctg: string | null
          cp_system: string | null
          cr_date: string | null
          cr_user: string | null
          def_unit: string | null
          depth: number | null
          desg_life: number | null
          desg_press: number | null
          end_fp: number | null
          end_loc: string | null
          end_x: string | null
          end_y: string | null
          fp_tolerance: number | null
          inst_ctr: string | null
          inst_date: string | null
          line_diam: number | null
          material: string | null
          oper_press: number | null
          pdesc: string | null
          pfield: string | null
          pipe_id: number
          plength: number | null
          process: string | null
          ptype: string | null
          ra_qty: number | null
          ra_type: string | null
          sent: string | null
          span_cons: number | null
          span_oper: number | null
          st_fp: number | null
          st_loc: string | null
          st_x: string | null
          st_y: string | null
          title: string
          wall_thk: number | null
          workunit: string | null
        }
        Insert: {
          an_qty?: number | null
          an_type?: string | null
          burial?: number | null
          conc_ctg?: string | null
          conc_ctg_per?: number | null
          corr_ctg?: string | null
          cp_system?: string | null
          cr_date?: string | null
          cr_user?: string | null
          def_unit?: string | null
          depth?: number | null
          desg_life?: number | null
          desg_press?: number | null
          end_fp?: number | null
          end_loc?: string | null
          end_x?: string | null
          end_y?: string | null
          fp_tolerance?: number | null
          inst_ctr?: string | null
          inst_date?: string | null
          line_diam?: number | null
          material?: string | null
          oper_press?: number | null
          pdesc?: string | null
          pfield?: string | null
          pipe_id?: number
          plength?: number | null
          process?: string | null
          ptype?: string | null
          ra_qty?: number | null
          ra_type?: string | null
          sent?: string | null
          span_cons?: number | null
          span_oper?: number | null
          st_fp?: number | null
          st_loc?: string | null
          st_x?: string | null
          st_y?: string | null
          title: string
          wall_thk?: number | null
          workunit?: string | null
        }
        Update: {
          an_qty?: number | null
          an_type?: string | null
          burial?: number | null
          conc_ctg?: string | null
          conc_ctg_per?: number | null
          corr_ctg?: string | null
          cp_system?: string | null
          cr_date?: string | null
          cr_user?: string | null
          def_unit?: string | null
          depth?: number | null
          desg_life?: number | null
          desg_press?: number | null
          end_fp?: number | null
          end_loc?: string | null
          end_x?: string | null
          end_y?: string | null
          fp_tolerance?: number | null
          inst_ctr?: string | null
          inst_date?: string | null
          line_diam?: number | null
          material?: string | null
          oper_press?: number | null
          pdesc?: string | null
          pfield?: string | null
          pipe_id?: number
          plength?: number | null
          process?: string | null
          ptype?: string | null
          ra_qty?: number | null
          ra_type?: string | null
          sent?: string | null
          span_cons?: number | null
          span_oper?: number | null
          st_fp?: number | null
          st_loc?: string | null
          st_x?: string | null
          st_y?: string | null
          title?: string
          wall_thk?: number | null
          workunit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "u_pipeline_pipe_id_fkey"
            columns: ["pipe_id"]
            isOneToOne: true
            referencedRelation: "structure"
            referencedColumns: ["str_id"]
          },
          {
            foreignKeyName: "u_pipeline_pipe_id_fkey"
            columns: ["pipe_id"]
            isOneToOne: true
            referencedRelation: "v_smart_query_structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "u_pipeline_pipe_id_fkey"
            columns: ["pipe_id"]
            isOneToOne: true
            referencedRelation: "v_structure_details"
            referencedColumns: ["str_id"]
          },
        ]
      }
      u_sow: {
        Row: {
          completed_items: number | null
          created_at: string | null
          created_by: string | null
          id: number
          incomplete_items: number | null
          jobpack_id: number
          metadata: Json | null
          pending_items: number | null
          report_numbers: Json | null
          structure_id: number
          structure_title: string | null
          structure_type: string
          total_items: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          completed_items?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: number
          incomplete_items?: number | null
          jobpack_id: number
          metadata?: Json | null
          pending_items?: number | null
          report_numbers?: Json | null
          structure_id: number
          structure_title?: string | null
          structure_type: string
          total_items?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          completed_items?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: number
          incomplete_items?: number | null
          jobpack_id?: number
          metadata?: Json | null
          pending_items?: number | null
          report_numbers?: Json | null
          structure_id?: number
          structure_title?: string | null
          structure_type?: string
          total_items?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_u_sow_structure"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structure"
            referencedColumns: ["str_id"]
          },
          {
            foreignKeyName: "fk_u_sow_structure"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "v_smart_query_structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_u_sow_structure"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "v_structure_details"
            referencedColumns: ["str_id"]
          },
        ]
      }
      u_sow_items: {
        Row: {
          component_id: number
          component_qid: string | null
          component_type: string | null
          created_at: string | null
          created_by: string | null
          elevation_data: Json | null
          elevation_required: boolean | null
          id: number
          inspection_code: string | null
          inspection_count: number | null
          inspection_name: string | null
          inspection_type_id: number
          last_inspection_date: string | null
          notes: string | null
          report_number: string | null
          sow_id: number
          status: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          component_id: number
          component_qid?: string | null
          component_type?: string | null
          created_at?: string | null
          created_by?: string | null
          elevation_data?: Json | null
          elevation_required?: boolean | null
          id?: number
          inspection_code?: string | null
          inspection_count?: number | null
          inspection_name?: string | null
          inspection_type_id: number
          last_inspection_date?: string | null
          notes?: string | null
          report_number?: string | null
          sow_id: number
          status?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          component_id?: number
          component_qid?: string | null
          component_type?: string | null
          created_at?: string | null
          created_by?: string | null
          elevation_data?: Json | null
          elevation_required?: boolean | null
          id?: number
          inspection_code?: string | null
          inspection_count?: number | null
          inspection_name?: string | null
          inspection_type_id?: number
          last_inspection_date?: string | null
          notes?: string | null
          report_number?: string | null
          sow_id?: number
          status?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "u_sow_items_inspection_type_id_fkey"
            columns: ["inspection_type_id"]
            isOneToOne: false
            referencedRelation: "inspection_type"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "u_sow_items_sow_id_fkey"
            columns: ["sow_id"]
            isOneToOne: false
            referencedRelation: "u_sow"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "u_sow_items_sow_id_fkey"
            columns: ["sow_id"]
            isOneToOne: false
            referencedRelation: "v_smart_query_sow"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: number
          last_seen_at: string | null
          modules: Json | null
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          last_seen_at?: string | null
          modules?: Json | null
          role?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: number
          last_seen_at?: string | null
          modules?: Json | null
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      workpl: {
        Row: {
          closed_by: string | null
          closed_on: string | null
          comprep: string | null
          contrac: string | null
          contrac_logo: string | null
          contract_ref: string | null
          contractor_ref: string | null
          cr_date: string | null
          cr_user: string | null
          cursrc: string | null
          divetyp: string | null
          from_date: string | null
          idesc: string | null
          iend: string | null
          inspno: string
          istart: string | null
          jobname: string | null
          plantype: string | null
          site_hrs: number | null
          status: string | null
          subsea: number
          tasktype: string | null
          to_date: string | null
          topside: number
          vessel: string | null
          workunit: string | null
        }
        Insert: {
          closed_by?: string | null
          closed_on?: string | null
          comprep?: string | null
          contrac?: string | null
          contrac_logo?: string | null
          contract_ref?: string | null
          contractor_ref?: string | null
          cr_date?: string | null
          cr_user?: string | null
          cursrc?: string | null
          divetyp?: string | null
          from_date?: string | null
          idesc?: string | null
          iend?: string | null
          inspno: string
          istart?: string | null
          jobname?: string | null
          plantype?: string | null
          site_hrs?: number | null
          status?: string | null
          subsea: number
          tasktype?: string | null
          to_date?: string | null
          topside: number
          vessel?: string | null
          workunit?: string | null
        }
        Update: {
          closed_by?: string | null
          closed_on?: string | null
          comprep?: string | null
          contrac?: string | null
          contrac_logo?: string | null
          contract_ref?: string | null
          contractor_ref?: string | null
          cr_date?: string | null
          cr_user?: string | null
          cursrc?: string | null
          divetyp?: string | null
          from_date?: string | null
          idesc?: string | null
          iend?: string | null
          inspno?: string
          istart?: string | null
          jobname?: string | null
          plantype?: string | null
          site_hrs?: number | null
          status?: string | null
          subsea?: number
          tasktype?: string | null
          to_date?: string | null
          topside?: number
          vessel?: string | null
          workunit?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      v_anomaly_details: {
        Row: {
          action_priority: string | null
          anomaly_id: number | null
          anomaly_status: string | null
          category: string | null
          component_id: number | null
          component_qid: string | null
          component_type: string | null
          contractor_id: string | null
          contractor_name: string | null
          contractor_ref: string | null
          defect_type: string | null
          deployment_no: string | null
          description: string | null
          display_ref_no: string | null
          dive_job_id: number | null
          dive_no: string | null
          dive_start: string | null
          diver_name: string | null
          elevation: number | null
          field_name: string | null
          fp_kp: string | null
          has_anomaly: boolean | null
          id: number | null
          inspection_date: string | null
          jobpack_id: number | null
          jobpack_name: string | null
          logo_url: string | null
          main_vessel: string | null
          observations: string | null
          priority: string | null
          priority_color: string | null
          recommended_action: string | null
          rectified: boolean | null
          rectified_by: string | null
          rectified_date: string | null
          rectified_remarks: string | null
          rov_job_id: number | null
          rov_machine: string | null
          rov_name: string | null
          rov_start: string | null
          sow_report_no: string | null
          status: string | null
          str_type: string | null
          structure_id: number | null
          structure_name: string | null
          tape_id: number | null
          tape_no: string | null
          video_ref: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insp_records_tape_id_fkey"
            columns: ["tape_id"]
            isOneToOne: false
            referencedRelation: "insp_video_tapes"
            referencedColumns: ["tape_id"]
          },
        ]
      }
      v_defect_types_by_code: {
        Row: {
          defect_code_id: string | null
          lib_code: string | null
          lib_desc: string | null
          lib_id: string | null
        }
        Relationships: []
      }
      v_smart_query_anomalies: {
        Row: {
          action_deadline: string | null
          action_priority: string | null
          amended_by: string | null
          amended_date: string | null
          amended_remarks: string | null
          anomaly_id: number | null
          anomaly_ref_no: string | null
          approved_by: string | null
          approved_date: string | null
          closed_by: string | null
          closed_date: string | null
          component_description: string | null
          component_id_no: string | null
          component_id_str: number | null
          component_qid: string | null
          cr_date: string | null
          cr_user: string | null
          defect_category_code: string | null
          defect_description: string | null
          defect_type_code: string | null
          disc_date: string | null
          disc_type: string | null
          elevation1: string | null
          elevation2: string | null
          end_node: string | null
          follow_up_notes: string | null
          follow_up_required: boolean | null
          inspection_id: number | null
          is_amended: boolean | null
          is_rectified: boolean | null
          jobpack_name: string | null
          md_date: string | null
          md_user: string | null
          priority_code: string | null
          recommended_action: string | null
          record_category: string | null
          rectified_by: string | null
          rectified_date: string | null
          rectified_remarks: string | null
          reviewed_by: string | null
          reviewed_date: string | null
          sequence_no: number | null
          severity: string | null
          start_node: string | null
          status: string | null
          structure_field: string | null
          structure_name: string | null
          structure_spec_type: string | null
          workunit: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insp_anomalies_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "insp_records"
            referencedColumns: ["insp_id"]
          },
          {
            foreignKeyName: "insp_anomalies_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "v_anomaly_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insp_anomalies_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "v_smart_query_incomplete"
            referencedColumns: ["insp_id"]
          },
          {
            foreignKeyName: "insp_anomalies_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "v_smart_query_inspection_records"
            referencedColumns: ["insp_id"]
          },
          {
            foreignKeyName: "insp_anomalies_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "vw_anomalies_detail"
            referencedColumns: ["insp_id"]
          },
          {
            foreignKeyName: "insp_anomalies_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "vw_dive_inspections"
            referencedColumns: ["insp_id"]
          },
          {
            foreignKeyName: "insp_anomalies_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "vw_rov_inspections"
            referencedColumns: ["insp_id"]
          },
        ]
      }
      v_smart_query_components: {
        Row: {
          anode_type: string | null
          code: string | null
          comp_id: number | null
          created_at: string | null
          created_by: string | null
          description: string | null
          elevation1: string | null
          elevation2: string | null
          end_node: string | null
          face: string | null
          id: number | null
          id_no: string | null
          is_deleted: boolean | null
          level: string | null
          material: string | null
          metadata: Json | null
          modified_by: string | null
          position: string | null
          q_id: string | null
          start_node: string | null
          structural_group: string | null
          structure_base_type: string | null
          structure_field: string | null
          structure_id: number | null
          structure_name: string | null
          structure_spec_type: string | null
          updated_at: string | null
          weight: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_structure_components_structure"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structure"
            referencedColumns: ["str_id"]
          },
          {
            foreignKeyName: "fk_structure_components_structure"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "v_smart_query_structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_structure_components_structure"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "v_structure_details"
            referencedColumns: ["str_id"]
          },
        ]
      }
      v_smart_query_findings: {
        Row: {
          action_deadline: string | null
          action_priority: string | null
          amended_by: string | null
          amended_date: string | null
          amended_remarks: string | null
          anomaly_id: number | null
          anomaly_ref_no: string | null
          approved_by: string | null
          approved_date: string | null
          closed_by: string | null
          closed_date: string | null
          component_description: string | null
          component_id_no: string | null
          component_id_str: number | null
          component_qid: string | null
          cr_date: string | null
          cr_user: string | null
          defect_category_code: string | null
          defect_description: string | null
          defect_type_code: string | null
          disc_date: string | null
          disc_type: string | null
          elevation1: string | null
          elevation2: string | null
          end_node: string | null
          follow_up_notes: string | null
          follow_up_required: boolean | null
          inspection_id: number | null
          is_amended: boolean | null
          is_rectified: boolean | null
          jobpack_name: string | null
          md_date: string | null
          md_user: string | null
          priority_code: string | null
          recommended_action: string | null
          record_category: string | null
          rectified_by: string | null
          rectified_date: string | null
          rectified_remarks: string | null
          reviewed_by: string | null
          reviewed_date: string | null
          sequence_no: number | null
          severity: string | null
          start_node: string | null
          status: string | null
          structure_field: string | null
          structure_name: string | null
          structure_spec_type: string | null
          workunit: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insp_anomalies_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "insp_records"
            referencedColumns: ["insp_id"]
          },
          {
            foreignKeyName: "insp_anomalies_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "v_anomaly_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insp_anomalies_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "v_smart_query_incomplete"
            referencedColumns: ["insp_id"]
          },
          {
            foreignKeyName: "insp_anomalies_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "v_smart_query_inspection_records"
            referencedColumns: ["insp_id"]
          },
          {
            foreignKeyName: "insp_anomalies_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "vw_anomalies_detail"
            referencedColumns: ["insp_id"]
          },
          {
            foreignKeyName: "insp_anomalies_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "vw_dive_inspections"
            referencedColumns: ["insp_id"]
          },
          {
            foreignKeyName: "insp_anomalies_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "vw_rov_inspections"
            referencedColumns: ["insp_id"]
          },
        ]
      }
      v_smart_query_incomplete: {
        Row: {
          anode_depletion: string | null
          anode_type: string | null
          approved_by: string | null
          approved_date: string | null
          archived_data: Json | null
          calib_block: string | null
          calib_equipment_type: string | null
          coating_condition: string | null
          component_condition: string | null
          component_description: string | null
          component_id: number | null
          component_id_no: string | null
          component_id_str: number | null
          component_qid: string | null
          component_type: string | null
          cp_reading: string | null
          cr_date: string | null
          cr_user: string | null
          debris_info: string | null
          description: string | null
          distance_info: string | null
          dive_job_id: number | null
          elevation: number | null
          elevation1: string | null
          elevation2: string | null
          end_node: string | null
          finding_type: string | null
          fp_kp: string | null
          has_anomaly: boolean | null
          incomplete_reason: string | null
          insp_id: number | null
          inspection_data: Json | null
          inspection_date: string | null
          inspection_time: string | null
          inspection_type_code: string | null
          inspection_type_id: number | null
          jobpack_id: number | null
          jobpack_name: string | null
          marine_growth: string | null
          md_date: string | null
          md_user: string | null
          mgi_hard_thickness: string | null
          mgi_profile: string | null
          mgi_soft_thickness: string | null
          mgi_thickness_at: string | null
          nominal_thickness: string | null
          post_dive_cp_rdg: string | null
          pre_dive_cp_rdg: string | null
          reviewed_by: string | null
          reviewed_date: string | null
          rov_data_snapshot: Json | null
          rov_data_timestamp: string | null
          rov_job_id: number | null
          scour_depth: string | null
          scour_location: string | null
          seepage_intensity: string | null
          serial_number: string | null
          sow_report_no: string | null
          start_node: string | null
          status: string | null
          structure_field: string | null
          structure_id: number | null
          structure_name: string | null
          structure_spec_type: string | null
          tape_count_no: string | null
          tape_id: number | null
          ut_12_o_clock: string | null
          ut_3_o_clock: string | null
          ut_6_o_clock: string | null
          ut_9_o_clock: string | null
          verification_depth: string | null
          video_frame_grabbed: boolean | null
          video_frame_media_id: number | null
          workunit: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_insp_records_structure"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structure"
            referencedColumns: ["str_id"]
          },
          {
            foreignKeyName: "fk_insp_records_structure"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "v_smart_query_structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_insp_records_structure"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "v_structure_details"
            referencedColumns: ["str_id"]
          },
          {
            foreignKeyName: "insp_records_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "structure_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insp_records_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "v_anomaly_details"
            referencedColumns: ["component_id"]
          },
          {
            foreignKeyName: "insp_records_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "v_smart_query_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insp_records_dive_job_id_fkey"
            columns: ["dive_job_id"]
            isOneToOne: false
            referencedRelation: "insp_dive_jobs"
            referencedColumns: ["dive_job_id"]
          },
          {
            foreignKeyName: "insp_records_dive_job_id_fkey"
            columns: ["dive_job_id"]
            isOneToOne: false
            referencedRelation: "v_anomaly_details"
            referencedColumns: ["dive_job_id"]
          },
          {
            foreignKeyName: "insp_records_inspection_type_id_fkey"
            columns: ["inspection_type_id"]
            isOneToOne: false
            referencedRelation: "inspection_type"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insp_records_jobpack_id_fkey"
            columns: ["jobpack_id"]
            isOneToOne: false
            referencedRelation: "jobpack"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insp_records_jobpack_id_fkey"
            columns: ["jobpack_id"]
            isOneToOne: false
            referencedRelation: "v_smart_query_jobpacks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insp_records_rov_job_id_fkey"
            columns: ["rov_job_id"]
            isOneToOne: false
            referencedRelation: "insp_rov_jobs"
            referencedColumns: ["rov_job_id"]
          },
          {
            foreignKeyName: "insp_records_rov_job_id_fkey"
            columns: ["rov_job_id"]
            isOneToOne: false
            referencedRelation: "v_anomaly_details"
            referencedColumns: ["rov_job_id"]
          },
          {
            foreignKeyName: "insp_records_rov_job_id_fkey"
            columns: ["rov_job_id"]
            isOneToOne: false
            referencedRelation: "vw_rov_inspections_with_settings"
            referencedColumns: ["rov_job_id"]
          },
          {
            foreignKeyName: "insp_records_tape_id_fkey"
            columns: ["tape_id"]
            isOneToOne: false
            referencedRelation: "insp_video_tapes"
            referencedColumns: ["tape_id"]
          },
          {
            foreignKeyName: "insp_records_video_frame_media_id_fkey"
            columns: ["video_frame_media_id"]
            isOneToOne: false
            referencedRelation: "insp_media"
            referencedColumns: ["media_id"]
          },
        ]
      }
      v_smart_query_inspection_records: {
        Row: {
          anode_depletion: string | null
          anode_type: string | null
          approved_by: string | null
          approved_date: string | null
          archived_data: Json | null
          calib_block: string | null
          calib_equipment_type: string | null
          coating_condition: string | null
          component_condition: string | null
          component_description: string | null
          component_id: number | null
          component_id_no: string | null
          component_id_str: number | null
          component_qid: string | null
          component_type: string | null
          cp_reading: string | null
          cr_date: string | null
          cr_user: string | null
          debris_info: string | null
          description: string | null
          distance_info: string | null
          dive_job_id: number | null
          elevation: number | null
          elevation1: string | null
          elevation2: string | null
          end_node: string | null
          finding_type: string | null
          fp_kp: string | null
          has_anomaly: boolean | null
          incomplete_reason: string | null
          insp_id: number | null
          inspection_data: Json | null
          inspection_date: string | null
          inspection_time: string | null
          inspection_type_code: string | null
          inspection_type_id: number | null
          jobpack_id: number | null
          jobpack_name: string | null
          marine_growth: string | null
          md_date: string | null
          md_user: string | null
          mgi_hard_thickness: string | null
          mgi_profile: string | null
          mgi_soft_thickness: string | null
          mgi_thickness_at: string | null
          nominal_thickness: string | null
          post_dive_cp_rdg: string | null
          pre_dive_cp_rdg: string | null
          reviewed_by: string | null
          reviewed_date: string | null
          rov_data_snapshot: Json | null
          rov_data_timestamp: string | null
          rov_job_id: number | null
          scour_depth: string | null
          scour_location: string | null
          seepage_intensity: string | null
          serial_number: string | null
          sow_report_no: string | null
          start_node: string | null
          status: string | null
          structure_field: string | null
          structure_id: number | null
          structure_name: string | null
          structure_spec_type: string | null
          tape_count_no: string | null
          tape_id: number | null
          ut_12_o_clock: string | null
          ut_3_o_clock: string | null
          ut_6_o_clock: string | null
          ut_9_o_clock: string | null
          verification_depth: string | null
          video_frame_grabbed: boolean | null
          video_frame_media_id: number | null
          workunit: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_insp_records_structure"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structure"
            referencedColumns: ["str_id"]
          },
          {
            foreignKeyName: "fk_insp_records_structure"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "v_smart_query_structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_insp_records_structure"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "v_structure_details"
            referencedColumns: ["str_id"]
          },
          {
            foreignKeyName: "insp_records_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "structure_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insp_records_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "v_anomaly_details"
            referencedColumns: ["component_id"]
          },
          {
            foreignKeyName: "insp_records_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "v_smart_query_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insp_records_dive_job_id_fkey"
            columns: ["dive_job_id"]
            isOneToOne: false
            referencedRelation: "insp_dive_jobs"
            referencedColumns: ["dive_job_id"]
          },
          {
            foreignKeyName: "insp_records_dive_job_id_fkey"
            columns: ["dive_job_id"]
            isOneToOne: false
            referencedRelation: "v_anomaly_details"
            referencedColumns: ["dive_job_id"]
          },
          {
            foreignKeyName: "insp_records_inspection_type_id_fkey"
            columns: ["inspection_type_id"]
            isOneToOne: false
            referencedRelation: "inspection_type"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insp_records_jobpack_id_fkey"
            columns: ["jobpack_id"]
            isOneToOne: false
            referencedRelation: "jobpack"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insp_records_jobpack_id_fkey"
            columns: ["jobpack_id"]
            isOneToOne: false
            referencedRelation: "v_smart_query_jobpacks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insp_records_rov_job_id_fkey"
            columns: ["rov_job_id"]
            isOneToOne: false
            referencedRelation: "insp_rov_jobs"
            referencedColumns: ["rov_job_id"]
          },
          {
            foreignKeyName: "insp_records_rov_job_id_fkey"
            columns: ["rov_job_id"]
            isOneToOne: false
            referencedRelation: "v_anomaly_details"
            referencedColumns: ["rov_job_id"]
          },
          {
            foreignKeyName: "insp_records_rov_job_id_fkey"
            columns: ["rov_job_id"]
            isOneToOne: false
            referencedRelation: "vw_rov_inspections_with_settings"
            referencedColumns: ["rov_job_id"]
          },
          {
            foreignKeyName: "insp_records_tape_id_fkey"
            columns: ["tape_id"]
            isOneToOne: false
            referencedRelation: "insp_video_tapes"
            referencedColumns: ["tape_id"]
          },
          {
            foreignKeyName: "insp_records_video_frame_media_id_fkey"
            columns: ["video_frame_media_id"]
            isOneToOne: false
            referencedRelation: "insp_media"
            referencedColumns: ["media_id"]
          },
        ]
      }
      v_smart_query_jobpacks: {
        Row: {
          contractor: string | null
          created_at: string | null
          created_by: string | null
          end_date: string | null
          id: number | null
          metadata: Json | null
          mgi_profile_id: number | null
          modified_by: string | null
          name: string | null
          plan_type: string | null
          start_date: string | null
          status: string | null
          structure_names: string | null
          task_type: string | null
          updated_at: string | null
          vessel: string | null
          work_unit: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobpack_mgi_profile_id_fkey"
            columns: ["mgi_profile_id"]
            isOneToOne: false
            referencedRelation: "mgi_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v_smart_query_sow: {
        Row: {
          completed_items: number | null
          created_at: string | null
          created_by: string | null
          id: number | null
          incomplete_items: number | null
          jobpack_id: number | null
          jobpack_name_alt: string | null
          metadata: Json | null
          pending_items: number | null
          report_numbers: Json | null
          structure_field_alt: string | null
          structure_id: number | null
          structure_name_alt: string | null
          structure_spec_type: string | null
          structure_title: string | null
          structure_type: string | null
          total_items: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_u_sow_structure"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structure"
            referencedColumns: ["str_id"]
          },
          {
            foreignKeyName: "fk_u_sow_structure"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "v_smart_query_structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_u_sow_structure"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "v_structure_details"
            referencedColumns: ["str_id"]
          },
        ]
      }
      v_smart_query_structures: {
        Row: {
          an_qty: number | null
          an_type: string | null
          caisson: number | null
          conduct: number | null
          corr_ctg: string | null
          cp_system: string | null
          cr_date: string | null
          cr_user: string | null
          crane: number | null
          cslot: number | null
          def_unit: string | null
          depth: number | null
          desg_life: number | null
          desg_press: number | null
          dleg: number | null
          end_loc: string | null
          end_x: string | null
          end_y: string | null
          helipad: string | null
          id: number | null
          inst_ctr: string | null
          inst_date: string | null
          line_diam: number | null
          manned: string | null
          material: string | null
          oper_press: number | null
          pdesc: string | null
          pfield: string | null
          plegs: number | null
          plength: number | null
          process: string | null
          ptype: string | null
          riser: number | null
          st_loc: string | null
          st_x: string | null
          st_y: string | null
          str_type: string | null
          title: string | null
          wall_thk: number | null
        }
        Relationships: []
      }
      v_structure_details: {
        Row: {
          def_unit: string | null
          pdesc: string | null
          pfield: string | null
          str_id: number | null
          str_type: string | null
          title: string | null
        }
        Relationships: []
      }
      vw_ai_analysis_results: {
        Row: {
          ai_accuracy: string | null
          ai_provider: string | null
          analysis_id: number | null
          analysis_status: string | null
          analyzed_at: string | null
          anomaly_confidence: number | null
          anomaly_detected: boolean | null
          api_cost_usd: number | null
          captured_at: string | null
          component_type: string | null
          file_name: string | null
          file_path: string | null
          inspection_id: number | null
          inspection_type_code: string | null
          inspno: string | null
          media_id: number | null
          model_version: string | null
          overall_confidence: number | null
          processing_time_ms: number | null
          reviewed_by_human: boolean | null
          suggested_overall_condition: string | null
          suggested_remarks: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insp_ai_image_analysis_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "insp_records"
            referencedColumns: ["insp_id"]
          },
          {
            foreignKeyName: "insp_ai_image_analysis_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "v_anomaly_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insp_ai_image_analysis_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "v_smart_query_incomplete"
            referencedColumns: ["insp_id"]
          },
          {
            foreignKeyName: "insp_ai_image_analysis_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "v_smart_query_inspection_records"
            referencedColumns: ["insp_id"]
          },
          {
            foreignKeyName: "insp_ai_image_analysis_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "vw_anomalies_detail"
            referencedColumns: ["insp_id"]
          },
          {
            foreignKeyName: "insp_ai_image_analysis_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "vw_dive_inspections"
            referencedColumns: ["insp_id"]
          },
          {
            foreignKeyName: "insp_ai_image_analysis_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "vw_rov_inspections"
            referencedColumns: ["insp_id"]
          },
          {
            foreignKeyName: "insp_ai_image_analysis_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "insp_media"
            referencedColumns: ["media_id"]
          },
        ]
      }
      vw_ai_queue_status: {
        Row: {
          completed_at: string | null
          current_retry: number | null
          file_name: string | null
          inspection_id: number | null
          inspno: string | null
          last_error: string | null
          max_retries: number | null
          media_id: number | null
          priority: number | null
          queue_id: number | null
          queue_status: string | null
          queued_at: string | null
          started_at: string | null
          wait_time_seconds: number | null
        }
        Relationships: [
          {
            foreignKeyName: "insp_ai_analysis_queue_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "insp_records"
            referencedColumns: ["insp_id"]
          },
          {
            foreignKeyName: "insp_ai_analysis_queue_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "v_anomaly_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insp_ai_analysis_queue_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "v_smart_query_incomplete"
            referencedColumns: ["insp_id"]
          },
          {
            foreignKeyName: "insp_ai_analysis_queue_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "v_smart_query_inspection_records"
            referencedColumns: ["insp_id"]
          },
          {
            foreignKeyName: "insp_ai_analysis_queue_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "vw_anomalies_detail"
            referencedColumns: ["insp_id"]
          },
          {
            foreignKeyName: "insp_ai_analysis_queue_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "vw_dive_inspections"
            referencedColumns: ["insp_id"]
          },
          {
            foreignKeyName: "insp_ai_analysis_queue_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "vw_rov_inspections"
            referencedColumns: ["insp_id"]
          },
          {
            foreignKeyName: "insp_ai_analysis_queue_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "insp_media"
            referencedColumns: ["media_id"]
          },
        ]
      }
      vw_anomalies_detail: {
        Row: {
          action_deadline: string | null
          action_priority: string | null
          anomaly_id: number | null
          anomaly_ref_no: string | null
          anomaly_status: string | null
          cr_date: string | null
          cr_user: string | null
          defect_category_code: string | null
          defect_description: string | null
          defect_type_code: string | null
          insp_id: number | null
          inspection_date: string | null
          inspection_type_code: string | null
          inspno: string | null
          priority_code: string | null
          q_id: string | null
          recommended_action: string | null
          reviewed_by: string | null
          reviewed_date: string | null
          severity: string | null
          structure_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_structure_components_structure"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structure"
            referencedColumns: ["str_id"]
          },
          {
            foreignKeyName: "fk_structure_components_structure"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "v_smart_query_structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_structure_components_structure"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "v_structure_details"
            referencedColumns: ["str_id"]
          },
        ]
      }
      vw_component_inspection_history: {
        Row: {
          avg_marine_growth: number | null
          component_id: number | null
          data_updated_at: string | null
          first_inspection_date: string | null
          last_anomaly_date: string | null
          last_inspection_date: string | null
          last_inspection_status: string | null
          last_inspection_type: string | null
          recent_history: Json | null
          structure_id: number | null
          total_anomalies: number | null
          total_inspections: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_insp_records_structure"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structure"
            referencedColumns: ["str_id"]
          },
          {
            foreignKeyName: "fk_insp_records_structure"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "v_smart_query_structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_insp_records_structure"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "v_structure_details"
            referencedColumns: ["str_id"]
          },
          {
            foreignKeyName: "insp_records_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "structure_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insp_records_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "v_anomaly_details"
            referencedColumns: ["component_id"]
          },
          {
            foreignKeyName: "insp_records_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "v_smart_query_components"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_dive_inspections: {
        Row: {
          cr_date: string | null
          cr_user: string | null
          dive_date: string | null
          dive_no: string | null
          dive_supervisor: string | null
          diver_name: string | null
          has_anomaly: boolean | null
          insp_id: number | null
          inspection_data: Json | null
          inspection_date: string | null
          inspection_time: string | null
          inspection_type_code: string | null
          inspection_type_name: string | null
          inspno: string | null
          q_id: string | null
          status: string | null
          structure_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_structure_components_structure"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structure"
            referencedColumns: ["str_id"]
          },
          {
            foreignKeyName: "fk_structure_components_structure"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "v_smart_query_structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_structure_components_structure"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "v_structure_details"
            referencedColumns: ["str_id"]
          },
        ]
      }
      vw_latest_dive_movements: {
        Row: {
          depth_meters: number | null
          dive_job_id: number | null
          movement_time: string | null
          movement_type: string | null
          remarks: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insp_dive_movements_dive_job_id_fkey"
            columns: ["dive_job_id"]
            isOneToOne: false
            referencedRelation: "insp_dive_jobs"
            referencedColumns: ["dive_job_id"]
          },
          {
            foreignKeyName: "insp_dive_movements_dive_job_id_fkey"
            columns: ["dive_job_id"]
            isOneToOne: false
            referencedRelation: "v_anomaly_details"
            referencedColumns: ["dive_job_id"]
          },
        ]
      }
      vw_latest_rov_movements: {
        Row: {
          depth_meters: number | null
          heading_degrees: number | null
          latitude: number | null
          longitude: number | null
          movement_time: string | null
          movement_type: string | null
          remarks: string | null
          rov_job_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: "insp_rov_movements_rov_job_id_fkey"
            columns: ["rov_job_id"]
            isOneToOne: false
            referencedRelation: "insp_rov_jobs"
            referencedColumns: ["rov_job_id"]
          },
          {
            foreignKeyName: "insp_rov_movements_rov_job_id_fkey"
            columns: ["rov_job_id"]
            isOneToOne: false
            referencedRelation: "v_anomaly_details"
            referencedColumns: ["rov_job_id"]
          },
          {
            foreignKeyName: "insp_rov_movements_rov_job_id_fkey"
            columns: ["rov_job_id"]
            isOneToOne: false
            referencedRelation: "vw_rov_inspections_with_settings"
            referencedColumns: ["rov_job_id"]
          },
        ]
      }
      vw_latest_video_logs: {
        Row: {
          event_time: string | null
          event_type: string | null
          remarks: string | null
          tape_id: number | null
          timecode_end: string | null
          timecode_start: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insp_video_logs_tape_id_fkey"
            columns: ["tape_id"]
            isOneToOne: false
            referencedRelation: "insp_video_tapes"
            referencedColumns: ["tape_id"]
          },
        ]
      }
      vw_rov_inspections: {
        Row: {
          cr_date: string | null
          cr_user: string | null
          deployment_date: string | null
          deployment_no: string | null
          has_anomaly: boolean | null
          insp_id: number | null
          inspection_data: Json | null
          inspection_date: string | null
          inspection_time: string | null
          inspection_type_code: string | null
          inspection_type_name: string | null
          inspno: string | null
          q_id: string | null
          rov_operator: string | null
          rov_serial_no: string | null
          rov_supervisor: string | null
          status: string | null
          structure_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_structure_components_structure"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structure"
            referencedColumns: ["str_id"]
          },
          {
            foreignKeyName: "fk_structure_components_structure"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "v_smart_query_structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_structure_components_structure"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "v_structure_details"
            referencedColumns: ["str_id"]
          },
        ]
      }
      vw_rov_inspections_with_settings: {
        Row: {
          auto_capture_data: boolean | null
          auto_grab_video: boolean | null
          connection_type: string | null
          data_config_name: string | null
          deployment_date: string | null
          deployment_no: string | null
          grab_format: string | null
          inspections_with_data: number | null
          inspections_with_video: number | null
          parsing_method: string | null
          resolution_height: number | null
          resolution_width: number | null
          rov_job_id: number | null
          rov_serial_no: string | null
          status: string | null
          total_inspections: number | null
          video_config_name: string | null
          video_source: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      assign_user_role: {
        Args: { new_modules: Json; new_role: string; target_id: string }
        Returns: Json
      }
      check_user_is_admin_of_company: {
        Args: { company_uuid: string; user_uuid: string }
        Returns: boolean
      }
      check_user_is_company_admin: {
        Args: { user_uuid: string }
        Returns: boolean
      }
      check_user_is_member_of_company: {
        Args: { company_uuid: string; user_uuid: string }
        Returns: boolean
      }
      check_user_is_super_admin: {
        Args: { user_uuid: string }
        Returns: boolean
      }
      fn_capture_rov_data_snapshot: {
        Args: { p_raw_data_string: string; p_rov_job_id: number }
        Returns: Json
      }
      fn_format_counter: {
        Args: { p_counter_value: number; p_format?: string }
        Returns: string
      }
      fn_get_default_rov_data_config: {
        Args: { p_structure_type?: string }
        Returns: {
          config_id: number
          config_name: string
          connection_params: Json
          connection_type: string
          default_data_sources: Json
          field_mappings: Json
          parsing_method: string
        }[]
      }
      fn_get_default_video_grab_config: {
        Args: never
        Returns: {
          config_id: number
          config_name: string
          enable_overlay: boolean
          grab_format: string
          grab_quality: number
          overlay_template: Json
          resolution_height: number
          resolution_width: number
          video_source: string
        }[]
      }
      fn_get_next_analysis_task: {
        Args: never
        Returns: {
          component_type: string
          file_path: string
          inspection_id: number
          inspection_type_code: string
          media_id: number
          queue_id: number
        }[]
      }
      fn_learn_numbering_pattern: {
        Args: {
          p_pattern_type: string
          p_sample_value: string
          p_user_id: string
        }
        Returns: undefined
      }
      fn_learn_personnel_assignment: {
        Args: {
          p_coordinator: string
          p_job_type: string
          p_primary_person: string
          p_structure_id: number
          p_supervisor: string
          p_user_id: string
        }
        Returns: undefined
      }
      fn_learn_text_pattern: {
        Args: {
          p_component_type: string
          p_field_name: string
          p_inspection_type: string
          p_text: string
        }
        Returns: undefined
      }
      fn_queue_image_for_analysis: {
        Args: {
          p_inspection_id?: number
          p_media_id: number
          p_priority?: number
        }
        Returns: number
      }
      fn_start_video_counter: {
        Args: { p_counter_format?: string; p_tape_id: number }
        Returns: number
      }
      fn_stop_video_counter: { Args: { p_tape_id: number }; Returns: number }
      fn_suggest_next_number: {
        Args: { p_pattern_type: string; p_user_id: string }
        Returns: string
      }
      fn_suggest_personnel: {
        Args: { p_job_type: string; p_structure_id: number; p_user_id: string }
        Returns: {
          confidence: number
          coordinator: string
          primary_person: string
          supervisor: string
        }[]
      }
      fn_suggest_text: {
        Args: {
          p_component_type: string
          p_field_name: string
          p_inspection_type: string
          p_limit?: number
          p_partial_text: string
        }
        Returns: {
          confidence: number
          suggestion: string
        }[]
      }
      fn_update_counter_position: {
        Args: { p_counter_value: number; p_tape_id: number }
        Returns: undefined
      }
      fn_update_model_metrics: {
        Args: {
          p_ai_provider: string
          p_metric_date?: string
          p_model_version: string
        }
        Returns: undefined
      }
      get_all_users: {
        Args: never
        Returns: {
          avatar_url: string
          created_at: string
          designation: string
          email: string
          full_name: string
          id: string
          last_seen_at: string
          last_sign_in_at: string
          modules: Json
          role: string
        }[]
      }
      get_next_record_sequence: {
        Args: {
          p_category: string
          p_jobpack_id: number
          p_report_no: string
          p_structure_id: number
        }
        Returns: number
      }
      get_user_info: {
        Args: { user_ids: string[] }
        Returns: {
          email: string
          full_name: string
          id: string
        }[]
      }
      refresh_component_history: { Args: never; Returns: undefined }
      rpc_global_search: {
        Args: { query_text: string }
        Returns: {
          id: string
          score: number
          subtitle: string
          title: string
          type: string
          url: string
        }[]
      }
      set_initial_admin: { Args: never; Returns: Json }
      update_user_heartbeat: { Args: never; Returns: Json }
    }
    Enums: {
      user_role:
        | "super_admin"
        | "company_admin"
        | "manager"
        | "inspector"
        | "viewer"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      user_role: [
        "super_admin",
        "company_admin",
        "manager",
        "inspector",
        "viewer",
      ],
    },
  },
} as const

