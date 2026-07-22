export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Profiles = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

type Leagues = {
  id: string;
  name: string;
  description: string | null;
  invite_code: string;
  created_by: string;
  default_entry_fee_units: number;
  created_at: string;
  updated_at: string;
};

type LeagueMembers = {
  league_id: string;
  user_id: string;
  role: string;
  joined_at: string;
};

type GameCatalog = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  scoring_mode: string;
  scoring_config: Json;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  created_by: string | null;
  is_system: boolean;
};

type Events = {
  id: string;
  kind: string;
  league_id: string | null;
  catalog_id: string;
  title: string;
  status: string;
  notes: string | null;
  entry_fee_units: number;
  wager_mode: string;
  default_stake_units: number;
  bracket_size: number | null;
  format: string | null;
  created_by: string;
  played_at: string | null;
  created_at: string;
  updated_at: string;
};

type EventPlayers = {
  event_id: string;
  user_id: string;
  seed: number | null;
  side_label: string | null;
  score: number | null;
  placement: number | null;
  outcome: string | null;
  entry_paid: boolean;
  units_paid: number;
  units_delta: number;
};

type WagerLines = {
  id: string;
  event_id: string;
  player_id: string | null;
  side_label: string | null;
  odds_num: number;
  odds_den: number;
  stake_units: number;
  created_at: string;
};

type GameTypes = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
};

type Games = {
  id: string;
  league_id: string;
  game_type_id: string;
  title: string;
  status: string;
  wager_units: number;
  notes: string | null;
  created_by: string;
  played_at: string | null;
  created_at: string;
  updated_at: string;
};

type GamePlayers = {
  game_id: string;
  user_id: string;
  placement: number | null;
  score: number | null;
  units_delta: number;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profiles;
        Insert: {
          id: string;
          display_name: string;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Profiles>;
        Relationships: [];
      };
      leagues: {
        Row: Leagues;
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          invite_code?: string;
          created_by: string;
          default_entry_fee_units?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Leagues>;
        Relationships: [];
      };
      league_members: {
        Row: LeagueMembers;
        Insert: {
          league_id: string;
          user_id: string;
          role?: string;
          joined_at?: string;
        };
        Update: Partial<LeagueMembers>;
        Relationships: [];
      };
      game_catalog: {
        Row: GameCatalog;
        Insert: {
          id?: string;
          slug: string;
          name: string;
          description?: string | null;
          scoring_mode?: string;
          scoring_config?: Json;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          created_by?: string | null;
          is_system?: boolean;
        };
        Update: Partial<GameCatalog>;
        Relationships: [];
      };
      events: {
        Row: Events;
        Insert: {
          id?: string;
          kind: string;
          league_id?: string | null;
          catalog_id: string;
          title: string;
          status?: string;
          notes?: string | null;
          entry_fee_units?: number;
          wager_mode?: string;
          default_stake_units?: number;
          bracket_size?: number | null;
          format?: string | null;
          created_by: string;
          played_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Events>;
        Relationships: [];
      };
      event_players: {
        Row: EventPlayers;
        Insert: {
          event_id: string;
          user_id: string;
          seed?: number | null;
          side_label?: string | null;
          score?: number | null;
          placement?: number | null;
          outcome?: string | null;
          entry_paid?: boolean;
          units_paid?: number;
          units_delta?: number;
        };
        Update: Partial<EventPlayers>;
        Relationships: [];
      };
      wager_lines: {
        Row: WagerLines;
        Insert: {
          id?: string;
          event_id: string;
          player_id?: string | null;
          side_label?: string | null;
          odds_num: number;
          odds_den: number;
          stake_units?: number;
          created_at?: string;
        };
        Update: Partial<WagerLines>;
        Relationships: [];
      };
      game_types: {
        Row: GameTypes;
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          created_at?: string;
        };
        Update: Partial<GameTypes>;
        Relationships: [];
      };
      games: {
        Row: Games;
        Insert: {
          id?: string;
          league_id: string;
          game_type_id: string;
          title: string;
          status?: string;
          wager_units?: number;
          notes?: string | null;
          created_by: string;
          played_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Games>;
        Relationships: [];
      };
      game_players: {
        Row: GamePlayers;
        Insert: {
          game_id: string;
          user_id: string;
          placement?: number | null;
          score?: number | null;
          units_delta?: number;
        };
        Update: Partial<GamePlayers>;
        Relationships: [];
      };
    };
    Views: {
      league_standings: {
        Row: {
          league_id: string | null;
          user_id: string | null;
          games_played: number | null;
          wins: number | null;
          net_units: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      join_league_by_code: {
        Args: { p_code: string };
        Returns: Leagues;
      };
      create_league: {
        Args: {
          p_name: string;
          p_description?: string | null;
          p_entry_fee?: number;
        };
        Returns: Leagues;
      };
      create_event: {
        Args: {
          p_kind: string;
          p_title: string;
          p_catalog_id: string;
          p_league_id?: string | null;
          p_entry_fee?: number;
          p_wager_mode?: string;
          p_stake?: number;
          p_notes?: string | null;
          p_format?: string | null;
          p_bracket_size?: number | null;
        };
        Returns: Events;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
