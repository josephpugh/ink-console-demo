import { defineTool } from "@github/copilot-sdk";
import { z } from "zod";
import { writeFile } from "fs/promises";
import path from "path";

export const writeMarkdownTool = defineTool("write_markdown", {
  description:
    "Write content to a markdown file in the current working directory. Use this to save notes, summaries, or reports as a .md file.",
  parameters: z.object({
    filename: z
      .string()
      .describe("The file name to write, e.g. 'weather-report.md'. Must be a plain file name, not a path."),
    content: z.string().describe("The markdown content to write to the file."),
  }),
  handler: async ({ filename, content }: { filename: string; content: string }) => {
    // Keep writes inside the current directory: reject paths and traversal.
    const base = path.basename(filename);
    if (base !== filename || filename.includes("..")) {
      return { error: `Invalid filename "${filename}". Provide a plain file name with no directory separators.` };
    }

    const name = base.endsWith(".md") ? base : `${base}.md`;
    const target = path.resolve(process.cwd(), name);

    try {
      await writeFile(target, content, "utf-8");
    } catch (err) {
      return { error: `Failed to write "${name}": ${err instanceof Error ? err.message : String(err)}` };
    }

    return { path: target, bytesWritten: Buffer.byteLength(content, "utf-8") };
  },
});
