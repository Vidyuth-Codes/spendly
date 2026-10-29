import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View, type TextInputProps } from 'react-native';
import { z } from 'zod';

import { AuthShell } from '@/components/auth-shell';
import { Button, ErrorText, Field } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { supabase } from '@/lib/supabase';

const schema = z
  .object({
    name: z.string().trim().min(1, 'Enter your name').max(40),
    email: z.string().trim().email('Enter a valid email'),
    password: z.string().min(8, 'At least 8 characters'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });
type Values = z.infer<typeof schema>;

export default function SignupScreen() {
  const [formError, setFormError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '', confirm: '' },
  });

  const onSubmit = handleSubmit(async ({ name, email, password }) => {
    setFormError(null);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: name } },
    });
    if (error) return setFormError(error.message);
    // With "Confirm email" on in Supabase there is no session until the link is clicked.
    if (!data.session) setCheckEmail(true);
  });

  if (checkEmail) {
    return (
      <AuthShell title="Check your email" subtitle="We sent a confirmation link. Open it, then log in.">
        <Link href="/login">
          <ThemedText type="linkPrimary">Back to log in</ThemedText>
        </Link>
      </AuthShell>
    );
  }

  const text = (name: keyof Values, label: string, extra: TextInputProps = {}) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Field
          label={label}
          value={field.value}
          onChangeText={field.onChange}
          onBlur={field.onBlur}
          error={errors[name]?.message}
          {...extra}
        />
      )}
    />
  );

  return (
    <AuthShell title="Create account" subtitle="Track spending against your monthly allowance.">
      {text('name', 'Name', { autoComplete: 'name', placeholder: 'Your name' })}
      {text('email', 'Email', {
        autoCapitalize: 'none',
        autoComplete: 'email',
        keyboardType: 'email-address',
        placeholder: 'you@example.com',
      })}
      {text('password', 'Password', {
        secureTextEntry: true,
        autoCapitalize: 'none',
        autoComplete: 'new-password',
      })}
      {text('confirm', 'Confirm password', { secureTextEntry: true, autoCapitalize: 'none' })}
      {formError ? <ErrorText>{formError}</ErrorText> : null}
      <Button title="Sign up" onPress={onSubmit} loading={isSubmitting} />
      <View style={{ alignItems: 'center' }}>
        <Link href="/login">
          <ThemedText type="linkPrimary">Already have an account? Log in</ThemedText>
        </Link>
      </View>
    </AuthShell>
  );
}
