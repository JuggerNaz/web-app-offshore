# Component UI Config

`json
{
  "components": [
    {
      "code": "cf",
      "componentType": "cf_comp",
      "fields": [
        {
          "name": "cgud_typ",
          "type": "string"
        },
        {
          "name": "fitg_typ",
          "type": "string"
        },
        {
          "name": "no_slots",
          "type": "string"
        }
      ]
    },
    {
      "code": "cl",
      "componentType": "cl_comp",
      "fields": [
        {
          "name": "clam_typ",
          "type": "string"
        },
        {
          "name": "clam_mat",
          "type": "string"
        },
        {
          "name": "no_bolts",
          "type": "string"
        },
        {
          "name": "liner_reqd",
          "type": "boolean"
        },
        {
          "name": "diameter",
          "type": "string",
          "units": [
            "m",
            "cm",
            "mm"
          ],
          "defaultUnit": "m"
        },
        {
          "name": "length",
          "type": "string",
          "units": [
            "m",
            "cm",
            "mm"
          ],
          "defaultUnit": "m"
        },
        {
          "name": "bolt_diam",
          "type": "string"
        },
        {
          "name": "stub_length",
          "type": "string",
          "units": [
            "m",
            "cm",
            "mm"
          ],
          "defaultUnit": "m"
        },
        {
          "name": "flange_gap",
          "type": "string"
        },
        {
          "name": "wall_thk",
          "type": "string"
        }
      ]
    },
    {
      "code": "cd",
      "componentType": "cd_comp",
      "fields": [
        {
          "name": "out_diam",
          "type": "string"
        },
        {
          "name": "in_diam",
          "type": "string"
        },
        {
          "name": "wall_thk",
          "type": "string"
        },
        {
          "name": "production",
          "type": "string"
        },
        {
          "name": "coat_typ",
          "type": "string"
        }
      ]
    },
    {
      "code": "cs",
      "componentType": "cs_comp",
      "fields": [
        {
          "name": "csum_typ",
          "type": "string"
        },
        {
          "name": "cais_at",
          "type": "string"
        },
        {
          "name": "corr_ctg",
          "type": "string"
        },
        {
          "name": "attachments",
          "type": "string"
        },
        {
          "name": "diameter",
          "type": "string",
          "units": [
            "m",
            "cm",
            "mm"
          ],
          "defaultUnit": "m"
        },
        {
          "name": "termination_p",
          "type": "string"
        },
        {
          "name": "injection_line",
          "type": "string"
        },
        {
          "name": "suction_device",
          "type": "string"
        },
        {
          "name": "coating",
          "type": "string"
        }
      ]
    },
    {
      "code": "bb",
      "componentType": "bb_comp",
      "fields": [
        {
          "name": "no_undattach",
          "type": "string"
        },
        {
          "name": "no_topattach",
          "type": "string"
        },
        {
          "name": "length",
          "type": "string",
          "units": [
            "m",
            "cm",
            "mm"
          ],
          "defaultUnit": "m"
        },
        {
          "name": "diameter",
          "type": "string",
          "units": [
            "m",
            "cm",
            "mm"
          ],
          "defaultUnit": "m"
        },
        {
          "name": "weight",
          "type": "string",
          "units": [
            "tonne",
            "kg",
            "g"
          ],
          "defaultUnit": "tonne"
        }
      ]
    },
    {
      "code": "fa",
      "componentType": "fa_comp",
      "fields": [
        {
          "name": "face_pos",
          "type": "string"
        }
      ]
    },
    {
      "code": "fv",
      "componentType": "fv_comp",
      "fields": [
        {
          "name": "valve_status",
          "type": "string"
        }
      ]
    },
    {
      "code": "fd",
      "componentType": "fd_comp",
      "fields": [
        {
          "name": "fender_type",
          "type": "string"
        },
        {
          "name": "no_subsea",
          "type": "string"
        },
        {
          "name": "no_topside",
          "type": "string"
        },
        {
          "name": "no_landings",
          "type": "string"
        },
        {
          "name": "length",
          "type": "string",
          "units": [
            "m",
            "cm",
            "mm"
          ],
          "defaultUnit": "m"
        },
        {
          "name": "weight",
          "type": "string",
          "units": [
            "tonne",
            "kg",
            "g"
          ],
          "defaultUnit": "tonne"
        }
      ]
    },
    {
      "code": "bb",
      "componentType": "bb_comp",
      "fields": [
        {
          "name": "bumper_type",
          "type": "string"
        },
        {
          "name": "no_subsea",
          "type": "string"
        },
        {
          "name": "no_topside",
          "type": "string"
        },
        {
          "name": "no_landings",
          "type": "string"
        },
        {
          "name": "length",
          "type": "string",
          "units": [
            "m",
            "cm",
            "mm"
          ],
          "defaultUnit": "m"
        },
        {
          "name": "width",
          "type": "string",
          "units": [
            "m",
            "cm",
            "mm"
          ],
          "defaultUnit": "m"
        },
        {
          "name": "weight",
          "type": "string",
          "units": [
            "tonne",
            "kg",
            "g"
          ],
          "defaultUnit": "tonne"
        }
      ]
    },
    {
      "code": "bl",
      "componentType": "bl_comp",
      "fields": [
        {
          "name": "boatlanding_types",
          "type": "string"
        },
        {
          "name": "no_subsea",
          "type": "string"
        },
        {
          "name": "no_topside",
          "type": "string"
        },
        {
          "name": "no_landings",
          "type": "string"
        },
        {
          "name": "length",
          "type": "string",
          "units": [
            "m",
            "cm",
            "mm"
          ],
          "defaultUnit": "m"
        },
        {
          "name": "weight",
          "type": "string",
          "units": [
            "tonne",
            "kg",
            "g"
          ],
          "defaultUnit": "tonne"
        }
      ]
    },
    {
      "code": "hm",
      "componentType": "hm_comp",
      "fields": [
        {
          "name": "thetype",
          "type": "string"
        },
        {
          "name": "memb_mat",
          "type": "string"
        },
        {
          "name": "corr_ctg",
          "type": "string"
        },
        {
          "name": "length",
          "type": "string",
          "units": [
            "m",
            "cm",
            "mm"
          ],
          "defaultUnit": "m"
        },
        {
          "name": "nominal_diam",
          "type": "string"
        },
        {
          "name": "out_diam",
          "type": "string"
        },
        {
          "name": "wall_thk",
          "type": "string"
        },
        {
          "name": "stiffening",
          "type": "string"
        }
      ]
    },
    {
      "code": "hs",
      "componentType": "hs_comp",
      "fields": [
        {
          "name": "hose_typ",
          "type": "string"
        },
        {
          "name": "hose_man",
          "type": "string"
        },
        {
          "name": "flan_cls",
          "type": "string"
        },
        {
          "name": "hose_cnt",
          "type": "string"
        },
        {
          "name": "length",
          "type": "string",
          "units": [
            "m",
            "cm",
            "mm"
          ],
          "defaultUnit": "m"
        },
        {
          "name": "serial_no",
          "type": "string"
        },
        {
          "name": "purch_date",
          "type": "string"
        },
        {
          "name": "flange_rating",
          "type": "string"
        },
        {
          "name": "electrically_cont",
          "type": "boolean"
        }
      ]
    },
    {
      "code": "lg",
      "componentType": "lg_comp",
      "fields": [
        {
          "name": "memb_mat",
          "type": "string"
        },
        {
          "name": "wall_thk",
          "type": "string"
        },
        {
          "name": "diameter",
          "type": "string",
          "units": [
            "m",
            "cm",
            "mm"
          ],
          "defaultUnit": "m"
        },
        {
          "name": "length",
          "type": "string",
          "units": [
            "m",
            "cm",
            "mm"
          ],
          "defaultUnit": "m"
        },
        {
          "name": "int_stiff",
          "type": "boolean"
        },
        {
          "name": "ext_stiff",
          "type": "boolean"
        }
      ]
    },
    {
      "code": "pg",
      "componentType": "pg_comp",
      "fields": [
        {
          "name": "pile_present",
          "type": "string"
        },
        {
          "name": "diameter",
          "type": "string",
          "units": [
            "m",
            "cm",
            "mm"
          ],
          "defaultUnit": "m"
        },
        {
          "name": "pgud_typ",
          "type": "string"
        },
        {
          "name": "pgud_mat",
          "type": "string"
        },
        {
          "name": "pgud_fas",
          "type": "string"
        }
      ]
    },
    {
      "code": "pl",
      "componentType": "pl_comp",
      "fields": [
        {
          "name": "wall_thk",
          "type": "string"
        },
        {
          "name": "diameter",
          "type": "string",
          "units": [
            "m",
            "cm",
            "mm"
          ],
          "defaultUnit": "m"
        },
        {
          "name": "depth",
          "type": "string",
          "units": [
            "m",
            "cm",
            "mm"
          ],
          "defaultUnit": "m"
        },
        {
          "name": "pile_typ",
          "type": "string"
        },
        {
          "name": "pile_mat",
          "type": "string"
        }
      ]
    },
    {
      "code": "rb",
      "componentType": "rb_comp",
      "fields": [
        {
          "name": "risb_typ",
          "type": "string"
        },
        {
          "name": "length",
          "type": "string",
          "units": [
            "m",
            "cm",
            "mm"
          ],
          "defaultUnit": "m"
        },
        {
          "name": "width",
          "type": "string",
          "units": [
            "m",
            "cm",
            "mm"
          ],
          "defaultUnit": "m"
        },
        {
          "name": "no_riserslots",
          "type": "string"
        },
        {
          "name": "no_suppbackets",
          "type": "string"
        }
      ]
    },
    {
      "code": "rg",
      "componentType": "rg_comp",
      "fields": [
        {
          "name": "no_subsea",
          "type": "string"
        },
        {
          "name": "no_topside",
          "type": "string"
        },
        {
          "name": "no_risers",
          "type": "string"
        },
        {
          "name": "risg_typ",
          "type": "string"
        },
        {
          "name": "width",
          "type": "string",
          "units": [
            "m",
            "cm",
            "mm"
          ],
          "defaultUnit": "m"
        },
        {
          "name": "length",
          "type": "string",
          "units": [
            "m",
            "cm",
            "mm"
          ],
          "defaultUnit": "m"
        },
        {
          "name": "depth",
          "type": "string",
          "units": [
            "m",
            "cm",
            "mm"
          ],
          "defaultUnit": "m"
        }
      ]
    },
    {
      "code": "rs",
      "componentType": "rs_comp",
      "fields": [
        {
          "name": "diameter",
          "type": "string",
          "units": [
            "m",
            "cm",
            "mm"
          ],
          "defaultUnit": "m"
        },
        {
          "name": "wall_thk",
          "type": "string"
        },
        {
          "name": "desg_press",
          "type": "string"
        },
        {
          "name": "op_press",
          "type": "string"
        },
        {
          "name": "no_clamps",
          "type": "string"
        },
        {
          "name": "risr_typ",
          "type": "string"
        },
        {
          "name": "risr_mat",
          "type": "string"
        },
        {
          "name": "corr_ctg",
          "type": "string"
        },
        {
          "name": "pipe_rtg",
          "type": "string"
        }
      ]
    },
    {
      "code": "vd",
      "componentType": "vd_comp",
      "fields": [
        {
          "name": "thetype",
          "type": "string"
        },
        {
          "name": "memb_mat",
          "type": "string"
        },
        {
          "name": "corr_ctg",
          "type": "string"
        },
        {
          "name": "length",
          "type": "string",
          "units": [
            "m",
            "cm",
            "mm"
          ],
          "defaultUnit": "m"
        },
        {
          "name": "nominal_diam",
          "type": "string"
        },
        {
          "name": "out_diam",
          "type": "string"
        },
        {
          "name": "wall_thk",
          "type": "string"
        },
        {
          "name": "stiffening",
          "type": "string"
        }
      ]
    },
    {
      "code": "vm",
      "componentType": "vm_comp",
      "fields": [
        {
          "name": "thetype",
          "type": "string"
        },
        {
          "name": "memb_mat",
          "type": "string"
        },
        {
          "name": "corr_ctg",
          "type": "string"
        },
        {
          "name": "length",
          "type": "string",
          "units": [
            "m",
            "cm",
            "mm"
          ],
          "defaultUnit": "m"
        },
        {
          "name": "nominal_diam",
          "type": "string"
        },
        {
          "name": "out_diam",
          "type": "string"
        },
        {
          "name": "wall_thk",
          "type": "string"
        },
        {
          "name": "stiffening",
          "type": "string"
        }
      ]
    },
    {
      "code": "wn",
      "componentType": "wn_comp",
      "fields": [
        {
          "name": "nc_wall_thk",
          "type": "string"
        },
        {
          "name": "memb_wall_thk",
          "type": "string"
        },
        {
          "name": "node_diam",
          "type": "string"
        },
        {
          "name": "memb_diam",
          "type": "string"
        },
        {
          "name": "weld_typ",
          "type": "string"
        },
        {
          "name": "weld_des",
          "type": "string"
        },
        {
          "name": "weld_mat",
          "type": "string"
        },
        {
          "name": "weld_cfg",
          "type": "string"
        }
      ]
    },
    {
      "code": "wp",
      "componentType": "wp_comp",
      "fields": [
        {
          "name": "supp_wt",
          "type": "string",
          "units": [
            "tonne",
            "kg",
            "g"
          ],
          "defaultUnit": "tonne"
        },
        {
          "name": "memb_wt",
          "type": "string",
          "units": [
            "tonne",
            "kg",
            "g"
          ],
          "defaultUnit": "tonne"
        },
        {
          "name": "supp_diam",
          "type": "string"
        },
        {
          "name": "memb_diam",
          "type": "string"
        },
        {
          "name": "wsup_typ",
          "type": "string"
        },
        {
          "name": "weld_typ",
          "type": "string"
        },
        {
          "name": "weld_des",
          "type": "string"
        },
        {
          "name": "weld_mat",
          "type": "string"
        },
        {
          "name": "weld_cfg",
          "type": "string"
        }
      ]
    },
    {
      "code": "hd",
      "componentType": "hd_comp",
      "fields": [
        {
          "name": "thetype",
          "type": "string"
        },
        {
          "name": "memb_mat",
          "type": "string"
        },
        {
          "name": "corr_ctg",
          "type": "string"
        },
        {
          "name": "length",
          "type": "string",
          "units": [
            "m",
            "cm",
            "mm"
          ],
          "defaultUnit": "m"
        },
        {
          "name": "nominal_diam",
          "type": "string"
        },
        {
          "name": "out_diam",
          "type": "string"
        },
        {
          "name": "wall_thk",
          "type": "string"
        },
        {
          "name": "stiffening",
          "type": "string"
        }
      ]
    },
    {
      "code": "lg",
      "componentType": "lg_comp",
      "fields": [
        {
          "name": "material",
          "type": "string"
        },
        {
          "name": "wall_thk",
          "type": "string"
        },
        {
          "name": "diameter",
          "type": "string",
          "units": [
            "m",
            "cm",
            "mm"
          ],
          "defaultUnit": "m"
        },
        {
          "name": "length",
          "type": "string",
          "units": [
            "m",
            "cm",
            "mm"
          ],
          "defaultUnit": "m"
        },
        {
          "name": "int_stiff",
          "type": "string"
        },
        {
          "name": "ext_stiff",
          "type": "string"
        },
        {
          "name": "id_chk",
          "type": "string"
        }
      ]
    },
    {
      "code": "sd",
      "componentType": "sd_comp",
      "fields": [
        {
          "name": "dist_from_legs",
          "type": "string"
        }
      ]
    },
    {
      "code": "cu",
      "componentType": "cu_comp",
      "fields": [
        {
          "name": "thetype",
          "type": "string"
        },
        {
          "name": "no_subsea",
          "type": "string"
        },
        {
          "name": "no_topside",
          "type": "string"
        },
        {
          "name": "no_conductors",
          "type": "string"
        },
        {
          "name": "weight",
          "type": "string",
          "units": [
            "tonne",
            "kg",
            "g"
          ],
          "defaultUnit": "tonne"
        },
        {
          "name": "width",
          "type": "string",
          "units": [
            "m",
            "cm",
            "mm"
          ],
          "defaultUnit": "m"
        },
        {
          "name": "length",
          "type": "string",
          "units": [
            "m",
            "cm",
            "mm"
          ],
          "defaultUnit": "m"
        }
      ]
    },
    {
      "code": "sg",
      "componentType": "sg_comp",
      "fields": [
        {
          "name": "thetype",
          "type": "string"
        },
        {
          "name": "no_subsea",
          "type": "string"
        },
        {
          "name": "no_topside",
          "type": "string"
        },
        {
          "name": "no_caissons",
          "type": "string"
        },
        {
          "name": "weight",
          "type": "string",
          "units": [
            "tonne",
            "kg",
            "g"
          ],
          "defaultUnit": "tonne"
        },
        {
          "name": "width",
          "type": "string",
          "units": [
            "m",
            "cm",
            "mm"
          ],
          "defaultUnit": "m"
        },
        {
          "name": "length",
          "type": "string",
          "units": [
            "m",
            "cm",
            "mm"
          ],
          "defaultUnit": "m"
        }
      ]
    },
    {
      "code": "it",
      "componentType": "it_comp",
      "fields": [
        {
          "name": "easting",
          "type": "string"
        },
        {
          "name": "northing",
          "type": "string"
        },
        {
          "name": "equipment",
          "type": "string"
        },
        {
          "name": "location_no",
          "type": "string"
        }
      ]
    },
    {
      "code": "ct",
      "componentType": "ct_comp",
      "fields": [
        {
          "name": "ctry_typ",
          "type": "string"
        },
        {
          "name": "ctry_pos",
          "type": "string"
        },
        {
          "name": "ctry_mat",
          "type": "string"
        },
        {
          "name": "ctry_fas",
          "type": "string"
        }
      ]
    },
    {
      "code": "an",
      "componentType": "an_comp_pipe",
      "fields": [
        {
          "name": "fitting",
          "type": "string"
        },
        {
          "name": "inst_date",
          "type": "string"
        },
        {
          "name": "life",
          "type": "string"
        },
        {
          "name": "material",
          "type": "string"
        },
        {
          "name": "thetype",
          "type": "string"
        },
        {
          "name": "position",
          "type": "string"
        },
        {
          "name": "type",
          "type": "string"
        }
      ]
    },
    {
      "code": "an",
      "componentType": "an_comp_plat",
      "fields": [
        {
          "name": "fitting",
          "type": "string"
        },
        {
          "name": "inst_date",
          "type": "string"
        },
        {
          "name": "life",
          "type": "string"
        },
        {
          "name": "material",
          "type": "string"
        },
        {
          "name": "thetype",
          "type": "string"
        },
        {
          "name": "position",
          "type": "string"
        },
        {
          "name": "type",
          "type": "string"
        }
      ]
    },
    {
      "componentType": "",
      "fields": []
    },
    {
      "code": "vd",
      "componentType": "vd_comp",
      "fields": [
        {
          "name": "thetype",
          "type": "string"
        },
        {
          "name": "memb_mat",
          "type": "string"
        },
        {
          "name": "corr_ctg",
          "type": "string"
        },
        {
          "name": "length",
          "type": "string",
          "units": [
            "m",
            "cm",
            "mm"
          ],
          "defaultUnit": "m"
        },
        {
          "name": "nominal_diam",
          "type": "string"
        },
        {
          "name": "out_diam",
          "type": "string"
        },
        {
          "name": "wall_thk",
          "type": "string"
        },
        {
          "name": "stiffening",
          "type": "string"
        }
      ]
    },
    {
      "code": "vm",
      "componentType": "vm_comp",
      "fields": [
        {
          "name": "thetype",
          "type": "string"
        },
        {
          "name": "memb_mat",
          "type": "string"
        },
        {
          "name": "corr_ctg",
          "type": "string"
        },
        {
          "name": "length",
          "type": "string",
          "units": [
            "m",
            "cm",
            "mm"
          ],
          "defaultUnit": "m"
        },
        {
          "name": "nominal_diam",
          "type": "string"
        },
        {
          "name": "out_diam",
          "type": "string"
        },
        {
          "name": "wall_thk",
          "type": "string"
        },
        {
          "name": "stiffening",
          "type": "string"
        }
      ]
    },
    {
      "code": "gp",
      "componentType": "gp_comp",
      "fields": [
        {
          "name": "length",
          "type": "string",
          "units": [
            "m",
            "cm",
            "mm"
          ],
          "defaultUnit": "m"
        },
        {
          "name": "width",
          "type": "string",
          "units": [
            "m",
            "cm",
            "mm"
          ],
          "defaultUnit": "m"
        },
        {
          "name": "mgp_no",
          "type": "string"
        }
      ]
    },
    {
      "code": "gs",
      "componentType": "gs_comp",
      "fields": [
        {
          "name": "diameter",
          "type": "string",
          "units": [
            "m",
            "cm",
            "mm"
          ],
          "defaultUnit": "m"
        },
        {
          "name": "depth",
          "type": "string",
          "units": [
            "m",
            "cm",
            "mm"
          ],
          "defaultUnit": "m"
        },
        {
          "name": "easting",
          "type": "string"
        },
        {
          "name": "northing",
          "type": "string"
        },
        {
          "name": "has_gas_seepage",
          "type": "boolean"
        }
      ]
    },
    {
      "code": "ce",
      "componentType": "ce_comp",
      "fields": [
        {
          "name": "diameter",
          "type": "string",
          "units": [
            "m",
            "cm",
            "mm"
          ],
          "defaultUnit": "m"
        },
        {
          "name": "depth",
          "type": "string",
          "units": [
            "m",
            "cm",
            "mm"
          ],
          "defaultUnit": "m"
        },
        {
          "name": "easting",
          "type": "string"
        },
        {
          "name": "northing",
          "type": "string"
        },
        {
          "name": "has_gas_seepage",
          "type": "boolean"
        }
      ]
    },
    {
      "code": "yp",
      "componentType": "yp_comp",
      "fields": [
        {
          "name": "dimension_1",
          "type": "string",
          "units": [
            "m",
            "cm",
            "mm"
          ],
          "defaultUnit": "m"
        },
        {
          "name": "dimension_2",
          "type": "string",
          "units": [
            "m",
            "cm",
            "mm"
          ],
          "defaultUnit": "m"
        },
        {
          "name": "dimension_3",
          "type": "string",
          "units": [
            "m",
            "cm",
            "mm"
          ],
          "defaultUnit": "m"
        },
        {
          "name": "angle",
          "type": "string"
        },
        {
          "name": "comments",
          "type": "string"
        }
      ]
    }
  ]
}
`