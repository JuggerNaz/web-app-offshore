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
        Relationships: []
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
      company_settings: {
        Row: {
          company_name: string
          created_at: string | null
          department_name: string | null
          id: number
          logo_path: string | null
          serial_no: string | null
          storage_provider: string
          updated_at: string | null
        }
        Insert: {
          company_name?: string
          created_at?: string | null
          department_name?: string | null
          id?: number
          logo_path?: string | null
          serial_no?: string | null
          storage_provider?: string
          updated_at?: string | null
        }
        Update: {
          company_name?: string
          created_at?: string | null
          department_name?: string | null
          id?: number
          logo_path?: string | null
          serial_no?: string | null
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
          code: string | null
          created_at: string | null
          created_by: string | null
          id: number
          metadata: Json | null
          modified_by: string | null
          name: string | null
          sname: string | null
          updated_at: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: number
          metadata?: Json | null
          modified_by?: string | null
          name?: string | null
          sname?: string | null
          updated_at?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: number
          metadata?: Json | null
          modified_by?: string | null
          name?: string | null
          sname?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      jobpack: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: number
          metadata: Json | null
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
          modified_by?: string | null
          name?: string | null
          status?: string | null
          updated_at?: string | null
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
        Relationships: []
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
      v_defect_types_by_code: {
        Row: {
          defect_code_id: string | null
          lib_code: string | null
          lib_desc: string | null
          lib_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_all_users: {
        Args: never
        Returns: {
          created_at: string
          email: string
          id: string
          last_sign_in_at: string
        }[]
      }
      get_user_info: {
        Args: { user_ids: string[] }
        Returns: {
          email: string
          full_name: string
          id: string
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
    Enums: {},
  },
} as const

