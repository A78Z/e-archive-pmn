import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { DisplayMode, UserPreferences } from '@/lib/types/documents';

export function useUserPreferences(userId: string | undefined) {
  const [displayMode, setDisplayMode] = useState<DisplayMode>('large');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    loadPreferences();
  }, [userId]);

  const loadPreferences = async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Erreur chargement préférences:', error);
        return;
      }

      if (data) {
        setDisplayMode(data.display_mode as DisplayMode);
      } else {
        await createDefaultPreferences();
      }
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  const createDefaultPreferences = async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .insert({ user_id: userId, display_mode: 'large' })
        .select()
        .single();

      if (error) {
        console.error('Erreur création préférences:', error);
      }
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  const updateDisplayMode = async (mode: DisplayMode) => {
    if (!userId) return;

    setDisplayMode(mode);

    try {
      const { error } = await supabase
        .from('user_preferences')
        .upsert(
          { user_id: userId, display_mode: mode },
          { onConflict: 'user_id' }
        );

      if (error) {
        console.error('Erreur mise à jour préférences:', error);
      }
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  return {
    displayMode,
    setDisplayMode: updateDisplayMode,
    loading
  };
}
