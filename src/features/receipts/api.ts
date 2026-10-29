import { useQuery } from '@tanstack/react-query';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';

import { supabase } from '@/lib/supabase';

const BUCKET = 'receipts';
const MAX_WIDTH = 1600; // plenty to read a receipt, and keeps uploads to a few hundred KB

export type ReceiptSource = 'camera' | 'library';

/**
 * Opens the camera or photo library. Returns the chosen image's uri, or null if the person cancelled.
 * Throws a readable Error when permission is refused.
 */
export async function pickReceipt(source: ReceiptSource): Promise<string | null> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('Camera access is turned off. You can allow it in your phone settings.');
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    return result.canceled ? null : result.assets[0].uri;
  }
  // The system photo picker needs no storage permission.
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
  return result.canceled ? null : result.assets[0].uri;
}

/** Shrinks the photo, uploads it to the user's own folder, and returns the stored path. */
export async function uploadReceipt(userId: string, uri: string): Promise<string> {
  const small = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: MAX_WIDTH } }], {
    compress: 0.7,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  const bytes = await new File(small.uri).arrayBuffer();

  // A random name per upload: replacing a receipt never reuses a path, so stale signed links and
  // caches can never show the old image.
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: 'image/jpeg' });
  if (error) throw new Error(`Could not upload the receipt: ${error.message}`);
  return path;
}

/** Deletes stored receipt files. Failures are ignored on purpose: a leftover file is harmless. */
export async function removeReceipts(paths: string[]): Promise<void> {
  const list = paths.filter(Boolean);
  if (list.length === 0) return;
  await supabase.storage.from(BUCKET).remove(list).catch(() => {});
}

/** Removes every receipt the signed-in user has stored (used before deleting the account). */
export async function removeAllMyReceipts(userId: string): Promise<void> {
  for (;;) {
    const { data, error } = await supabase.storage.from(BUCKET).list(userId, { limit: 100 });
    if (error || !data || data.length === 0) return;
    const { error: removeError } = await supabase.storage.from(BUCKET).remove(data.map((f) => `${userId}/${f.name}`));
    if (removeError) throw new Error(`Could not remove your receipts: ${removeError.message}`);
  }
}

/** A short-lived link for showing a private receipt. */
export function useReceiptUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ['receipt-url', path],
    enabled: Boolean(path),
    staleTime: 50 * 60 * 1000, // links last an hour; refresh a little before that
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path!, 60 * 60);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}
