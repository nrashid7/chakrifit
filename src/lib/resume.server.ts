import { generateText, Output } from "ai";

import { createLovableAiGatewayProvider, requireLovableApiKey } from "./ai-gateway.server";
import { ResumeSchema, type ParsedResumeData } from "./resume.schemas";

export async function parseResumeTextWithAi(text: string): Promise<ParsedResumeData> {
  const gateway = createLovableAiGatewayProvider(requireLovableApiKey());
  const model = gateway("google/gemini-3-flash-preview");

  const { output } = await generateText({
    model,
    output: Output.object({ schema: ResumeSchema }),
    system:
      "You extract structured profile data from resumes for a Bangladesh government job matching platform. " +
      "Handle both English and Bangla content. For degrees, use simple labels like 'Bachelor', 'Master', 'Diploma', 'HSC', 'SSC'. " +
      "For dob use YYYY-MM-DD only if explicitly stated. Compute age from dob if possible. " +
      "Return clean lowercase subject names. Years of experience: sum of full-time roles in years (decimals OK).",
    prompt: `Extract structured data from this resume:\n\n${text}`,
  });

  return output;
}
