import type { GenerateInitialProgramResult } from "@athlete-coach/application";
import type { AthleteCoachSupabaseClient } from "@athlete-coach/data-access";

/** Server error code (and block reason) of program-generate. */
export class MobileInitialProgramError extends Error {
  constructor(
    readonly code: string,
    readonly reason: string | null = null,
  ) {
    super(code);
    this.name = "MobileInitialProgramError";
  }
}
async function errorBody(
  error: unknown,
): Promise<{ code: string; reason: string | null }> {
  try {
    const context = (error as { context?: { json?: () => Promise<unknown> } })
      .context;
    const body = (await context?.json?.()) as
      { error?: { code?: string; reason?: string } } | undefined;
    return {
      code: body?.error?.code ?? "program_failed",
      reason: body?.error?.reason ?? null,
    };
  } catch {
    return { code: "program_failed", reason: null };
  }
}

/** Only the mode and the stable creation intent are sent (ADR-0119). */
export class SupabaseInitialProgramGateway {
  constructor(private readonly client: AthleteCoachSupabaseClient) {}
  async generate(
    mode: "personal" | "basic",
    creationRequestId: string,
  ): Promise<GenerateInitialProgramResult> {
    const { data, error } = await this.client.functions.invoke(
      "program-generate",
      { body: { mode, creationRequestId } },
    );
    if (error) {
      const { code, reason } = await errorBody(error);
      throw new MobileInitialProgramError(code, reason);
    }
    return data as GenerateInitialProgramResult;
  }
}
