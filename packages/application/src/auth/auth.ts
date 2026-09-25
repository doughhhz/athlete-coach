import type { AuthCredentials } from "../athlete/schemas.ts";

export type AuthSession = Readonly<{ email: string | null; userId: string }>;
export type SignUpResult = Readonly<{
  requiresEmailConfirmation: boolean;
  session: AuthSession | null;
}>;

export interface AuthRepository {
  getSession(): Promise<AuthSession | null>;
  onSessionChange(listener: (session: AuthSession | null) => void): () => void;
  signIn(credentials: AuthCredentials): Promise<AuthSession>;
  signOut(): Promise<void>;
  signUp(credentials: AuthCredentials): Promise<SignUpResult>;
}

export class RestoreSession {
  private readonly auth: AuthRepository;
  constructor(auth: AuthRepository) {
    this.auth = auth;
  }
  execute() {
    return this.auth.getSession();
  }
}
export class SignInWithEmail {
  private readonly auth: AuthRepository;
  constructor(auth: AuthRepository) {
    this.auth = auth;
  }
  execute(credentials: AuthCredentials) {
    return this.auth.signIn(credentials);
  }
}
export class SignUpWithEmail {
  private readonly auth: AuthRepository;
  constructor(auth: AuthRepository) {
    this.auth = auth;
  }
  execute(credentials: AuthCredentials) {
    return this.auth.signUp(credentials);
  }
}
export class SignOutCurrentSession {
  private readonly auth: AuthRepository;
  constructor(auth: AuthRepository) {
    this.auth = auth;
  }
  execute() {
    return this.auth.signOut();
  }
}
