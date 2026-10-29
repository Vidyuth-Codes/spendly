// Security smoke test for your LIVE Supabase project. Run it before sharing the app with anyone:
//
//     node supabase/verify-live.mjs
//
// It signs up two throwaway users, checks that neither can read, change, or delete the other's data
// (Row Level Security), checks the anonymous role is locked out, then deletes both accounts using the
// app's own delete_my_account() function. Uses only the public key from .env. Prints PASS/FAIL per
// check and exits non-zero if anything failed.
//
// Requires "Confirm email" to be OFF in Supabase (Authentication > Sign In / Providers > Email), since
// the throwaway addresses cannot confirm anything.

import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const env = Object.fromEntries(
  fs
    .readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
);
const url = env.EXPO_PUBLIC_SUPABASE_URL;
const key = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY in .env');
  process.exit(2);
}

const client = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const stamp = Date.now();
const password = `Test-${stamp}-Pw!`;
let failures = 0;

const check = (name, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail ? `  -> ${detail}` : ''}`);
};

const signUp = async (label) => {
  const c = client();
  const email = `rls-test-${label}-${stamp}@example.com`;
  const { data, error } = await c.auth.signUp({ email, password });
  if (error) throw new Error(`Sign-up failed for ${label}: ${error.message}`);
  if (!data.session) throw new Error('No session after sign-up. Turn OFF "Confirm email" in Supabase while testing.');
  return { c, id: data.user.id, email };
};

const users = [];
try {
  const A = await signUp('a');
  users.push(A);
  const B = await signUp('b');
  users.push(B);
  check('two test users can sign up', true);

  // The signup trigger should have created a profile and the 12 default categories.
  const catsA = await A.c.from('categories').select('id, name');
  check('new user gets 12 default categories', catsA.data?.length === 12, catsA.error?.message ?? `got ${catsA.data?.length}`);
  const profA = await A.c.from('profiles').select('id').eq('id', A.id);
  check('new user gets a profile', profA.data?.length === 1, profA.error?.message);

  // A creates data.
  const food = catsA.data?.find((c) => c.name === 'Food');
  const tx = await A.c
    .from('transactions')
    .insert({ user_id: A.id, type: 'expense', amount_paise: 12345, occurred_on: new Date().toISOString().slice(0, 10), category_id: food?.id })
    .select('id')
    .single();
  check('user A can add a transaction', Boolean(tx.data?.id), tx.error?.message);
  const txId = tx.data?.id;

  // B must not be able to see or touch it.
  const listB = await B.c.from('transactions').select('id');
  check("user B cannot list A's transactions", listB.data?.length === 0, `saw ${listB.data?.length} rows`);

  const oneB = await B.c.from('transactions').select('id').eq('id', txId);
  check("user B cannot read A's transaction by id", oneB.data?.length === 0);

  const updB = await B.c.from('transactions').update({ amount_paise: 1 }).eq('id', txId).select();
  check("user B cannot modify A's transaction", (updB.data?.length ?? 0) === 0);

  const delB = await B.c.from('transactions').delete().eq('id', txId).select();
  check("user B cannot delete A's transaction", (delB.data?.length ?? 0) === 0);

  const still = await A.c.from('transactions').select('amount_paise').eq('id', txId).single();
  check("A's transaction is intact after B's attempts", still.data?.amount_paise === 12345, JSON.stringify(still.data));

  const spoof = await B.c.from('transactions').insert({ user_id: A.id, type: 'expense', amount_paise: 1, occurred_on: '2026-01-01' });
  check("user B cannot insert rows owned by A", Boolean(spoof.error), 'insert unexpectedly succeeded');

  const crossCat = await B.c
    .from('transactions')
    .insert({ user_id: B.id, type: 'expense', amount_paise: 1, occurred_on: '2026-01-01', category_id: food?.id });
  check("user B cannot use A's category", Boolean(crossCat.error), 'insert unexpectedly succeeded');

  const spendB = await B.c.rpc('spend_by_category', { p_from: '2000-01-01', p_to: '2100-01-01' });
  check("A's spending is not visible through B's summaries", !spendB.error && (spendB.data?.length ?? 0) === 0, spendB.error?.message);

  // v1.5 tables: loans, repayments, recurring expenses.
  const loan = await A.c.from('loans').insert({ user_id: A.id, person: 'Test', direction: 'lent', amount_paise: 1000 }).select('id').single();
  check('user A can add a lent/borrowed entry', Boolean(loan.data?.id), loan.error?.message);
  const loanB = await B.c.from('loans').select('id');
  check("user B cannot see A's loans", loanB.data?.length === 0);
  const payB = await B.c.from('loan_payments').insert({ user_id: B.id, loan_id: loan.data?.id, amount_paise: 1 });
  check("user B cannot add repayments to A's loan", Boolean(payB.error), 'insert unexpectedly succeeded');
  const over = await A.c.from('loan_payments').insert({ user_id: A.id, loan_id: loan.data?.id, amount_paise: 5000 });
  check('a repayment larger than the loan is refused', Boolean(over.error), 'insert unexpectedly succeeded');
  const rec = await A.c
    .from('recurring_expenses')
    .insert({ user_id: A.id, name: 'Test sub', amount_paise: 1000, day_of_month: 1 })
    .select('id')
    .single();
  check('user A can add a recurring expense', Boolean(rec.data?.id), rec.error?.message);
  const recB = await B.c.from('recurring_expenses').select('id');
  check("user B cannot see A's recurring expenses", recB.data?.length === 0);
  const badTag = await A.c
    .from('transactions')
    .insert({ user_id: A.id, type: 'expense', amount_paise: 1, occurred_on: '2026-01-01', tags: ['Bad Tag'] });
  check('invalid tags are refused', Boolean(badTag.error), 'insert unexpectedly succeeded');

  // Receipt photos: private bucket, one folder per user.
  const png = new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0, 0x43, 0, 3, 2, 2, 2, 2, 0xff, 0xd9]); // tiny JPEG-typed blob
  const mine = `${A.id}/verify-${stamp}.jpg`;
  const up = await A.c.storage.from('receipts').upload(mine, png, { contentType: 'image/jpeg' });
  check('user A can upload a receipt to their own folder', !up.error, up.error?.message);
  const dlA = await A.c.storage.from('receipts').download(mine);
  check('user A can read their own receipt', !dlA.error, dlA.error?.message);
  const dlB = await B.c.storage.from('receipts').download(mine);
  check("user B cannot read A's receipt", Boolean(dlB.error), 'download unexpectedly succeeded');
  const signedB = await B.c.storage.from('receipts').createSignedUrl(mine, 60);
  check("user B cannot get a link to A's receipt", Boolean(signedB.error), 'signed url unexpectedly created');
  const folderB = await B.c.storage.from('receipts').list(A.id);
  check("user B cannot list A's receipt folder", (folderB.data?.length ?? 0) === 0 || Boolean(folderB.error));
  const intoA = await B.c.storage.from('receipts').upload(`${A.id}/intruder-${stamp}.jpg`, png, { contentType: 'image/jpeg' });
  check("user B cannot upload into A's folder", Boolean(intoA.error), 'upload unexpectedly succeeded');
  await B.c.storage.from('receipts').remove([mine]);
  const stillThere = await A.c.storage.from('receipts').download(mine);
  check("A's receipt survives B's delete attempt", !stillThere.error, stillThere.error?.message);
  const anonDl = await client().storage.from('receipts').download(mine);
  check('signed-out visitors cannot read receipts', Boolean(anonDl.error), 'download unexpectedly succeeded');
  await A.c.storage.from('receipts').remove([mine]);

  // Not signed in at all.
  const anon = client();
  const anonList = await anon.from('transactions').select('id');
  check('signed-out visitors cannot read transactions', !anonList.error ? anonList.data.length === 0 : true, `saw ${anonList.data?.length}`);
  const anonRpc = await anon.rpc('delete_my_account');
  check('signed-out visitors cannot call delete_my_account', Boolean(anonRpc.error), 'call unexpectedly succeeded');
} catch (e) {
  failures++;
  console.log(`FAIL  test run aborted: ${e.message}`);
} finally {
  // Always remove the throwaway accounts, which also proves account deletion works on the live project.
  for (const u of users) {
    const del = await u.c.rpc('delete_my_account');
    check(`test account ${u.email.split('@')[0]} deleted`, !del.error, del.error?.message);
    const back = await client().auth.signInWithPassword({ email: u.email, password });
    check(`deleted account can no longer sign in`, Boolean(back.error), 'still able to sign in');
  }
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED. Do not share the app yet.`);
process.exit(failures === 0 ? 0 : 1);
