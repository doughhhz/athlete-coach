import { authCredentialsSchema } from "@athlete-coach/application";
import { Link, type Href } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAppSession } from "@/presentation/auth/app-session";
import { BrandLogo } from "@/presentation/components/brand-mark";
import {
  FormField,
  FormMessage,
  PrimaryButton,
} from "@/presentation/components/form-controls";
import { useAppTheme } from "@/presentation/theme/use-app-theme";

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const theme = useAppTheme();
  const session = useAppSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [validation, setValidation] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isSignUp = mode === "sign-up";

  async function submit() {
    session.clearMessages();
    const parsed = authCredentialsSchema.safeParse({ email, password });
    if (!parsed.success) {
      setValidation(parsed.error.issues[0]?.message ?? "Confira os campos.");
      return;
    }
    setValidation(null);
    setBusy(true);
    try {
      if (isSignUp) await session.signUp(parsed.data);
      else await session.signIn(parsed.data);
    } catch {
      /* A context boundary exposes a safe message. */
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: theme.colors.background }]}
      testID={isSignUp ? "auth-sign-up-screen" : "auth-sign-in-screen"}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.safe}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <BrandLogo width={220} style={styles.logo} />
          <Text
            accessibilityRole="header"
            style={[styles.title, { color: theme.colors.text }]}
          >
            {isSignUp ? "Criar conta" : "Entrar"}
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
            Use seu e-mail e uma senha. A senha fica exclusivamente no Supabase
            Auth.
          </Text>
          <FormField
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            label="E-mail"
            onChangeText={setEmail}
            testID="auth-email"
            value={email}
          />
          <FormField
            autoCapitalize="none"
            autoComplete={isSignUp ? "new-password" : "current-password"}
            label="Senha"
            onChangeText={setPassword}
            testID="auth-password"
            secureTextEntry
            value={password}
          />
          {validation ? <FormMessage>{validation}</FormMessage> : null}
          {session.error ? <FormMessage>{session.error}</FormMessage> : null}
          {session.notice ? (
            <FormMessage tone="info">{session.notice}</FormMessage>
          ) : null}
          <PrimaryButton
            disabled={busy}
            label={busy ? "Aguarde…" : isSignUp ? "Criar conta" : "Entrar"}
            onPress={() => void submit()}
            testID="auth-submit"
          />
          <View style={styles.linkRow}>
            <Link
              href={(isSignUp ? "/(auth)" : "/(auth)/sign-up") as Href}
              style={{ color: theme.colors.accent, fontWeight: "700" }}
              testID="auth-switch-mode"
            >
              {isSignUp ? "Já tenho conta" : "Criar uma conta"}
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flexGrow: 1, justifyContent: "center", padding: 24 },
  logo: { alignSelf: "center", marginBottom: 12 },
  title: { fontSize: 32, fontWeight: "800", marginBottom: 8 },
  subtitle: { fontSize: 16, lineHeight: 23, marginBottom: 28 },
  linkRow: { alignItems: "center", marginTop: 22 },
});
