import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export type CategoryKind = 'expense' | 'income';

export type Category = {
  id: string;
  user_id: string;
  name: string;
  kind: CategoryKind;
  icon: string;
  color: string;
  archived_at: string | null;
  created_at: string;
};

export type CategoryInput = {
  id?: string;
  name: string;
  kind: CategoryKind;
  icon: string;
  color: string;
};

const DUPLICATE_NAME = 'A category with that name already exists.';

function friendly(error: { code?: string; message: string }) {
  return new Error(error.code === '23505' ? DUPLICATE_NAME : error.message);
}

/**
 * All of the user's categories, including archived ones. Archived rows stay in the result
 * so old transactions can still resolve their category name; use `activeCategories` for pickers.
 */
export function useCategories() {
  const userId = useAuth().session?.user.id;
  return useQuery({
    queryKey: ['categories', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('*').order('name');
      if (error) throw error;
      return data as Category[];
    },
  });
}

export const activeCategories = (all: Category[] | undefined, kind?: CategoryKind) =>
  (all ?? []).filter((c) => !c.archived_at && (!kind || c.kind === kind));

export function useSaveCategory() {
  const client = useQueryClient();
  const userId = useAuth().session?.user.id;

  return useMutation({
    mutationFn: async ({ id, ...fields }: CategoryInput) => {
      const name = fields.name.trim();
      if (id) {
        // kind is intentionally not updatable: it would silently invalidate past transactions.
        const { error } = await supabase
          .from('categories')
          .update({ name, icon: fields.icon, color: fields.color })
          .eq('id', id);
        if (error) throw friendly(error);
      } else {
        const { error } = await supabase
          .from('categories')
          .insert({ user_id: userId, name, kind: fields.kind, icon: fields.icon, color: fields.color });
        if (error) throw friendly(error);
      }
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['categories'] }),
  });
}

export function useArchiveCategory() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('categories')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['categories'] }),
  });
}
