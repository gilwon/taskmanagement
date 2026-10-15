// Supabase CLI가 로컬 DB 스키마에서 생성한 타입이다. 직접 고치지 말고 pnpm db:types로 다시 만든다

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
            "activities": {
                  Row: {
                    "actor_id": string | null,"created_at": string,"extra": NonNullable<Json>,"id": string,"project_id": string,"task_id": string | null,"verb": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"created_at"?: string,"extra"?: NonNullable<Json>,"id"?: string,"project_id": string,"task_id"?: string | null,"verb": string,"workspace_id": string
                  }
                  Update: {
                    "actor_id"?: string | null,"created_at"?: string,"extra"?: NonNullable<Json>,"id"?: string,"project_id"?: string,"task_id"?: string | null,"verb"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "activities_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activities_project_id_workspace_id_fkey"
      columns: ["project_id","workspace_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id","workspace_id"]
    },{
      foreignKeyName: "activities_task_id_project_id_fkey"
      columns: ["task_id","project_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id","project_id"]
    }
                  ]
                },"comment_reactions": {
                  Row: {
                    "comment_id": string,"created_at": string,"emoji": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "comment_id": string,"created_at"?: string,"emoji": string,"user_id": string
                  }
                  Update: {
                    "comment_id"?: string,"created_at"?: string,"emoji"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "comment_reactions_comment_id_fkey"
      columns: ["comment_id"]
isOneToOne: false
      referencedRelation: "comments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "comment_reactions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"comments": {
                  Row: {
                    "author_id": string | null,"body": string,"created_at": string,"deleted_at": string | null,"deleted_by": string | null,"id": string,"task_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string | null,"body": string,"created_at"?: string,"deleted_at"?: string | null,"deleted_by"?: string | null,"id"?: string,"task_id": string,"updated_at"?: string
                  }
                  Update: {
                    "author_id"?: string | null,"body"?: string,"created_at"?: string,"deleted_at"?: string | null,"deleted_by"?: string | null,"id"?: string,"task_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "comments_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "comments_deleted_by_fkey"
      columns: ["deleted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "comments_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    }
                  ]
                },"events": {
                  Row: {
                    "created_at": string,"created_by": string | null,"date": string,"id": string,"project_id": string,"time": string | null,"title": string,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"date": string,"id"?: string,"project_id": string,"time"?: string | null,"title": string,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"date"?: string,"id"?: string,"project_id"?: string,"time"?: string | null,"title"?: string,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "events_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "events_project_id_workspace_id_fkey"
      columns: ["project_id","workspace_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id","workspace_id"]
    }
                  ]
                },"favorites": {
                  Row: {
                    "created_at": string,"id": string,"project_id": string | null,"task_id": string | null,"user_id": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"project_id"?: string | null,"task_id"?: string | null,"user_id": string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"project_id"?: string | null,"task_id"?: string | null,"user_id"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "favorites_project_workspace_fkey"
      columns: ["project_id","workspace_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id","workspace_id"]
    },{
      foreignKeyName: "favorites_task_workspace_fkey"
      columns: ["task_id","workspace_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id","workspace_id"]
    },{
      foreignKeyName: "favorites_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "favorites_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"files": {
                  Row: {
                    "created_at": string,"deleted_at": string | null,"id": string,"mime": string,"name": string,"object_name": string,"project_id": string,"size_bytes": number,"status": Database["public"]['Enums']["file_status"],"storage_path": string,"task_id": string | null,"type": Database["public"]['Enums']["file_type"],"updated_at": string,"uploaded_by": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"deleted_at"?: string | null,"id"?: string,"mime": string,"name": string,"object_name": string,"project_id": string,"size_bytes": number,"status"?: Database["public"]['Enums']["file_status"],"storage_path": string,"task_id"?: string | null,"type"?: Database["public"]['Enums']["file_type"],"updated_at"?: string,"uploaded_by"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"deleted_at"?: string | null,"id"?: string,"mime"?: string,"name"?: string,"object_name"?: string,"project_id"?: string,"size_bytes"?: number,"status"?: Database["public"]['Enums']["file_status"],"storage_path"?: string,"task_id"?: string | null,"type"?: Database["public"]['Enums']["file_type"],"updated_at"?: string,"uploaded_by"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "files_project_id_workspace_id_fkey"
      columns: ["project_id","workspace_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id","workspace_id"]
    },{
      foreignKeyName: "files_task_id_project_id_fkey"
      columns: ["task_id","project_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id","project_id"]
    },{
      foreignKeyName: "files_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"milestones": {
                  Row: {
                    "created_at": string,"date": string,"id": string,"name": string,"project_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"date": string,"id"?: string,"name": string,"project_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"date"?: string,"id"?: string,"name"?: string,"project_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "milestones_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "actor_id": string | null,"created_at": string,"id": string,"project_id": string | null,"read_at": string | null,"snippet": string | null,"task_id": string | null,"text": string,"type": Database["public"]['Enums']["notification_type"],"user_id": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"created_at"?: string,"id"?: string,"project_id"?: string | null,"read_at"?: string | null,"snippet"?: string | null,"task_id"?: string | null,"text"?: string,"type": Database["public"]['Enums']["notification_type"],"user_id": string,"workspace_id": string
                  }
                  Update: {
                    "actor_id"?: string | null,"created_at"?: string,"id"?: string,"project_id"?: string | null,"read_at"?: string | null,"snippet"?: string | null,"task_id"?: string | null,"text"?: string,"type"?: Database["public"]['Enums']["notification_type"],"user_id"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_project_id_workspace_id_fkey"
      columns: ["project_id","workspace_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id","workspace_id"]
    },{
      foreignKeyName: "notifications_task_id_project_id_fkey"
      columns: ["task_id","project_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id","project_id"]
    },{
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "color": string,"created_at": string,"email": string,"id": string,"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "color"?: string,"created_at"?: string,"email"?: string,"id": string,"name"?: string,"updated_at"?: string
                  }
                  Update: {
                    "color"?: string,"created_at"?: string,"email"?: string,"id"?: string,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"project_members": {
                  Row: {
                    "created_at": string,"perm": Database["public"]['Enums']["share_perm"],"project_id": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"perm"?: Database["public"]['Enums']["share_perm"],"project_id": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"perm"?: Database["public"]['Enums']["share_perm"],"project_id"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "project_members_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"projects": {
                  Row: {
                    "access": Database["public"]['Enums']["project_access"],"archived_at": string | null,"color": string,"created_at": string,"created_by": string | null,"deleted_at": string | null,"description": string | null,"due_date": string | null,"icon": string,"id": string,"key": string,"lead_id": string | null,"name": string,"seq": number,"start_date": string | null,"status": Database["public"]['Enums']["project_status"],"team_id": string | null,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "access"?: Database["public"]['Enums']["project_access"],"archived_at"?: string | null,"color"?: string,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"description"?: string | null,"due_date"?: string | null,"icon"?: string,"id"?: string,"key": string,"lead_id"?: string | null,"name": string,"seq"?: number,"start_date"?: string | null,"status"?: Database["public"]['Enums']["project_status"],"team_id"?: string | null,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "access"?: Database["public"]['Enums']["project_access"],"archived_at"?: string | null,"color"?: string,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"description"?: string | null,"due_date"?: string | null,"icon"?: string,"id"?: string,"key"?: string,"lead_id"?: string | null,"name"?: string,"seq"?: number,"start_date"?: string | null,"status"?: Database["public"]['Enums']["project_status"],"team_id"?: string | null,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "projects_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "projects_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "projects_team_id_workspace_id_fkey"
      columns: ["team_id","workspace_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id","workspace_id"]
    },{
      foreignKeyName: "projects_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"saved_views": {
                  Row: {
                    "created_at": string,"created_by": string | null,"filters": NonNullable<Json>,"id": string,"name": string,"project_id": string,"type": Database["public"]['Enums']["view_type"],"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"filters"?: NonNullable<Json>,"id"?: string,"name": string,"project_id": string,"type"?: Database["public"]['Enums']["view_type"],"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"filters"?: NonNullable<Json>,"id"?: string,"name"?: string,"project_id"?: string,"type"?: Database["public"]['Enums']["view_type"],"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "saved_views_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "saved_views_project_id_workspace_id_fkey"
      columns: ["project_id","workspace_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id","workspace_id"]
    }
                  ]
                },"subtasks": {
                  Row: {
                    "assignee_id": string | null,"created_at": string,"done": boolean,"due_date": string | null,"id": string,"note": string | null,"sort_order": number,"task_id": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assignee_id"?: string | null,"created_at"?: string,"done"?: boolean,"due_date"?: string | null,"id"?: string,"note"?: string | null,"sort_order"?: number,"task_id": string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "assignee_id"?: string | null,"created_at"?: string,"done"?: boolean,"due_date"?: string | null,"id"?: string,"note"?: string | null,"sort_order"?: number,"task_id"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "subtasks_assignee_id_fkey"
      columns: ["assignee_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "subtasks_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    }
                  ]
                },"task_deps": {
                  Row: {
                    "blocked_by_id": string,"created_at": string,"task_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "blocked_by_id": string,"created_at"?: string,"task_id": string
                  }
                  Update: {
                    "blocked_by_id"?: string,"created_at"?: string,"task_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_deps_blocked_by_id_fkey"
      columns: ["blocked_by_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_deps_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    }
                  ]
                },"tasks": {
                  Row: {
                    "archived_at": string | null,"assignee_id": string | null,"completed_at": string | null,"created_at": string,"created_by": string | null,"deleted_at": string | null,"description_html": string | null,"due_date": string | null,"estimate": string | null,"id": string,"key": string,"labels": (string)[],"prev_status": Database["public"]['Enums']["task_status"] | null,"priority": Database["public"]['Enums']["task_priority"],"project_id": string,"recur": Database["public"]['Enums']["repeat_kind"],"recur_source_id": string | null,"sort_order": number,"start_date": string | null,"status": Database["public"]['Enums']["task_status"],"title": string,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"assignee_id"?: string | null,"completed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"description_html"?: string | null,"due_date"?: string | null,"estimate"?: string | null,"id"?: string,"key": string,"labels"?: (string)[],"prev_status"?: Database["public"]['Enums']["task_status"] | null,"priority"?: Database["public"]['Enums']["task_priority"],"project_id": string,"recur"?: Database["public"]['Enums']["repeat_kind"],"recur_source_id"?: string | null,"sort_order": number,"start_date"?: string | null,"status"?: Database["public"]['Enums']["task_status"],"title": string,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "archived_at"?: string | null,"assignee_id"?: string | null,"completed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"description_html"?: string | null,"due_date"?: string | null,"estimate"?: string | null,"id"?: string,"key"?: string,"labels"?: (string)[],"prev_status"?: Database["public"]['Enums']["task_status"] | null,"priority"?: Database["public"]['Enums']["task_priority"],"project_id"?: string,"recur"?: Database["public"]['Enums']["repeat_kind"],"recur_source_id"?: string | null,"sort_order"?: number,"start_date"?: string | null,"status"?: Database["public"]['Enums']["task_status"],"title"?: string,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tasks_assignee_id_fkey"
      columns: ["assignee_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_project_id_workspace_id_fkey"
      columns: ["project_id","workspace_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id","workspace_id"]
    },{
      foreignKeyName: "tasks_recur_source_id_project_id_fkey"
      columns: ["recur_source_id","project_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id","project_id"]
    }
                  ]
                },"teams": {
                  Row: {
                    "color": string,"created_at": string,"description": string | null,"icon": string,"id": string,"name": string,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "color"?: string,"created_at"?: string,"description"?: string | null,"icon"?: string,"id"?: string,"name": string,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "color"?: string,"created_at"?: string,"description"?: string | null,"icon"?: string,"id"?: string,"name"?: string,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "teams_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"user_prefs": {
                  Row: {
                    "confirm_del": boolean,"created_at": string,"default_tab": string | null,"notif_prefs": NonNullable<Json>,"proj_order": (string)[],"recent_searches": (string)[],"show_done_board": boolean,"time_fmt": string,"updated_at": string,"user_id": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "confirm_del"?: boolean,"created_at"?: string,"default_tab"?: string | null,"notif_prefs"?: NonNullable<Json>,"proj_order"?: (string)[],"recent_searches"?: (string)[],"show_done_board"?: boolean,"time_fmt"?: string,"updated_at"?: string,"user_id": string,"workspace_id": string
                  }
                  Update: {
                    "confirm_del"?: boolean,"created_at"?: string,"default_tab"?: string | null,"notif_prefs"?: NonNullable<Json>,"proj_order"?: (string)[],"recent_searches"?: (string)[],"show_done_board"?: boolean,"time_fmt"?: string,"updated_at"?: string,"user_id"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_prefs_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_prefs_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"user_view_states": {
                  Row: {
                    "created_at": string,"state": NonNullable<Json>,"updated_at": string,"user_id": string,"view_key": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"state"?: NonNullable<Json>,"updated_at"?: string,"user_id": string,"view_key": string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"state"?: NonNullable<Json>,"updated_at"?: string,"user_id"?: string,"view_key"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_view_states_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_view_states_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"workspace_invites": {
                  Row: {
                    "created_at": string,"email": string,"id": string,"invited_by": string | null,"role": Database["public"]['Enums']["ws_role"],"status": string,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email": string,"id"?: string,"invited_by"?: string | null,"role"?: Database["public"]['Enums']["ws_role"],"status"?: string,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"id"?: string,"invited_by"?: string | null,"role"?: Database["public"]['Enums']["ws_role"],"status"?: string,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workspace_invites_invited_by_fkey"
      columns: ["invited_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "workspace_invites_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"workspace_members": {
                  Row: {
                    "color": string | null,"created_at": string,"last_active_at": string | null,"role": Database["public"]['Enums']["ws_role"],"status": Database["public"]['Enums']["member_status"],"team_id": string | null,"title": string | null,"tz": string,"updated_at": string,"user_id": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "color"?: string | null,"created_at"?: string,"last_active_at"?: string | null,"role"?: Database["public"]['Enums']["ws_role"],"status"?: Database["public"]['Enums']["member_status"],"team_id"?: string | null,"title"?: string | null,"tz"?: string,"updated_at"?: string,"user_id": string,"workspace_id": string
                  }
                  Update: {
                    "color"?: string | null,"created_at"?: string,"last_active_at"?: string | null,"role"?: Database["public"]['Enums']["ws_role"],"status"?: Database["public"]['Enums']["member_status"],"team_id"?: string | null,"title"?: string | null,"tz"?: string,"updated_at"?: string,"user_id"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workspace_members_team_id_workspace_id_fkey"
      columns: ["team_id","workspace_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id","workspace_id"]
    },{
      foreignKeyName: "workspace_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "workspace_members_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"workspaces": {
                  Row: {
                    "color": string,"created_at": string,"created_by": string | null,"id": string,"name": string,"slug": string,"team_size": string | null,"updated_at": string,"usage": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "color"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"name": string,"slug": string,"team_size"?: string | null,"updated_at"?: string,"usage"?: string | null
                  }
                  Update: {
                    "color"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"name"?: string,"slug"?: string,"team_size"?: string | null,"updated_at"?: string,"usage"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "workspaces_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_invite":
{ Args: { "p_invite": string }; Returns: {
              "color": string | null,
"created_at": string,
"last_active_at": string | null,
"role": Database["public"]['Enums']["ws_role"],
"status": Database["public"]['Enums']["member_status"],
"team_id": string | null,
"title": string | null,
"tz": string,
"updated_at": string,
"user_id": string,
"workspace_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "workspace_members"
        isOneToOne: true
        isSetofReturn: false
      } },
"add_comment":
{ Args: { "p_body": string,"p_mentions"?: (string)[],"p_task": string }; Returns: {
              "author_id": string | null,
"body": string,
"created_at": string,
"deleted_at": string | null,
"deleted_by": string | null,
"id": string,
"task_id": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "comments"
        isOneToOne: true
        isSetofReturn: false
      } },
"can_comment_project":
{ Args: { "p": string }; Returns: boolean
                           },
"can_comment_project_rows":
{ Args: { "p": string }; Returns: boolean
                           },
"can_edit_project":
{ Args: { "p": string }; Returns: boolean
                           },
"can_edit_project_rows":
{ Args: { "p": string }; Returns: boolean
                           },
"can_manage_project":
{ Args: { "p": string }; Returns: boolean
                           },
"can_read_file_object":
{ Args: { "p_name": string }; Returns: boolean
                           },
"can_remove_file_object":
{ Args: { "p_name": string }; Returns: boolean
                           },
"can_upload_file_object":
{ Args: { "p_name": string }; Returns: boolean
                           },
"can_view_project":
{ Args: { "p": string }; Returns: boolean
                           },
"can_view_project_rows":
{ Args: { "p": string }; Returns: boolean
                           },
"comment_project_id":
{ Args: { "p_comment": string }; Returns: string
                           },
"complete_task":
{ Args: { "p_task": string }; Returns: {
              "next_due": string,"next_key": string,"next_task_id": string,"next_title": string,"task_id": string
            }[]
                           },
"convert_subtask":
{ Args: { "p_subtask": string }; Returns: {
              "archived_at": string | null,
"assignee_id": string | null,
"completed_at": string | null,
"created_at": string,
"created_by": string | null,
"deleted_at": string | null,
"description_html": string | null,
"due_date": string | null,
"estimate": string | null,
"id": string,
"key": string,
"labels": (string)[],
"prev_status": Database["public"]['Enums']["task_status"] | null,
"priority": Database["public"]['Enums']["task_priority"],
"project_id": string,
"recur": Database["public"]['Enums']["repeat_kind"],
"recur_source_id": string | null,
"sort_order": number,
"start_date": string | null,
"status": Database["public"]['Enums']["task_status"],
"title": string,
"updated_at": string,
"workspace_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "tasks"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_project":
{ Args: { "p_access"?: Database["public"]['Enums']["project_access"],"p_color"?: string,"p_description"?: string,"p_due"?: string,"p_icon"?: string,"p_lead"?: string,"p_name": string,"p_start"?: string,"p_status"?: Database["public"]['Enums']["project_status"],"p_team"?: string,"p_template"?: string,"p_workspace": string }; Returns: {
              "access": Database["public"]['Enums']["project_access"],
"archived_at": string | null,
"color": string,
"created_at": string,
"created_by": string | null,
"deleted_at": string | null,
"description": string | null,
"due_date": string | null,
"icon": string,
"id": string,
"key": string,
"lead_id": string | null,
"name": string,
"seq": number,
"start_date": string | null,
"status": Database["public"]['Enums']["project_status"],
"team_id": string | null,
"updated_at": string,
"workspace_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "projects"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_task":
{ Args: { "p_assignee"?: string,"p_desc"?: string,"p_due"?: string,"p_estimate"?: string,"p_labels"?: (string)[],"p_priority"?: Database["public"]['Enums']["task_priority"],"p_project": string,"p_recur"?: Database["public"]['Enums']["repeat_kind"],"p_sort_order"?: number,"p_start"?: string,"p_status"?: Database["public"]['Enums']["task_status"],"p_title": string }; Returns: {
              "archived_at": string | null,
"assignee_id": string | null,
"completed_at": string | null,
"created_at": string,
"created_by": string | null,
"deleted_at": string | null,
"description_html": string | null,
"due_date": string | null,
"estimate": string | null,
"id": string,
"key": string,
"labels": (string)[],
"prev_status": Database["public"]['Enums']["task_status"] | null,
"priority": Database["public"]['Enums']["task_priority"],
"project_id": string,
"recur": Database["public"]['Enums']["repeat_kind"],
"recur_source_id": string | null,
"sort_order": number,
"start_date": string | null,
"status": Database["public"]['Enums']["task_status"],
"title": string,
"updated_at": string,
"workspace_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "tasks"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_workspace_onboarding":
{ Args: { "p_invite_emails"?: (string)[],"p_name": string,"p_project_name": string,"p_slug": string,"p_team_size": string,"p_template": string,"p_usage": string }; Returns: {
              "slug": string,"workspace_id": string
            }[]
                           },
"decline_invite":
{ Args: { "p_invite": string }; Returns: undefined
                           },
"delete_workspace":
{ Args: { "p_confirm": string,"p_workspace": string }; Returns: undefined
                           },
"fail_file":
{ Args: { "p_file": string }; Returns: {
              "created_at": string,
"deleted_at": string | null,
"id": string,
"mime": string,
"name": string,
"object_name": string,
"project_id": string,
"size_bytes": number,
"status": Database["public"]['Enums']["file_status"],
"storage_path": string,
"task_id": string | null,
"type": Database["public"]['Enums']["file_type"],
"updated_at": string,
"uploaded_by": string | null,
"workspace_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "files"
        isOneToOne: true
        isSetofReturn: false
      } },
"finalize_file":
{ Args: { "p_file": string }; Returns: {
              "created_at": string,
"deleted_at": string | null,
"id": string,
"mime": string,
"name": string,
"object_name": string,
"project_id": string,
"size_bytes": number,
"status": Database["public"]['Enums']["file_status"],
"storage_path": string,
"task_id": string | null,
"type": Database["public"]['Enums']["file_type"],
"updated_at": string,
"uploaded_by": string | null,
"workspace_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "files"
        isOneToOne: true
        isSetofReturn: false
      } },
"is_ws_admin":
{ Args: { "ws": string }; Returns: boolean
                           },
"is_ws_member":
{ Args: { "ws": string }; Returns: boolean
                           },
"move_task":
{ Args: { "p_sort_order"?: number,"p_status": Database["public"]['Enums']["task_status"],"p_task": string }; Returns: {
              "archived_at": string | null,
"assignee_id": string | null,
"completed_at": string | null,
"created_at": string,
"created_by": string | null,
"deleted_at": string | null,
"description_html": string | null,
"due_date": string | null,
"estimate": string | null,
"id": string,
"key": string,
"labels": (string)[],
"prev_status": Database["public"]['Enums']["task_status"] | null,
"priority": Database["public"]['Enums']["task_priority"],
"project_id": string,
"recur": Database["public"]['Enums']["repeat_kind"],
"recur_source_id": string | null,
"sort_order": number,
"start_date": string | null,
"status": Database["public"]['Enums']["task_status"],
"title": string,
"updated_at": string,
"workspace_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "tasks"
        isOneToOne: true
        isSetofReturn: false
      } },
"my_invites":
{ Args: Record<PropertyKey, never>; Returns: {
              "created_at": string,"invite_id": string,"role": Database["public"]['Enums']["ws_role"],"workspace_id": string,"workspace_name": string
            }[]
                           },
"project_is_live":
{ Args: { "p": string }; Returns: boolean
                           },
"project_perm":
{ Args: { "p": string }; Returns: Database["public"]['Enums']["share_perm"]
                           },
"purge_comment":
{ Args: { "p_comment": string }; Returns: undefined
                           },
"purge_file":
{ Args: { "p_file": string }; Returns: undefined
                           },
"purge_project":
{ Args: { "p_project": string }; Returns: undefined
                           },
"purge_task":
{ Args: { "p_task": string }; Returns: undefined
                           },
"reopen_task":
{ Args: { "p_task": string }; Returns: {
              "archived_at": string | null,
"assignee_id": string | null,
"completed_at": string | null,
"created_at": string,
"created_by": string | null,
"deleted_at": string | null,
"description_html": string | null,
"due_date": string | null,
"estimate": string | null,
"id": string,
"key": string,
"labels": (string)[],
"prev_status": Database["public"]['Enums']["task_status"] | null,
"priority": Database["public"]['Enums']["task_priority"],
"project_id": string,
"recur": Database["public"]['Enums']["repeat_kind"],
"recur_source_id": string | null,
"sort_order": number,
"start_date": string | null,
"status": Database["public"]['Enums']["task_status"],
"title": string,
"updated_at": string,
"workspace_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "tasks"
        isOneToOne: true
        isSetofReturn: false
      } },
"restore_comment":
{ Args: { "p_comment": string,"p_token": string }; Returns: {
              "author_id": string | null,
"body": string,
"created_at": string,
"deleted_at": string | null,
"deleted_by": string | null,
"id": string,
"task_id": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "comments"
        isOneToOne: true
        isSetofReturn: false
      } },
"restore_file":
{ Args: { "p_file": string,"p_token": string }; Returns: {
              "created_at": string,
"deleted_at": string | null,
"id": string,
"mime": string,
"name": string,
"object_name": string,
"project_id": string,
"size_bytes": number,
"status": Database["public"]['Enums']["file_status"],
"storage_path": string,
"task_id": string | null,
"type": Database["public"]['Enums']["file_type"],
"updated_at": string,
"uploaded_by": string | null,
"workspace_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "files"
        isOneToOne: true
        isSetofReturn: false
      } },
"restore_project":
{ Args: { "p_project": string,"p_token": string }; Returns: {
              "access": Database["public"]['Enums']["project_access"],
"archived_at": string | null,
"color": string,
"created_at": string,
"created_by": string | null,
"deleted_at": string | null,
"description": string | null,
"due_date": string | null,
"icon": string,
"id": string,
"key": string,
"lead_id": string | null,
"name": string,
"seq": number,
"start_date": string | null,
"status": Database["public"]['Enums']["project_status"],
"team_id": string | null,
"updated_at": string,
"workspace_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "projects"
        isOneToOne: true
        isSetofReturn: false
      } },
"restore_task":
{ Args: { "p_task": string,"p_token": string }; Returns: {
              "archived_at": string | null,
"assignee_id": string | null,
"completed_at": string | null,
"created_at": string,
"created_by": string | null,
"deleted_at": string | null,
"description_html": string | null,
"due_date": string | null,
"estimate": string | null,
"id": string,
"key": string,
"labels": (string)[],
"prev_status": Database["public"]['Enums']["task_status"] | null,
"priority": Database["public"]['Enums']["task_priority"],
"project_id": string,
"recur": Database["public"]['Enums']["repeat_kind"],
"recur_source_id": string | null,
"sort_order": number,
"start_date": string | null,
"status": Database["public"]['Enums']["task_status"],
"title": string,
"updated_at": string,
"workspace_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "tasks"
        isOneToOne: true
        isSetofReturn: false
      } },
"retry_file":
{ Args: { "p_file": string }; Returns: {
              "created_at": string,
"deleted_at": string | null,
"id": string,
"mime": string,
"name": string,
"object_name": string,
"project_id": string,
"size_bytes": number,
"status": Database["public"]['Enums']["file_status"],
"storage_path": string,
"task_id": string | null,
"type": Database["public"]['Enums']["file_type"],
"updated_at": string,
"uploaded_by": string | null,
"workspace_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "files"
        isOneToOne: true
        isSetofReturn: false
      } },
"set_member_role":
{ Args: { "p_role": Database["public"]['Enums']["ws_role"],"p_user": string,"p_workspace": string }; Returns: {
              "color": string | null,
"created_at": string,
"last_active_at": string | null,
"role": Database["public"]['Enums']["ws_role"],
"status": Database["public"]['Enums']["member_status"],
"team_id": string | null,
"title": string | null,
"tz": string,
"updated_at": string,
"user_id": string,
"workspace_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "workspace_members"
        isOneToOne: true
        isSetofReturn: false
      } },
"shares_workspace":
{ Args: { "p_user": string }; Returns: boolean
                           },
"soft_delete_comment":
{ Args: { "p_comment": string }; Returns: string
                           },
"soft_delete_file":
{ Args: { "p_file": string }; Returns: string
                           },
"soft_delete_project":
{ Args: { "p_project": string }; Returns: string
                           },
"soft_delete_task":
{ Args: { "p_task": string }; Returns: string
                           },
"task_project_id":
{ Args: { "p_task": string }; Returns: string
                           },
"workspace_member_stats":
{ Args: { "p_workspace": string }; Returns: {
              "project_count": number,"task_count": number,"user_id": string
            }[]
                           },
"ws_role":
{ Args: { "ws": string }; Returns: Database["public"]['Enums']["ws_role"]
                           }
          }
          Enums: {
            "file_status": "pending"|"ready"|"failed","file_type": "fig"|"pdf"|"zip"|"img"|"sheet"|"doc"|"code"|"other","member_status": "active"|"invited"|"deactivated","notification_type": "mention"|"assign"|"comment"|"update","project_access": "workspace"|"private","project_status": "planning"|"active"|"risk"|"hold"|"complete","repeat_kind": "none"|"daily"|"weekly"|"biweekly"|"monthly","share_perm": "view"|"comment"|"edit"|"full","task_priority": "urgent"|"high"|"medium"|"low"|"none","task_status": "backlog"|"todo"|"progress"|"review"|"done","view_type": "list"|"board"|"table","ws_role": "owner"|"admin"|"member"|"guest"
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
            "file_status": ["pending", "ready", "failed"],"file_type": ["fig", "pdf", "zip", "img", "sheet", "doc", "code", "other"],"member_status": ["active", "invited", "deactivated"],"notification_type": ["mention", "assign", "comment", "update"],"project_access": ["workspace", "private"],"project_status": ["planning", "active", "risk", "hold", "complete"],"repeat_kind": ["none", "daily", "weekly", "biweekly", "monthly"],"share_perm": ["view", "comment", "edit", "full"],"task_priority": ["urgent", "high", "medium", "low", "none"],"task_status": ["backlog", "todo", "progress", "review", "done"],"view_type": ["list", "board", "table"],"ws_role": ["owner", "admin", "member", "guest"]
          }
        }
} as const
