export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      acesso_a_folha: {
        Row: {
          incluido_em: string
          profile_id: string
        }
        Insert: {
          incluido_em?: string
          profile_id: string
        }
        Update: {
          incluido_em?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "acesso_a_folha_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversations: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          titulo: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          titulo?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          titulo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_messages: {
        Row: {
          conteudo: string
          conversation_id: string
          created_at: string
          id: string
          papel: string
        }
        Insert: {
          conteudo: string
          conversation_id: string
          created_at?: string
          id?: string
          papel: string
        }
        Update: {
          conteudo?: string
          conversation_id?: string
          created_at?: string
          id?: string
          papel?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          description: string | null
          key: string
          owner_only: boolean
          updated_at: string
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          owner_only?: boolean
          updated_at?: string
          value?: Json
        }
        Update: {
          description?: string | null
          key?: string
          owner_only?: boolean
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      bu_default_shares: {
        Row: {
          active: boolean
          business_unit: Database["public"]["Enums"]["business_unit"]
          id: string
          kind: Database["public"]["Enums"]["share_kind"]
          profile_id: string
          share_pct: number
        }
        Insert: {
          active?: boolean
          business_unit: Database["public"]["Enums"]["business_unit"]
          id?: string
          kind?: Database["public"]["Enums"]["share_kind"]
          profile_id: string
          share_pct: number
        }
        Update: {
          active?: boolean
          business_unit?: Database["public"]["Enums"]["business_unit"]
          id?: string
          kind?: Database["public"]["Enums"]["share_kind"]
          profile_id?: string
          share_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "bu_default_shares_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cancelamentos_desfeitos: {
        Row: {
          cancelada_em: string
          cancelada_por: string | null
          desfeito_em: string
          desfeito_por: string | null
          id: string
          meeting_id: string | null
          motivo: string | null
          titulo_da_reuniao: string | null
        }
        Insert: {
          cancelada_em: string
          cancelada_por?: string | null
          desfeito_em?: string
          desfeito_por?: string | null
          id?: string
          meeting_id?: string | null
          motivo?: string | null
          titulo_da_reuniao?: string | null
        }
        Update: {
          cancelada_em?: string
          cancelada_por?: string | null
          desfeito_em?: string
          desfeito_por?: string | null
          id?: string
          meeting_id?: string | null
          motivo?: string | null
          titulo_da_reuniao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cancelamentos_desfeitos_cancelada_por_fkey"
            columns: ["cancelada_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cancelamentos_desfeitos_desfeito_por_fkey"
            columns: ["desfeito_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cancelamentos_desfeitos_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          churned_at: string | null
          confidencial: boolean
          confidencial_nota: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          drive_folder_id: string | null
          id: string
          name: string
          nicho: string | null
          owner_id: string | null
          paused_at: string | null
          segment: string | null
          signed_at: string | null
          status: Database["public"]["Enums"]["client_status"]
          updated_at: string
        }
        Insert: {
          churned_at?: string | null
          confidencial?: boolean
          confidencial_nota?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          drive_folder_id?: string | null
          id?: string
          name: string
          nicho?: string | null
          owner_id?: string | null
          paused_at?: string | null
          segment?: string | null
          signed_at?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          updated_at?: string
        }
        Update: {
          churned_at?: string | null
          confidencial?: boolean
          confidencial_nota?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          drive_folder_id?: string | null
          id?: string
          name?: string
          nicho?: string | null
          owner_id?: string | null
          paused_at?: string | null
          segment?: string | null
          signed_at?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_post_events: {
        Row: {
          autor_id: string
          criado_em: string
          de: Database["public"]["Enums"]["post_status"] | null
          id: string
          internal_task_id: string | null
          nota: string | null
          para: Database["public"]["Enums"]["post_status"]
          post_id: string
        }
        Insert: {
          autor_id: string
          criado_em?: string
          de?: Database["public"]["Enums"]["post_status"] | null
          id?: string
          internal_task_id?: string | null
          nota?: string | null
          para: Database["public"]["Enums"]["post_status"]
          post_id: string
        }
        Update: {
          autor_id?: string
          criado_em?: string
          de?: Database["public"]["Enums"]["post_status"] | null
          id?: string
          internal_task_id?: string | null
          nota?: string | null
          para?: Database["public"]["Enums"]["post_status"]
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_post_events_internal_task_id_fkey"
            columns: ["internal_task_id"]
            isOneToOne: false
            referencedRelation: "internal_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_post_events_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "content_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      content_posts: {
        Row: {
          caption: string | null
          channel: Database["public"]["Enums"]["post_channel"]
          client_id: string
          created_at: string
          created_by: string
          format: Database["public"]["Enums"]["post_format"]
          id: string
          media_url: string | null
          published_at: string | null
          published_url: string | null
          responsible_id: string
          scheduled_at: string
          status: Database["public"]["Enums"]["post_status"]
          status_desde: string
          title: string
          updated_at: string
        }
        Insert: {
          caption?: string | null
          channel?: Database["public"]["Enums"]["post_channel"]
          client_id: string
          created_at?: string
          created_by?: string
          format: Database["public"]["Enums"]["post_format"]
          id?: string
          media_url?: string | null
          published_at?: string | null
          published_url?: string | null
          responsible_id: string
          scheduled_at: string
          status?: Database["public"]["Enums"]["post_status"]
          status_desde?: string
          title: string
          updated_at?: string
        }
        Update: {
          caption?: string | null
          channel?: Database["public"]["Enums"]["post_channel"]
          client_id?: string
          created_at?: string
          created_by?: string
          format?: Database["public"]["Enums"]["post_format"]
          id?: string
          media_url?: string | null
          published_at?: string | null
          published_url?: string | null
          responsible_id?: string
          scheduled_at?: string
          status?: Database["public"]["Enums"]["post_status"]
          status_desde?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_posts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_posts_responsible_id_fkey"
            columns: ["responsible_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_closings: {
        Row: {
          contract_id: string
          created_at: string
          fechado_em: string
          id: string
          motivo: string
          revertido_em: string | null
          revertido_por: string | null
        }
        Insert: {
          contract_id: string
          created_at?: string
          fechado_em?: string
          id?: string
          motivo?: string
          revertido_em?: string | null
          revertido_por?: string | null
        }
        Update: {
          contract_id?: string
          created_at?: string
          fechado_em?: string
          id?: string
          motivo?: string
          revertido_em?: string | null
          revertido_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_closings_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_closings_revertido_por_fkey"
            columns: ["revertido_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_items: {
        Row: {
          contract_id: string
          front: Database["public"]["Enums"]["service_front"]
          id: string
          product_id: string | null
          value: number
        }
        Insert: {
          contract_id: string
          front: Database["public"]["Enums"]["service_front"]
          id?: string
          product_id?: string | null
          value: number
        }
        Update: {
          contract_id?: string
          front?: Database["public"]["Enums"]["service_front"]
          id?: string
          product_id?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "contract_items_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_shares: {
        Row: {
          contract_id: string
          created_at: string
          external_name: string | null
          id: string
          kind: Database["public"]["Enums"]["share_kind"]
          profile_id: string | null
          share_pct: number
        }
        Insert: {
          contract_id: string
          created_at?: string
          external_name?: string | null
          id?: string
          kind: Database["public"]["Enums"]["share_kind"]
          profile_id?: string | null
          share_pct: number
        }
        Update: {
          contract_id?: string
          created_at?: string
          external_name?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["share_kind"]
          profile_id?: string | null
          share_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "contract_shares_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_shares_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          billing_active: boolean
          billing_ends_at: string | null
          billing_months: number | null
          billing_paused_at: string | null
          business_unit: Database["public"]["Enums"]["business_unit"]
          client_id: string
          commitment_months: number | null
          contract_type: Database["public"]["Enums"]["contract_type"]
          created_at: string
          delivered_at: string | null
          delivery_deadline: string | null
          duration_months: number | null
          end_date: string | null
          finished_at: string | null
          finished_by: string | null
          id: string
          installments: number | null
          is_commissionable: boolean
          is_firm: boolean
          monthly_value: number | null
          name: string
          notes: string | null
          opportunity_id: string | null
          pause_reason: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          start_date: string
          status: Database["public"]["Enums"]["contract_status"]
          total_value: number | null
          updated_at: string
        }
        Insert: {
          billing_active?: boolean
          billing_ends_at?: string | null
          billing_months?: number | null
          billing_paused_at?: string | null
          business_unit: Database["public"]["Enums"]["business_unit"]
          client_id: string
          commitment_months?: number | null
          contract_type: Database["public"]["Enums"]["contract_type"]
          created_at?: string
          delivered_at?: string | null
          delivery_deadline?: string | null
          duration_months?: number | null
          end_date?: string | null
          finished_at?: string | null
          finished_by?: string | null
          id?: string
          installments?: number | null
          is_commissionable?: boolean
          is_firm?: boolean
          monthly_value?: number | null
          name: string
          notes?: string | null
          opportunity_id?: string | null
          pause_reason?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          start_date: string
          status?: Database["public"]["Enums"]["contract_status"]
          total_value?: number | null
          updated_at?: string
        }
        Update: {
          billing_active?: boolean
          billing_ends_at?: string | null
          billing_months?: number | null
          billing_paused_at?: string | null
          business_unit?: Database["public"]["Enums"]["business_unit"]
          client_id?: string
          commitment_months?: number | null
          contract_type?: Database["public"]["Enums"]["contract_type"]
          created_at?: string
          delivered_at?: string | null
          delivery_deadline?: string | null
          duration_months?: number | null
          end_date?: string | null
          finished_at?: string | null
          finished_by?: string | null
          id?: string
          installments?: number | null
          is_commissionable?: boolean
          is_firm?: boolean
          monthly_value?: number | null
          name?: string
          notes?: string | null
          opportunity_id?: string | null
          pause_reason?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          start_date?: string
          status?: Database["public"]["Enums"]["contract_status"]
          total_value?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_health"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "contracts_finished_by_fkey"
            columns: ["finished_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      correcoes_de_data_do_cliente: {
        Row: {
          antes: string | null
          campo: string
          client_id: string
          corrigido_em: string
          corrigido_por: string | null
          depois: string
          id: string
        }
        Insert: {
          antes?: string | null
          campo: string
          client_id: string
          corrigido_em?: string
          corrigido_por?: string | null
          depois: string
          id?: string
        }
        Update: {
          antes?: string | null
          campo?: string
          client_id?: string
          corrigido_em?: string
          corrigido_por?: string | null
          depois?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "correcoes_de_data_do_cliente_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "correcoes_de_data_do_cliente_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_health"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "correcoes_de_data_do_cliente_corrigido_por_fkey"
            columns: ["corrigido_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      correcoes_de_nota: {
        Row: {
          antes: string | null
          corrigido_em: string
          corrigido_por: string | null
          depois: string
          event_id: string
          id: string
        }
        Insert: {
          antes?: string | null
          corrigido_em?: string
          corrigido_por?: string | null
          depois: string
          event_id: string
          id?: string
        }
        Update: {
          antes?: string | null
          corrigido_em?: string
          corrigido_por?: string | null
          depois?: string
          event_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "correcoes_de_nota_corrigido_por_fkey"
            columns: ["corrigido_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "correcoes_de_nota_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "opportunity_events"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          active: boolean
          amount: number
          business_unit: Database["public"]["Enums"]["business_unit"]
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          created_by: string | null
          deactivated_at: string | null
          description: string
          end_date: string | null
          id: string
          installments_paid: number
          installments_total: number | null
          is_group: boolean
          notes: string | null
          parent_expense_id: string | null
          payment_method: string | null
          recurrence: Database["public"]["Enums"]["expense_recurrence"]
          start_date: string
          vendor: string | null
        }
        Insert: {
          active?: boolean
          amount?: number
          business_unit?: Database["public"]["Enums"]["business_unit"]
          category: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by?: string | null
          deactivated_at?: string | null
          description: string
          end_date?: string | null
          id?: string
          installments_paid?: number
          installments_total?: number | null
          is_group?: boolean
          notes?: string | null
          parent_expense_id?: string | null
          payment_method?: string | null
          recurrence?: Database["public"]["Enums"]["expense_recurrence"]
          start_date: string
          vendor?: string | null
        }
        Update: {
          active?: boolean
          amount?: number
          business_unit?: Database["public"]["Enums"]["business_unit"]
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by?: string | null
          deactivated_at?: string | null
          description?: string
          end_date?: string | null
          id?: string
          installments_paid?: number
          installments_total?: number | null
          is_group?: boolean
          notes?: string | null
          parent_expense_id?: string | null
          payment_method?: string | null
          recurrence?: Database["public"]["Enums"]["expense_recurrence"]
          start_date?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_parent_expense_id_fkey"
            columns: ["parent_expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses_saidas: {
        Row: {
          expense_id: string
          id: string
          saiu_em: string
          voltou_em: string | null
        }
        Insert: {
          expense_id: string
          id?: string
          saiu_em?: string
          voltou_em?: string | null
        }
        Update: {
          expense_id?: string
          id?: string
          saiu_em?: string
          voltou_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_saidas_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_settings: {
        Row: {
          id: boolean
          is_provisional: boolean
          source: string | null
          tax_pct: number
          updated_at: string
        }
        Insert: {
          id?: boolean
          is_provisional?: boolean
          source?: string | null
          tax_pct: number
          updated_at?: string
        }
        Update: {
          id?: boolean
          is_provisional?: boolean
          source?: string | null
          tax_pct?: number
          updated_at?: string
        }
        Relationships: []
      }
      gateway_fees: {
        Row: {
          fee_pct: number
          installments: number
        }
        Insert: {
          fee_pct: number
          installments: number
        }
        Update: {
          fee_pct?: number
          installments?: number
        }
        Relationships: []
      }
      internal_task_links: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          label: string
          task_id: string
          url: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          label: string
          task_id: string
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          task_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_task_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_task_links_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "internal_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_task_participants: {
        Row: {
          created_at: string
          profile_id: string
          task_id: string
        }
        Insert: {
          created_at?: string
          profile_id: string
          task_id: string
        }
        Update: {
          created_at?: string
          profile_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_task_participants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_task_participants_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "internal_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_tasks: {
        Row: {
          assignee_id: string | null
          category: string
          client_id: string | null
          col: Database["public"]["Enums"]["task_col"]
          concluida_em: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          opportunity_id: string | null
          priority: Database["public"]["Enums"]["task_priority"]
          raiz_recorrente: string | null
          recorrente_de: string | null
          recurrence: Database["public"]["Enums"]["task_recurrence"]
          task_type: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          category: string
          client_id?: string | null
          col?: Database["public"]["Enums"]["task_col"]
          concluida_em?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          opportunity_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          raiz_recorrente?: string | null
          recorrente_de?: string | null
          recurrence?: Database["public"]["Enums"]["task_recurrence"]
          task_type: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          category?: string
          client_id?: string | null
          col?: Database["public"]["Enums"]["task_col"]
          concluida_em?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          opportunity_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          raiz_recorrente?: string | null
          recorrente_de?: string | null
          recurrence?: Database["public"]["Enums"]["task_recurrence"]
          task_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_tasks_category_task_type_fkey"
            columns: ["category", "task_type"]
            isOneToOne: false
            referencedRelation: "task_catalog"
            referencedColumns: ["category", "task_type"]
          },
          {
            foreignKeyName: "internal_tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_health"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "internal_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_tasks_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_tasks_raiz_recorrente_fkey"
            columns: ["raiz_recorrente"]
            isOneToOne: false
            referencedRelation: "internal_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_tasks_recorrente_de_fkey"
            columns: ["recorrente_de"]
            isOneToOne: false
            referencedRelation: "internal_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_touches: {
        Row: {
          attribution_id: string
          created_at: string
          id: string
          landing_url: string | null
          opportunity_id: string | null
          user_agent: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          attribution_id: string
          created_at?: string
          id?: string
          landing_url?: string | null
          opportunity_id?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          attribution_id?: string
          created_at?: string
          id?: string
          landing_url?: string | null
          opportunity_id?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_touches_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_attendees: {
        Row: {
          meeting_id: string
          profile_id: string
        }
        Insert: {
          meeting_id: string
          profile_id: string
        }
        Update: {
          meeting_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_attendees_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_attendees_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          cancelada_em: string | null
          cancelada_por: string | null
          client_id: string | null
          created_at: string
          duration_minutes: number
          id: string
          local: string | null
          motivo_do_cancelamento: string | null
          notas: string | null
          opportunity_id: string | null
          organizer_id: string
          starts_at: string
          tipo: Database["public"]["Enums"]["meeting_type"]
          titulo: string
          updated_at: string
        }
        Insert: {
          cancelada_em?: string | null
          cancelada_por?: string | null
          client_id?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          local?: string | null
          motivo_do_cancelamento?: string | null
          notas?: string | null
          opportunity_id?: string | null
          organizer_id?: string
          starts_at: string
          tipo: Database["public"]["Enums"]["meeting_type"]
          titulo: string
          updated_at?: string
        }
        Update: {
          cancelada_em?: string | null
          cancelada_por?: string | null
          client_id?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          local?: string | null
          motivo_do_cancelamento?: string | null
          notas?: string | null
          opportunity_id?: string | null
          organizer_id?: string
          starts_at?: string
          tipo?: Database["public"]["Enums"]["meeting_type"]
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_cancelada_por_fkey"
            columns: ["cancelada_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_snapshot_rewrites: {
        Row: {
          id: string
          motivo: string
          ref_month: string
          regravado_em: string
          regravado_por: string
          resultado_antes: number | null
          resultado_depois: number | null
        }
        Insert: {
          id?: string
          motivo: string
          ref_month: string
          regravado_em?: string
          regravado_por: string
          resultado_antes?: number | null
          resultado_depois?: number | null
        }
        Update: {
          id?: string
          motivo?: string
          ref_month?: string
          regravado_em?: string
          regravado_por?: string
          resultado_antes?: number | null
          resultado_depois?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "monthly_snapshot_rewrites_regravado_por_fkey"
            columns: ["regravado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_snapshot_units: {
        Row: {
          bu: Database["public"]["Enums"]["business_unit"]
          custo_direto: number
          custo_folha: number
          custo_gastos: number
          custo_participacao: number
          custo_rateado: number
          imposto: number
          margem_pct: number | null
          proporcao_pct: number | null
          receita_bruta: number
          receita_liquida: number
          resultado: number
          snapshot_id: string
          taxas: number
        }
        Insert: {
          bu: Database["public"]["Enums"]["business_unit"]
          custo_direto: number
          custo_folha?: number
          custo_gastos?: number
          custo_participacao?: number
          custo_rateado: number
          imposto?: number
          margem_pct?: number | null
          proporcao_pct?: number | null
          receita_bruta: number
          receita_liquida: number
          resultado: number
          snapshot_id: string
          taxas?: number
        }
        Update: {
          bu?: Database["public"]["Enums"]["business_unit"]
          custo_direto?: number
          custo_folha?: number
          custo_gastos?: number
          custo_participacao?: number
          custo_rateado?: number
          imposto?: number
          margem_pct?: number | null
          proporcao_pct?: number | null
          receita_bruta?: number
          receita_liquida?: number
          resultado?: number
          snapshot_id?: string
          taxas?: number
        }
        Relationships: [
          {
            foreignKeyName: "monthly_snapshot_units_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "monthly_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_snapshots: {
        Row: {
          clientes_ativos: number | null
          created_at: string
          custo_compartilhado_nao_rateado: number
          custo_total: number | null
          id: string
          mrr_demanda: number | null
          mrr_firme_total: number | null
          mrr_sistemas: number | null
          receita_caixa: number | null
          receita_liquida: number | null
          ref_month: string
          resultado: number | null
          tcv_demanda: number | null
          tcv_sistemas: number | null
        }
        Insert: {
          clientes_ativos?: number | null
          created_at?: string
          custo_compartilhado_nao_rateado?: number
          custo_total?: number | null
          id?: string
          mrr_demanda?: number | null
          mrr_firme_total?: number | null
          mrr_sistemas?: number | null
          receita_caixa?: number | null
          receita_liquida?: number | null
          ref_month: string
          resultado?: number | null
          tcv_demanda?: number | null
          tcv_sistemas?: number | null
        }
        Update: {
          clientes_ativos?: number | null
          created_at?: string
          custo_compartilhado_nao_rateado?: number
          custo_total?: number | null
          id?: string
          mrr_demanda?: number | null
          mrr_firme_total?: number | null
          mrr_sistemas?: number | null
          receita_caixa?: number | null
          receita_liquida?: number | null
          ref_month?: string
          resultado?: number | null
          tcv_demanda?: number | null
          tcv_sistemas?: number | null
        }
        Relationships: []
      }
      motivos_de_saida: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          ordem: number
          pipeline_id: string
          rotulo: string
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          ordem?: number
          pipeline_id: string
          rotulo: string
          tipo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          ordem?: number
          pipeline_id?: string
          rotulo?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "motivos_de_saida_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_log: {
        Row: {
          assunto: string
          chave: string
          criado_em: string
          destinatario_email: string
          destinatario_id: string
          enviado_em: string | null
          erro: string | null
          id: string
          tipo: Database["public"]["Enums"]["notification_kind"]
        }
        Insert: {
          assunto: string
          chave: string
          criado_em?: string
          destinatario_email: string
          destinatario_id: string
          enviado_em?: string | null
          erro?: string | null
          id?: string
          tipo: Database["public"]["Enums"]["notification_kind"]
        }
        Update: {
          assunto?: string
          chave?: string
          criado_em?: string
          destinatario_email?: string
          destinatario_id?: string
          enviado_em?: string | null
          erro?: string | null
          id?: string
          tipo?: Database["public"]["Enums"]["notification_kind"]
        }
        Relationships: [
          {
            foreignKeyName: "notification_log_destinatario_id_fkey"
            columns: ["destinatario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          ativo: boolean
          atualizado_em: string
          profile_id: string
          tipo: Database["public"]["Enums"]["notification_kind"]
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          profile_id: string
          tipo: Database["public"]["Enums"]["notification_kind"]
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          profile_id?: string
          tipo?: Database["public"]["Enums"]["notification_kind"]
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          attribution_id: string | null
          business_unit: Database["public"]["Enums"]["business_unit"] | null
          campos: Json
          channel: Database["public"]["Enums"]["acquisition_channel"] | null
          closed_mrr: number | null
          closed_tcv: number | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          em_nutricao: boolean
          estimated_value: number | null
          expected_fronts: Database["public"]["Enums"]["service_front"][]
          id: string
          importado_em: string | null
          landing_url: string | null
          lead_source: string | null
          motivo_id: string | null
          motivo_obs: string | null
          name: string
          next_followup_at: string | null
          nicho: string | null
          notes: string | null
          nutrir_ate: string | null
          owner_id: string | null
          pipeline_id: string
          r1_agendada_em: string | null
          r1_realizada_em: string | null
          r2_agendada_em: string | null
          r2_realizada_em: string | null
          referred_by: string | null
          segment: string | null
          stage: Database["public"]["Enums"]["opportunity_stage"]
          stage_changed_at: string
          stage_id: string
          updated_at: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          attribution_id?: string | null
          business_unit?: Database["public"]["Enums"]["business_unit"] | null
          campos?: Json
          channel?: Database["public"]["Enums"]["acquisition_channel"] | null
          closed_mrr?: number | null
          closed_tcv?: number | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          em_nutricao?: boolean
          estimated_value?: number | null
          expected_fronts?: Database["public"]["Enums"]["service_front"][]
          id?: string
          importado_em?: string | null
          landing_url?: string | null
          lead_source?: string | null
          motivo_id?: string | null
          motivo_obs?: string | null
          name: string
          next_followup_at?: string | null
          nicho?: string | null
          notes?: string | null
          nutrir_ate?: string | null
          owner_id?: string | null
          pipeline_id?: string
          r1_agendada_em?: string | null
          r1_realizada_em?: string | null
          r2_agendada_em?: string | null
          r2_realizada_em?: string | null
          referred_by?: string | null
          segment?: string | null
          stage?: Database["public"]["Enums"]["opportunity_stage"]
          stage_changed_at?: string
          stage_id?: string
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          attribution_id?: string | null
          business_unit?: Database["public"]["Enums"]["business_unit"] | null
          campos?: Json
          channel?: Database["public"]["Enums"]["acquisition_channel"] | null
          closed_mrr?: number | null
          closed_tcv?: number | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          em_nutricao?: boolean
          estimated_value?: number | null
          expected_fronts?: Database["public"]["Enums"]["service_front"][]
          id?: string
          importado_em?: string | null
          landing_url?: string | null
          lead_source?: string | null
          motivo_id?: string | null
          motivo_obs?: string | null
          name?: string
          next_followup_at?: string | null
          nicho?: string | null
          notes?: string | null
          nutrir_ate?: string | null
          owner_id?: string | null
          pipeline_id?: string
          r1_agendada_em?: string | null
          r1_realizada_em?: string | null
          r2_agendada_em?: string | null
          r2_realizada_em?: string | null
          referred_by?: string | null
          segment?: string | null
          stage?: Database["public"]["Enums"]["opportunity_stage"]
          stage_changed_at?: string
          stage_id?: string
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_motivo_id_fkey"
            columns: ["motivo_id"]
            isOneToOne: false
            referencedRelation: "motivos_de_saida"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_events: {
        Row: {
          actor_id: string | null
          content: string | null
          conteudo_original: string | null
          created_at: string
          editado_em: string | null
          editado_por: string | null
          event_type: Database["public"]["Enums"]["opportunity_event_type"]
          from_stage: Database["public"]["Enums"]["opportunity_stage"] | null
          id: string
          opportunity_id: string
          to_stage: Database["public"]["Enums"]["opportunity_stage"] | null
        }
        Insert: {
          actor_id?: string | null
          content?: string | null
          conteudo_original?: string | null
          created_at?: string
          editado_em?: string | null
          editado_por?: string | null
          event_type: Database["public"]["Enums"]["opportunity_event_type"]
          from_stage?: Database["public"]["Enums"]["opportunity_stage"] | null
          id?: string
          opportunity_id: string
          to_stage?: Database["public"]["Enums"]["opportunity_stage"] | null
        }
        Update: {
          actor_id?: string | null
          content?: string | null
          conteudo_original?: string | null
          created_at?: string
          editado_em?: string | null
          editado_por?: string | null
          event_type?: Database["public"]["Enums"]["opportunity_event_type"]
          from_stage?: Database["public"]["Enums"]["opportunity_stage"] | null
          id?: string
          opportunity_id?: string
          to_stage?: Database["public"]["Enums"]["opportunity_stage"] | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_events_editado_por_fkey"
            columns: ["editado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_events_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_method_fees: {
        Row: {
          fixed_fee: number
          installable: boolean
          method: Database["public"]["Enums"]["payment_method"]
          settlement: string | null
          variable_pct: number
        }
        Insert: {
          fixed_fee?: number
          installable?: boolean
          method: Database["public"]["Enums"]["payment_method"]
          settlement?: string | null
          variable_pct?: number
        }
        Update: {
          fixed_fee?: number
          installable?: boolean
          method?: Database["public"]["Enums"]["payment_method"]
          settlement?: string | null
          variable_pct?: number
        }
        Relationships: []
      }
      payroll: {
        Row: {
          active: boolean
          benefits: number
          business_unit: Database["public"]["Enums"]["business_unit"]
          commission_pct: number | null
          created_at: string
          deactivated_at: string | null
          end_date: string | null
          id: string
          job_title: string | null
          monthly_cost: number
          person_name: string
          profile_id: string | null
          start_date: string
          work_kind: Database["public"]["Enums"]["work_kind"]
        }
        Insert: {
          active?: boolean
          benefits?: number
          business_unit: Database["public"]["Enums"]["business_unit"]
          commission_pct?: number | null
          created_at?: string
          deactivated_at?: string | null
          end_date?: string | null
          id?: string
          job_title?: string | null
          monthly_cost?: number
          person_name: string
          profile_id?: string | null
          start_date: string
          work_kind: Database["public"]["Enums"]["work_kind"]
        }
        Update: {
          active?: boolean
          benefits?: number
          business_unit?: Database["public"]["Enums"]["business_unit"]
          commission_pct?: number | null
          created_at?: string
          deactivated_at?: string | null
          end_date?: string | null
          id?: string
          job_title?: string | null
          monthly_cost?: number
          person_name?: string
          profile_id?: string | null
          start_date?: string
          work_kind?: Database["public"]["Enums"]["work_kind"]
        }
        Relationships: [
          {
            foreignKeyName: "payroll_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_saidas: {
        Row: {
          id: string
          payroll_id: string
          saiu_em: string
          voltou_em: string | null
        }
        Insert: {
          id?: string
          payroll_id: string
          saiu_em?: string
          voltou_em?: string | null
        }
        Update: {
          id?: string
          payroll_id?: string
          saiu_em?: string
          voltou_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_saidas_payroll_id_fkey"
            columns: ["payroll_id"]
            isOneToOne: false
            referencedRelation: "payroll"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_campos: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          obrigatorio: boolean
          opcoes: string[] | null
          ordem: number
          pipeline_id: string
          tipo: Database["public"]["Enums"]["pipeline_campo_tipo"]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          obrigatorio?: boolean
          opcoes?: string[] | null
          ordem: number
          pipeline_id: string
          tipo: Database["public"]["Enums"]["pipeline_campo_tipo"]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          obrigatorio?: boolean
          opcoes?: string[] | null
          ordem?: number
          pipeline_id?: string
          tipo?: Database["public"]["Enums"]["pipeline_campo_tipo"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_campos_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stages: {
        Row: {
          created_at: string
          id: string
          nome: string
          ordem: number
          pipeline_id: string
          tipo: Database["public"]["Enums"]["opportunity_stage"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          ordem: number
          pipeline_id: string
          tipo: Database["public"]["Enums"]["opportunity_stage"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          pipeline_id?: string
          tipo?: Database["public"]["Enums"]["opportunity_stage"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      pipelines: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          ordem: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          updated_at?: string
        }
        Relationships: []
      }
      playbook_sections: {
        Row: {
          area: Database["public"]["Enums"]["playbook_area"]
          content: string
          created_at: string
          id: string
          sort_order: number
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          area: Database["public"]["Enums"]["playbook_area"]
          content: string
          created_at?: string
          id?: string
          sort_order?: number
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          area?: Database["public"]["Enums"]["playbook_area"]
          content?: string
          created_at?: string
          id?: string
          sort_order?: number
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "playbook_sections_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          business_unit: Database["public"]["Enums"]["business_unit"]
          combo_fronts: Database["public"]["Enums"]["service_front"][] | null
          contract_type: Database["public"]["Enums"]["contract_type"]
          created_at: string
          description: string | null
          front: Database["public"]["Enums"]["service_front"]
          id: string
          name: string
          price: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          business_unit: Database["public"]["Enums"]["business_unit"]
          combo_fronts?: Database["public"]["Enums"]["service_front"][] | null
          contract_type: Database["public"]["Enums"]["contract_type"]
          created_at?: string
          description?: string | null
          front: Database["public"]["Enums"]["service_front"]
          id?: string
          name: string
          price: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          business_unit?: Database["public"]["Enums"]["business_unit"]
          combo_fronts?: Database["public"]["Enums"]["service_front"][] | null
          contract_type?: Database["public"]["Enums"]["contract_type"]
          created_at?: string
          description?: string | null
          front?: Database["public"]["Enums"]["service_front"]
          id?: string
          name?: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          initials: string | null
          job_title: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name: string
          id: string
          initials?: string | null
          job_title?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          initials?: string | null
          job_title?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      proposal_items: {
        Row: {
          business_unit: Database["public"]["Enums"]["business_unit"]
          combo_fronts: Database["public"]["Enums"]["service_front"][] | null
          contract_id: string | null
          contract_type: Database["public"]["Enums"]["contract_type"]
          created_at: string
          descricao: string | null
          front: Database["public"]["Enums"]["service_front"]
          id: string
          nome: string
          ordem: number
          preco_catalogo: number
          product_id: string | null
          proposal_id: string
          valor: number
        }
        Insert: {
          business_unit?: Database["public"]["Enums"]["business_unit"]
          combo_fronts?: Database["public"]["Enums"]["service_front"][] | null
          contract_id?: string | null
          contract_type?: Database["public"]["Enums"]["contract_type"]
          created_at?: string
          descricao?: string | null
          front?: Database["public"]["Enums"]["service_front"]
          id?: string
          nome?: string
          ordem?: number
          preco_catalogo?: number
          product_id?: string | null
          proposal_id: string
          valor?: number
        }
        Update: {
          business_unit?: Database["public"]["Enums"]["business_unit"]
          combo_fronts?: Database["public"]["Enums"]["service_front"][] | null
          contract_id?: string | null
          contract_type?: Database["public"]["Enums"]["contract_type"]
          created_at?: string
          descricao?: string | null
          front?: Database["public"]["Enums"]["service_front"]
          id?: string
          nome?: string
          ordem?: number
          preco_catalogo?: number
          product_id?: string | null
          proposal_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposal_items_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_items_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          aceita_em: string | null
          aceita_por: string | null
          created_at: string
          created_by: string | null
          enviada_em: string | null
          enviada_por: string | null
          escopo: string | null
          fidelidade_meses: number | null
          forma_pagamento: Database["public"]["Enums"]["payment_method"]
          id: string
          numero: number
          opportunity_id: string
          origem_id: string | null
          parcelas_projeto: number | null
          prazo_entrega_dias: number | null
          recusada_em: string | null
          status: Database["public"]["Enums"]["proposal_status"]
          updated_at: string
          valida_ate: string
          versao: number
        }
        Insert: {
          aceita_em?: string | null
          aceita_por?: string | null
          created_at?: string
          created_by?: string | null
          enviada_em?: string | null
          enviada_por?: string | null
          escopo?: string | null
          fidelidade_meses?: number | null
          forma_pagamento?: Database["public"]["Enums"]["payment_method"]
          id?: string
          numero?: number
          opportunity_id: string
          origem_id?: string | null
          parcelas_projeto?: number | null
          prazo_entrega_dias?: number | null
          recusada_em?: string | null
          status?: Database["public"]["Enums"]["proposal_status"]
          updated_at?: string
          valida_ate?: string
          versao?: number
        }
        Update: {
          aceita_em?: string | null
          aceita_por?: string | null
          created_at?: string
          created_by?: string | null
          enviada_em?: string | null
          enviada_por?: string | null
          escopo?: string | null
          fidelidade_meses?: number | null
          forma_pagamento?: Database["public"]["Enums"]["payment_method"]
          id?: string
          numero?: number
          opportunity_id?: string
          origem_id?: string | null
          parcelas_projeto?: number | null
          prazo_entrega_dias?: number | null
          recusada_em?: string | null
          status?: Database["public"]["Enums"]["proposal_status"]
          updated_at?: string
          valida_ate?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposals_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_origem_id_fkey"
            columns: ["origem_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      qualification_answers: {
        Row: {
          answered_at: string
          answered_by: string | null
          catalog_version: number
          id: string
          is_ko: boolean
          opportunity_id: string
          option_index: number
          points: number
          question_key: string
        }
        Insert: {
          answered_at?: string
          answered_by?: string | null
          catalog_version?: number
          id?: string
          is_ko?: boolean
          opportunity_id: string
          option_index: number
          points: number
          question_key: string
        }
        Update: {
          answered_at?: string
          answered_by?: string | null
          catalog_version?: number
          id?: string
          is_ko?: boolean
          opportunity_id?: string
          option_index?: number
          points?: number
          question_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "qualification_answers_answered_by_fkey"
            columns: ["answered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qualification_answers_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_journeys: {
        Row: {
          client_id: string
          concluida_em: string | null
          created_at: string
          created_by: string | null
          dia_zero: string | null
          id: string
          iniciada_em: string
          template_versao: number
          updated_at: string
        }
        Insert: {
          client_id: string
          concluida_em?: string | null
          created_at?: string
          created_by?: string | null
          dia_zero?: string | null
          id?: string
          iniciada_em?: string
          template_versao: number
          updated_at?: string
        }
        Update: {
          client_id?: string
          concluida_em?: string | null
          created_at?: string
          created_by?: string | null
          dia_zero?: string | null
          id?: string
          iniciada_em?: string
          template_versao?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_journeys_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_journeys_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_health"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "onboarding_journeys_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_phases: {
        Row: {
          descricao: string
          id: string
          journey_id: string
          liberada_em: string | null
          nome: string
          ordem: number
          periodo: string
          responsavel: string
        }
        Insert: {
          descricao: string
          id?: string
          journey_id: string
          liberada_em?: string | null
          nome: string
          ordem: number
          periodo: string
          responsavel: string
        }
        Update: {
          descricao?: string
          id?: string
          journey_id?: string
          liberada_em?: string | null
          nome?: string
          ordem?: number
          periodo?: string
          responsavel?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_phases_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "onboarding_journeys"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_tasks: {
        Row: {
          category: string
          concluida_em: string | null
          deadline_days: number
          id: string
          internal_task_id: string | null
          ordem: number
          papel: string
          phase_id: string
          task_type: string
          titulo: string
        }
        Insert: {
          category: string
          concluida_em?: string | null
          deadline_days: number
          id?: string
          internal_task_id?: string | null
          ordem: number
          papel: string
          phase_id: string
          task_type: string
          titulo: string
        }
        Update: {
          category?: string
          concluida_em?: string | null
          deadline_days?: number
          id?: string
          internal_task_id?: string | null
          ordem?: number
          papel?: string
          phase_id?: string
          task_type?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_tasks_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "onboarding_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_tasks_internal_task_id_fkey"
            columns: ["internal_task_id"]
            isOneToOne: true
            referencedRelation: "internal_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_tasks_category_task_type_fkey"
            columns: ["category", "task_type"]
            isOneToOne: false
            referencedRelation: "task_catalog"
            referencedColumns: ["category", "task_type"]
          },
        ]
      }
      onboarding_template_phases: {
        Row: {
          descricao: string
          nome: string
          ordem: number
          periodo: string
          responsavel: string
          versao: number
        }
        Insert: {
          descricao: string
          nome: string
          ordem: number
          periodo: string
          responsavel: string
          versao: number
        }
        Update: {
          descricao?: string
          nome?: string
          ordem?: number
          periodo?: string
          responsavel?: string
          versao?: number
        }
        Relationships: []
      }
      onboarding_template_tasks: {
        Row: {
          category: string
          deadline_days: number
          fase_ordem: number
          ordem: number
          papel: string
          task_type: string
          titulo: string
          versao: number
        }
        Insert: {
          category?: string
          deadline_days: number
          fase_ordem: number
          ordem: number
          papel: string
          task_type: string
          titulo: string
          versao: number
        }
        Update: {
          category?: string
          deadline_days?: number
          fase_ordem?: number
          ordem?: number
          papel?: string
          task_type?: string
          titulo?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_template_tasks_papel_fkey"
            columns: ["papel"]
            isOneToOne: false
            referencedRelation: "role_assignments"
            referencedColumns: ["role_key"]
          },
          {
            foreignKeyName: "onboarding_template_tasks_category_task_type_fkey"
            columns: ["category", "task_type"]
            isOneToOne: false
            referencedRelation: "task_catalog"
            referencedColumns: ["category", "task_type"]
          },
          {
            foreignKeyName: "onboarding_template_tasks_versao_fase_ordem_fkey"
            columns: ["versao", "fase_ordem"]
            isOneToOne: false
            referencedRelation: "onboarding_template_phases"
            referencedColumns: ["versao", "ordem"]
          },
        ]
      }
      role_assignments: {
        Row: {
          profile_id: string | null
          role_key: string
          updated_at: string
        }
        Insert: {
          profile_id?: string | null
          role_key: string
          updated_at?: string
        }
        Update: {
          profile_id?: string | null
          role_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_assignments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      script_usage_log: {
        Row: {
          client_id: string | null
          id: string
          script_id: string | null
          used_at: string
          used_by: string | null
        }
        Insert: {
          client_id?: string | null
          id?: string
          script_id?: string | null
          used_at?: string
          used_by?: string | null
        }
        Update: {
          client_id?: string | null
          id?: string
          script_id?: string | null
          used_at?: string
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "script_usage_log_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "script_usage_log_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "scripts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "script_usage_log_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scripts: {
        Row: {
          active: boolean
          body: string
          canal: Database["public"]["Enums"]["script_channel"]
          created_at: string
          created_by: string | null
          id: string
          momento: Database["public"]["Enums"]["script_moment"]
          nicho: string
          pipeline_stage: Database["public"]["Enums"]["opportunity_stage"] | null
          sort_order: number
          tipo: Database["public"]["Enums"]["script_kind"]
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          body: string
          canal: Database["public"]["Enums"]["script_channel"]
          created_at?: string
          created_by?: string | null
          id?: string
          momento: Database["public"]["Enums"]["script_moment"]
          nicho?: string
          pipeline_stage?: Database["public"]["Enums"]["opportunity_stage"] | null
          sort_order?: number
          tipo: Database["public"]["Enums"]["script_kind"]
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          body?: string
          canal?: Database["public"]["Enums"]["script_channel"]
          created_at?: string
          created_by?: string | null
          id?: string
          momento?: Database["public"]["Enums"]["script_moment"]
          nicho?: string
          pipeline_stage?: Database["public"]["Enums"]["opportunity_stage"] | null
          sort_order?: number
          tipo?: Database["public"]["Enums"]["script_kind"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scripts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_catalog: {
        Row: {
          ativo: boolean
          category: string
          ordem: number
          task_type: string
        }
        Insert: {
          ativo?: boolean
          category: string
          ordem: number
          task_type: string
        }
        Update: {
          ativo?: boolean
          category?: string
          ordem?: number
          task_type?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_client_health: {
        Row: {
          client_id: string | null
          contratos_ativos: number | null
          proximo_fim_de_cobranca: string | null
          ultimo_evento_em: string | null
        }
        Insert: {
          client_id?: string | null
          contratos_ativos?: never
          proximo_fim_de_cobranca?: never
          ultimo_evento_em?: never
        }
        Update: {
          client_id?: string | null
          contratos_ativos?: never
          proximo_fim_de_cobranca?: never
          ultimo_evento_em?: never
        }
        Relationships: []
      }
    }
    Functions: {
      apagar_cliente: {
        Args: { p_client_id: string }
        Returns: {
          contratos_apagados: number
          jornadas_apagadas: number
          posts_apagados: number
        }[]
      }
      apagar_jornada: {
        Args: { p_journey_id: string }
        Returns: number
      }
      apagar_pipeline: {
        Args: { p_pipeline_id: string }
        Returns: undefined
      }
      bulk_update_opportunities: {
        Args: {
          p_alvos: Json
          p_owner_id?: string
          p_estagio_id?: string
          p_motivo_id?: string
          p_motivo_obs?: string
          p_campos?: Json
        }
        Returns: number
      }
      buscar_oportunidades_para_reuniao: {
        Args: {
          p_termo: string
        }
        Returns: {
          id: string
          name: string
        }[]
      }
      buscar_scripts: {
        Args: {
          p_tipo: Database["public"]["Enums"]["script_kind"]
          p_termo: string
          p_nicho?: string
          p_canal?: Database["public"]["Enums"]["script_channel"]
          p_momento?: Database["public"]["Enums"]["script_moment"]
        }
        Returns: {
          active: boolean
          body: string
          canal: Database["public"]["Enums"]["script_channel"]
          id: string
          momento: Database["public"]["Enums"]["script_moment"]
          nicho: string
          pipeline_stage: Database["public"]["Enums"]["opportunity_stage"] | null
          sort_order: number
          tipo: Database["public"]["Enums"]["script_kind"]
          title: string
          updated_at: string
        }[]
      }
      buscar_secoes_playbook: {
        Args: { p_termo: string }
        Returns: {
          area: Database["public"]["Enums"]["playbook_area"]
          content: string
          id: string
          sort_order: number
          title: string
          updated_at: string
        }[]
      }
      create_pipeline: { Args: { p_nome: string; p_estagios: Json }; Returns: string }
      current_app_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      definir_entrega: {
        Args: { p_contract_id: string; p_data?: string }
        Returns: undefined
      }
      desfazer_fechamento: {
        Args: { p_motivo: string; p_opportunity_id: string }
        Returns: {
          contratos_apagados: number
          estagio_restaurado: string | null
        }[]
      }
      devolver_limite_recuperacao: {
        Args: { p_chave: string; p_janela: string }
        Returns: undefined
      }
      editar_etapa_da_jornada: {
        Args: { p_descricao: string; p_phase_id: string; p_responsavel: string }
        Returns: undefined
      }
      editar_item_da_jornada: {
        Args: { p_item_id: string; p_papel: string; p_prazo_em_dias: number; p_titulo: string }
        Returns: undefined
      }
      encerrar_tcv_vencido: {
        Args: never
        Returns: {
          fechados: number
        }[]
      }
      enviar_proposta: {
        Args: { p_id: string }
        Returns: undefined
      }
      get_break_even: {
        Args: { p_ref_month: string }
        Returns: {
          clientes_para_pagar: number | null
          contratos_mrr: number
          custo_fixo_total: number
          mrr_firme_total: number
          ticket_medio_bruto: number
          ticket_medio_mrr: number
        }[]
      }
      get_cash_revenue_by_unit: {
        Args: { p_ref_month: string }
        Returns: {
          bruto: number
          bu: Database["public"]["Enums"]["business_unit"]
          contratos: number
          imposto: number
          liquido: number
          taxas: number
        }[]
      }
      get_closed_by_opportunity: {
        Args: never
        Returns: {
          closed_mrr: number
          closed_tcv: number
          opportunity_id: string
        }[]
      }
      get_closings_by_campaign: {
        Args: never
        Returns: {
          campanha: string
          canal: string
          cancelados: number
          contratos: number
          origem: string
        }[]
      }
      get_contract_closings: {
        Args: never
        Returns: {
          business_unit: Database["public"]["Enums"]["business_unit"]
          cliente: string
          contract_id: string
          contrato: string
          fechado_em: string
          motivo: string
          total_value: number | null
        }[]
      }
      get_contratos_a_criar: {
        Args: { p_client_id: string }
        Returns: {
          business_unit: Database["public"]["Enums"]["business_unit"]
          contract_type: Database["public"]["Enums"]["contract_type"]
          fidelidade_meses: number | null
          forma_pagamento: Database["public"]["Enums"]["payment_method"]
          numero: number
          opportunity_id: string
          parcelas_projeto: number | null
          prazo_entrega_dias: number | null
          proposta_id: string
          valor: number
          versao: number
        }[]
      }
      get_cost_by_unit: {
        Args: { p_ref_month: string }
        Returns: {
          bu: Database["public"]["Enums"]["business_unit"]
          custo_folha: number
          custo_gastos: number
          custo_total: number
          despesas: number
          pessoas: number
        }[]
      }
      get_cost_drop: {
        Args: never
        Returns: {
          custo_depois: number
          custo_no_mes_do_fim: number
          despesas: number
          mes_fim: string
          valor_que_sai: number
        }[]
      }
      get_cost_projection: {
        Args: never
        Returns: {
          custo_compartilhado: number
          custo_demanda: number
          custo_folha: number
          custo_gastos: number
          custo_sistemas: number
          custo_total: number
          despesas: number
          folha_compartilhado: number
          folha_demanda: number
          folha_sistemas: number
          mes: string
          pessoas_na_folha: number
        }[]
      }
      get_delayed_projects: {
        Args: never
        Returns: {
          cliente: string
          delivery_deadline: string
          dias_atraso: number
          id: string
          meses_extra: number
          parcela_mensal: number
          projeto: string
          total_value: number
        }[]
      }
      get_expenses_effective: {
        Args: never
        Returns: {
          agrupador: string | null
          agrupador_id: string | null
          bu: Database["public"]["Enums"]["business_unit"]
          categoria: Database["public"]["Enums"]["expense_category"]
          descricao: string
          expense_id: string
          fim: string | null
          fornecedor: string | null
          inicio: string
          meio_de_pagamento: string | null
          mes_referencia: string
          parcelas_pagas: number | null
          parcelas_restantes: number | null
          parcelas_total: number | null
          recorrencia: Database["public"]["Enums"]["expense_recurrence"]
          total_do_agrupador: number | null
          ultima_parcela_em: string | null
          valor: number
        }[]
      }
      get_funnel_by_channel: {
        Args: { p_desde?: string }
        Returns: {
          canal: string
          estagio: Database["public"]["Enums"]["opportunity_stage"]
          oportunidades: number
          oportunidades_no_canal: number
        }[]
      }
      get_metas: {
        Args: never
        Returns: {
          confirmado: boolean
          r1_semana: number | null
          toques_semana: number | null
        }[]
      }
      get_metas_financeiras: {
        Args: never
        Returns: {
          confirmado: boolean
          mrr_mensal: number | null
          tcv_alvo: number | null
        }[]
      }
      get_mrr_by_unit: {
        Args: never
        Returns: {
          bu: Database["public"]["Enums"]["business_unit"]
          contratos: number
          mrr_firme: number | null
          mrr_total: number
        }[]
      }
      get_net_revenue: {
        Args: never
        Returns: {
          bruto: number
          bu: Database["public"]["Enums"]["business_unit"]
          client_id: string
          cliente: string
          contract_id: string
          contract_type: Database["public"]["Enums"]["contract_type"]
          contrato: string
          fatura_no_mes: boolean
          imposto: number
          imposto_pct: number
          is_provisional: boolean
          liquido: number
          parcelas: number
          payment_method: Database["public"]["Enums"]["payment_method"]
          taxa_fixa: number
          taxa_variavel: number
          taxa_variavel_pct: number
        }[]
      }
      get_net_revenue_total: {
        Args: never
        Returns: {
          bruto: number
          contratos: number
          deducoes: number
          liquido: number
        }[]
      }
      get_opportunity_mix: {
        Args: never
        Returns: {
          canal: string
          nicho: string
          oportunidades: number
          tier: string
        }[]
      }
      get_origens_dos_clientes: {
        Args: never
        Returns: {
          client_id: string
          opportunity_id: string
          opportunity_name: string
        }[]
      }
      get_payroll_cost: {
        Args: never
        Returns: {
          bu: Database["public"]["Enums"]["business_unit"]
          custo_fixo: number
          mes_referencia: string
          pessoas: number
        }[]
      }
      get_primeiro_contato: {
        Args: { p_ids: string[] }
        Returns: {
          opportunity_id: string
          primeiro_toque_em: string | null
          vence_em: string | null
        }[]
      }
      get_propostas_da_oportunidade: {
        Args: { p_opportunity_id: string }
        Returns: {
          aceita_em: string | null
          cliente_id: string | null
          created_at: string
          enviada_em: string | null
          escopo: string | null
          fidelidade_meses: number | null
          forma_pagamento: Database["public"]["Enums"]["payment_method"]
          id: string
          numero: number
          parcelas_projeto: number | null
          prazo_entrega_dias: number | null
          recusada_em: string | null
          status: Database["public"]["Enums"]["proposal_status"]
          total_mensal: number
          total_projeto: number
          ultima: boolean
          valida_ate: string
          vencida: boolean
          versao: number
        }[]
      }
      get_result_by_unit: {
        Args: { p_ref_month: string }
        Returns: {
          bu: Database["public"]["Enums"]["business_unit"]
          congelado: boolean
          custo_direto: number
          custo_folha: number
          custo_gastos: number
          custo_participacao: number
          custo_rateado: number
          imposto: number
          margem_pct: number | null
          proporcao_pct: number | null
          receita_bruta: number
          receita_liquida: number
          resultado: number
          taxas: number
        }[]
      }
      get_result_history: {
        Args: { p_meses?: number }
        Returns: {
          congelado: boolean
          custo_total: number
          mes: string
          parcial: boolean
          receita_liquida: number
          resultado: number
        }[]
      }
      get_result_total: {
        Args: { p_ref_month: string }
        Returns: {
          congelado: boolean
          custo_compartilhado_nao_rateado: number
          custo_direto: number
          custo_rateado: number
          custo_total: number
          imposto: number
          margem_pct: number | null
          receita_bruta: number
          receita_liquida: number
          resultado: number
          taxas: number
        }[]
      }
      get_revenue_by_front: {
        Args: never
        Returns: {
          bu: Database["public"]["Enums"]["business_unit"]
          caixa_mes: number
          front: Database["public"]["Enums"]["service_front"]
          mrr_mensal: number
          tcv_total: number
        }[]
      }
      get_share_cost: {
        Args: never
        Returns: {
          beneficiario: string
          bu: Database["public"]["Enums"]["business_unit"]
          client_id: string
          contract_id: string
          custo_mes: number
          kind: Database["public"]["Enums"]["share_kind"]
          share_pct: number
        }[]
      }
      get_tcv_by_unit: {
        Args: never
        Returns: {
          bu: Database["public"]["Enums"]["business_unit"]
          projetos: number
          tcv_total: number
        }[]
      }
      get_team_cost: {
        Args: never
        Returns: {
          ativa: boolean
          beneficios: number
          bu: Database["public"]["Enums"]["business_unit"]
          cargo: string | null
          chave: string
          contratos_com_participacao: number
          custo_fixo: number
          custo_mensal: number
          custo_total: number
          custo_variavel: number
          fim: string | null
          inicio: string | null
          participacao_sem_linha: boolean
          payroll_id: string | null
          pessoa: string
          profile_id: string | null
          vinculo: Database["public"]["Enums"]["work_kind"] | null
        }[]
      }
      get_tempo_ate_primeiro_contato: {
        Args: { p_desde?: string }
        Returns: {
          canal: string
          com_prazo_medido: number
          contatados: number
          mediana_min: number | null
          no_prazo: number
          novos: number
        }[]
      }
      get_weekly_activity: {
        Args: { p_desde?: string }
        Returns: {
          r1_distintas_na_semana: number
          r1_marcadas: number
          responsavel: string
          responsavel_id: string | null
          semana: string
          toques: number
        }[]
      }
      gravar_snapshot: {
        Args: { p_ref_month: string }
        Returns: {
          gravou: boolean
          mes_gravado: string
          resultado_do_mes: number | null
        }[]
      }
      horarios_ocupados: {
        Args: {
          p_fim: string
          p_inicio: string
          p_profiles: string[]
          p_excluir_reuniao?: string
        }
        Returns: { profile_id: string }[]
      }
      import_opportunities: {
        Args: { p_pipeline_id: string; p_linhas: Json; p_previa?: boolean }
        Returns: {
          acao: string
          aviso: string | null
          linha: number
          motivo: string | null
          opportunity_id: string | null
        }[]
      }
      iniciar_jornada: {
        Args: { p_client_id: string; p_versao?: number }
        Returns: string
      }
      is_owner: { Args: never; Returns: boolean }
      ler_eventos_de_seguranca: {
        Args: { p_limite?: number; p_antes_de?: string }
        Returns: {
          id: number
          occurred_at: string
          actor_id: string | null
          actor_ip: string | null
          event: string
          target: string | null
          details: Json
        }[]
      }
      liberar_etapa: {
        Args: { p_forcar?: boolean; p_phase_id: string }
        Returns: number
      }
      is_staff: { Args: never; Returns: boolean }
      limite_anonimo: {
        Args: { p_bucket: string; p_ip: string; p_limite?: number; p_janela_s?: number }
        Returns: boolean
      }
      limite_do_usuario: {
        Args: { p_uid: string; p_bucket: string; p_limite: number; p_janela_s: number }
        Returns: boolean
      }
      link_attribution: {
        Args: { p_attribution_id: string; p_opportunity_id: string }
        Returns: Json
      }
      listar_ganhas_sem_contrato: {
        Args: never
        Returns: {
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          ganha_em: string
          id: string
          name: string
          nicho: string | null
          segment: string | null
        }[]
      }
      mover_post: {
        Args: {
          p_de: Database["public"]["Enums"]["post_status"]
          p_link?: string
          p_nota?: string
          p_para: Database["public"]["Enums"]["post_status"]
          p_post_id: string
        }
        Returns: undefined
      }
      nova_versao_proposta: {
        Args: { p_id: string }
        Returns: string
      }
      opportunity_tier: { Args: { p_opportunity_id: string }; Returns: string }
      participa_da_tarefa: {
        Args: { p_task_id: string }
        Returns: boolean
      }
      pode_apagar_cartao: {
        Args: { p_task_id: string }
        Returns: boolean
      }
      pode_editar_tarefa: {
        Args: { p_task_id: string }
        Returns: boolean
      }
      pode_gerir_participantes: {
        Args: { p_task_id: string }
        Returns: boolean
      }
      pode_ver_propostas: {
        Args: { p_opportunity_id: string }
        Returns: boolean
      }
      pode_ver_reuniao: {
        Args: { p_meeting_id: string }
        Returns: boolean
      }
      primeiros_contatos_vencidos: {
        Args: never
        Returns: {
          canal: Database["public"]["Enums"]["acquisition_channel"]
          nome: string
          opportunity_id: string
          owner_id: string | null
          vence_em: string
        }[]
      }
      recusar_proposta: {
        Args: { p_id: string }
        Returns: undefined
      }
      registrar_contato_da_landing: {
        Args: { p_contato: Json }
        Returns: Json
      }
      registrar_contrato_da_proposta: {
        Args: { p_contract_id: string; p_id: string }
        Returns: undefined
      }
      registrar_evento_de_seguranca: {
        Args: { p_evento: string; p_alvo?: string; p_detalhes?: Json; p_ip?: string }
        Returns: boolean
      }
      regravar_snapshot: {
        Args: { p_motivo: string; p_ref_month: string }
        Returns: {
          regravou: boolean
          resultado_antes: number
          resultado_depois: number
        }[]
      }
      registrar_toque: { Args: { p_toque: Json }; Returns: Json }
      reservar_limite_recuperacao: {
        Args: { p_chave: string; p_limite: number; p_janela_s: number }
        Returns: string | null
      }
      resumo_de_seguranca: { Args: { p_dias?: number }; Returns: Json }
      reverter_encerramento: {
        Args: { p_contract_id: string }
        Returns: undefined
      }
      save_contract: {
        Args: {
          p_billing_active?: boolean
          p_billing_months?: number
          p_bu: Database["public"]["Enums"]["business_unit"]
          p_client_id: string
          p_commitment_months?: number
          p_contract_id?: string
          p_delivery_deadline?: string
          p_duration_months?: number
          p_end_date?: string
          p_installments?: number
          p_is_commissionable?: boolean
          p_is_firm?: boolean
          p_items: Json
          p_monthly?: number
          p_name: string
          p_notes?: string
          p_opportunity_id?: string
          p_pause_reason?: string
          p_payment_method?: Database["public"]["Enums"]["payment_method"]
          p_start_date: string
          p_status?: Database["public"]["Enums"]["contract_status"]
          p_total?: number
          p_type: Database["public"]["Enums"]["contract_type"]
        }
        Returns: string
      }
      save_contract_shares: {
        Args: { p_contract_id: string; p_shares: Json }
        Returns: {
          contract_id: string
          created_at: string
          external_name: string | null
          id: string
          kind: Database["public"]["Enums"]["share_kind"]
          profile_id: string | null
          share_pct: number
        }[]
      }
      save_pipeline_stages: {
        Args: { p_pipeline_id: string; p_estagios: Json }
        Returns: undefined
      }
      sp_month_start: { Args: { p_when?: string }; Returns: string }
      sp_today: { Args: never; Returns: string }
      sp_week_start: { Args: { p_when?: string }; Returns: string }
      tarefa_sem_evento_de_conteudo: {
        Args: { p_task_id: string }
        Returns: boolean
      }
      ve_folha: { Args: never; Returns: boolean }
    }
    Enums: {
      acquisition_channel: "indicacao" | "pago" | "inbound" | "outbound"
      app_role: "owner" | "manager" | "member" | "client"
      business_unit: "demanda" | "sistemas" | "compartilhado"
      client_status: "onboarding" | "active" | "paused" | "churned"
      contract_status: "active" | "paused" | "cancelled" | "finished"
      contract_type: "mrr" | "tcv"
      expense_category:
        | "estrutural"
        | "operacional"
        | "pessoal_socio"
        | "divida"
        | "imposto"
      expense_recurrence: "mensal" | "parcelado" | "pontual"
      meeting_type:
        | "kickoff_cliente"
        | "semanal_cliente"
        | "alinhamento_cliente"
        | "apresentacao_de_resultados"
        | "renovacao_ou_upsell"
        | "interna_de_time"
        | "semanal_de_time"
        | "quinzenal_de_time"
        | "planejamento"
        | "retrospectiva"
        | "um_a_um"
        | "onboarding_de_colaborador"
        | "entregas_do_cliente"
        | "alinhamento_interno_sobre_cliente"
        | "proposta_para_prospect"
      notification_kind:
        | "digest"
        | "tarefa_d1"
        | "tarefa_vencida"
        | "onboarding_parado"
        | "lead_frio"
        | "contrato_vencendo"
        | "tcv_encerrado"
        | "nutricao_vencida"
        | "seguranca_semanal"
        | "primeiro_contato_vencido"
      opportunity_event_type:
        | "stage_change"
        | "note"
        | "call"
        | "meeting"
        | "proposal_sent"
        | "whatsapp"
      opportunity_stage:
        | "prospeccao"
        | "abordagem"
        | "qualificacao"
        | "r1"
        | "r2"
        | "fechado"
        | "perdido"
        | "descartado"
      payment_method: "pix" | "credito" | "transferencia"
      pipeline_campo_tipo: "texto" | "sim_nao" | "lista" | "numero"
      playbook_area: "comercial" | "marketing" | "gestao"
      post_channel: "instagram" | "facebook"
      post_format: "reel" | "carrossel" | "estatico" | "story"
      post_status:
        | "rascunho"
        | "em_aprovacao"
        | "ajuste_pedido"
        | "aprovado"
        | "agendado"
        | "publicado"
      proposal_status: "rascunho" | "enviada" | "aceita" | "recusada"
      script_channel: "whatsapp" | "email" | "linkedin" | "cold_call" | "reuniao"
      script_kind: "sdr" | "closer"
      script_moment:
        | "primeiro_contato"
        | "follow_up"
        | "quebra_objecao"
        | "abertura"
        | "proposta"
        | "objecao"
        | "fechamento"
      service_front: "posicionamento" | "trafego" | "comercial" | "sistemas"
      share_kind: "venda" | "producao" | "indicacao"
      task_col: "todo" | "doing" | "review" | "done"
      task_priority: "baixa" | "media" | "alta" | "urgente"
      task_recurrence: "nenhuma" | "semanal" | "quinzenal" | "mensal"
      work_kind: "clt" | "pj" | "estagio" | "freela" | "socio" | "comissionado"
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
      acquisition_channel: ["indicacao", "pago", "inbound", "outbound"],
      app_role: ["owner", "manager", "member", "client"],
      business_unit: ["demanda", "sistemas", "compartilhado"],
      client_status: ["onboarding", "active", "paused", "churned"],
      contract_status: ["active", "paused", "cancelled", "finished"],
      contract_type: ["mrr", "tcv"],
      expense_category: [
        "estrutural",
        "operacional",
        "pessoal_socio",
        "divida",
        "imposto",
      ],
      expense_recurrence: ["mensal", "parcelado", "pontual"],
      meeting_type: [
        "kickoff_cliente",
        "semanal_cliente",
        "alinhamento_cliente",
        "apresentacao_de_resultados",
        "renovacao_ou_upsell",
        "interna_de_time",
        "semanal_de_time",
        "quinzenal_de_time",
        "planejamento",
        "retrospectiva",
        "um_a_um",
        "onboarding_de_colaborador",
        "entregas_do_cliente",
        "alinhamento_interno_sobre_cliente",
        "proposta_para_prospect",
      ],
      notification_kind: [
        "digest",
        "tarefa_d1",
        "tarefa_vencida",
        "onboarding_parado",
        "lead_frio",
        "contrato_vencendo",
        "tcv_encerrado",
        "nutricao_vencida",
        "seguranca_semanal",
        "primeiro_contato_vencido",
      ],
      opportunity_event_type: [
        "stage_change",
        "note",
        "call",
        "meeting",
        "proposal_sent",
        "whatsapp",
      ],
      opportunity_stage: [
        "prospeccao",
        "abordagem",
        "qualificacao",
        "r1",
        "r2",
        "fechado",
        "perdido",
        "descartado",
      ],
      payment_method: ["pix", "credito", "transferencia"],
      pipeline_campo_tipo: ["texto", "sim_nao", "lista", "numero"],
      playbook_area: ["comercial", "marketing", "gestao"],
      post_channel: ["instagram", "facebook"],
      post_format: ["reel", "carrossel", "estatico", "story"],
      post_status: [
        "rascunho",
        "em_aprovacao",
        "ajuste_pedido",
        "aprovado",
        "agendado",
        "publicado",
      ],
      proposal_status: ["rascunho", "enviada", "aceita", "recusada"],
      script_channel: ["whatsapp", "email", "linkedin", "cold_call", "reuniao"],
      script_kind: ["sdr", "closer"],
      script_moment: [
        "primeiro_contato",
        "follow_up",
        "quebra_objecao",
        "abertura",
        "proposta",
        "objecao",
        "fechamento",
      ],
      service_front: ["posicionamento", "trafego", "comercial", "sistemas"],
      share_kind: ["venda", "producao", "indicacao"],
      task_col: ["todo", "doing", "review", "done"],
      task_priority: ["baixa", "media", "alta", "urgente"],
      task_recurrence: ["nenhuma", "semanal", "quinzenal", "mensal"],
      work_kind: ["clt", "pj", "estagio", "freela", "socio", "comissionado"],
    },
  },
} as const
