// Browser-side resume text extraction. PDF via pdfjs-dist, DOCX via mammoth.
import * as pdfjsLib from "pdfjs-dist";
// @ts-expect-error - worker URL
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

export async function extractResumeText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return extractPdf(file);
  if (name.endsWith(".docx")) return extractDocx(file);
  if (name.endsWith(".txt")) return file.text();
  throw new Error("Unsupported file type. Please upload a PDF or DOCX.");
}

async function extractPdf(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map((it: { str?: string }) => it.str ?? "").filter(Boolean);
    text += strings.join(" ") + "\n\n";
  }
  return text.trim();
}

async function extractDocx(file: File): Promise<string> {
  const mammoth = await import("mammoth/mammoth.browser");
  const buf = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buf });
  return (result.value ?? "").trim();
}
