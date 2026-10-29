import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { z } from 'zod';

import { AuthShell } from '@/components/auth-shell';
import { Button, ErrorText, Field } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { supabase } from '@/lib/supabase';

const schema = z.object({
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
});
type Values = z.infer<typeof schema>;

export default function LoginScreen() {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setFormError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setFormError(error.message);
    // On success, onAuthStateChange updates the session and the route guard redirects.
  });

  return (
    <AuthShell title="Welcome back" subtitle="Log in to see where your money went.">
      <Controller
        control={control}
        name="email"
        render={({ field }) => (
          <Field
            label="Email"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="you@example.com"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.email?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field }) => (
          <Field
            label="Password"
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.password?.message}
          />
        )}
      />
      {formError ? <ErrorText>{formError}</ErrorText> : null}
      <Button title="Log in" onPress={onSubmit} loading={isSubmitting} />
      <View style={{ alignItems: 'center' }}>
        <Link href="/signup">
          <ThemedText type="linkPrimary">New here? Create an account</ThemedText>
        </Link>
      </View>
    </AuthShell>
  );
}
