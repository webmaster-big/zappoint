// Types for Global Notes

export interface GlobalNote {
  id: number;
  title: string | null;
  content: string;
  package_ids: number[] | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateGlobalNoteData {
  title?: string;
  content: string;
  package_ids?: number[];
  is_active?: boolean;
  display_order?: number;
}

export interface UpdateGlobalNoteData {
  title?: string;
  content?: string;
  package_ids?: number[];
  is_active?: boolean;
  display_order?: number;
}

export interface GlobalNoteFilters {
  is_active?: boolean;
  package_id?: number;
}
