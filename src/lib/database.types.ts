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
  created_at: string;
  updated_at: string;
};

type LeagueMembers = {
  league_id: string;
  user_id: string;
  role: string;
  joined_at: string;
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
        Args: { p_name: string; p_description?: string | null };
        Returns: Leagues;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
