import { generateText, NoObjectGeneratedError, Output } from "ai";

import { createLovableAiGatewayProvider, requireLovableApiKey } from "./ai-gateway.server";
import { ResumeSchema, type ParsedResumeData } from "./resume.schemas";

const SYSTEM =
  "You extract structured profile data from resumes for a Bangladesh government job matching platform. " +
  "Handle both English and Bangla content. For degrees, use simple labels like 'Bachelor', 'Master', 'Diploma', 'HSC', 'SSC'. " +
  "For dob use YYYY-MM-DD only if explicitly stated. Compute age from dob if possible. " +
  "Return clean lowercase subject names. Years of experience: sum of full-time roles in years (decimals OK). " +
  "Respond with ONLY the JSON object matching the schema, no prose, no markdown.";

async function runExtract(modelId: string, text: string): Promise<ParsedResumeData> {
  const gateway = createLovableAiGatewayProvider(requireLovableApiKey());
  const { output } = await generateText({
    model: gateway(modelId),
    output: Output.object({ schema: ResumeSchema }),
    system: SYSTEM,
    prompt: `Extract structured data from this resume:\n\n${text}`,
    maxOutputTokens: 4096,
  });
  return output;
}

export async function parseResumeTextWithAi(text: string): Promise<ParsedResumeData> {
  try {
    return await runExtract("google/gemini-3-flash-preview", text);
  } catch (err) {
    if (NoObjectGeneratedError.isInstance(err)) {
      // Preview model returned unparsable output — retry with stable model.
      return await runExtract("google/gemini-2.5-flash", text);
    }
    throw err;
  }
}
