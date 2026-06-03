import { defineTool } from "@github/copilot-sdk";
import { z } from "zod";
import { chromium, type Browser, type Page } from "playwright-core";
import { mkdir } from "fs/promises";
import path from "path";

// Where screenshots / PDFs land. Kept inside the project so output is easy to find.
export const browserOutputDir = path.resolve(process.cwd(), "playwright-output");

// Normalize a user/model-supplied URL (default to https:// when no scheme given).
function normalizeUrl(input: string): string | null {
  const trimmed = input.trim();
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(withScheme);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

// Turn a host (or a suggested name) into a safe, plain output filename.
function safeName(name: string, fallback: string, ext: string): string {
  const base = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, "_") || fallback;
  const stem = base.replace(/\.(png|jpe?g|pdf)$/i, "");
  return `${stem || fallback}.${ext}`;
}

// Launch headless Chromium, run `fn`, and always clean up.
async function withPage<T>(url: string, fn: (page: Page) => Promise<T>): Promise<T> {
  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
    return await fn(page);
  } finally {
    await browser?.close();
  }
}

export const browserScreenshotTool = defineTool("browser_screenshot", {
  description:
    "Open a web page in a headless browser and save a full-page screenshot as a PNG. Use this when the user wants a picture/screenshot of a website.",
  parameters: z.object({
    url: z.string().describe("The page to capture, e.g. 'example.com' or 'https://news.ycombinator.com'."),
    filename: z.string().optional().describe("Optional output file name (without a path). Defaults to the site's hostname."),
  }),
  handler: async ({ url, filename }) => {
    const target = normalizeUrl(url);
    if (!target) return { error: `"${url}" is not a valid http(s) URL.` };

    try {
      await mkdir(browserOutputDir, { recursive: true });
      const name = safeName(filename ?? new URL(target).hostname, "screenshot", "png");
      const out = path.join(browserOutputDir, name);
      const title = await withPage(target, async (page) => {
        await page.screenshot({ path: out, fullPage: true });
        return page.title();
      });
      return { url: target, pageTitle: title, path: out };
    } catch (err) {
      return { error: `Failed to screenshot "${target}": ${err instanceof Error ? err.message : String(err)}` };
    }
  },
});

export const browserExtractTextTool = defineTool("browser_extract_text", {
  description:
    "Open a web page in a headless browser and return its title and visible text content, so it can be read or summarized. Use this to look things up online or summarize a page.",
  parameters: z.object({
    url: z.string().describe("The page to read, e.g. 'example.com' or 'https://en.wikipedia.org/wiki/Weather'."),
  }),
  handler: async ({ url }: { url: string }) => {
    const target = normalizeUrl(url);
    if (!target) return { error: `"${url}" is not a valid http(s) URL.` };

    try {
      const { title, text } = await withPage(target, async (page) => ({
        title: await page.title(),
        text: (await page.innerText("body")).replace(/\n{3,}/g, "\n\n").trim(),
      }));
      // Cap the payload so a huge page doesn't blow up the context window.
      const MAX = 8000;
      const truncated = text.length > MAX;
      return {
        url: target,
        title,
        text: truncated ? text.slice(0, MAX) : text,
        truncated,
      };
    } catch (err) {
      return { error: `Failed to read "${target}": ${err instanceof Error ? err.message : String(err)}` };
    }
  },
});

export const browserSavePdfTool = defineTool("browser_save_pdf", {
  description:
    "Open a web page in a headless browser and save it as a PDF file. Use this when the user wants to save or archive a page as a PDF.",
  parameters: z.object({
    url: z.string().describe("The page to save, e.g. 'example.com'."),
    filename: z.string().optional().describe("Optional output file name (without a path). Defaults to the site's hostname."),
  }),
  handler: async ({ url, filename }) => {
    const target = normalizeUrl(url);
    if (!target) return { error: `"${url}" is not a valid http(s) URL.` };

    try {
      await mkdir(browserOutputDir, { recursive: true });
      const name = safeName(filename ?? new URL(target).hostname, "page", "pdf");
      const out = path.join(browserOutputDir, name);
      const title = await withPage(target, async (page) => {
        await page.pdf({ path: out, format: "A4", printBackground: true });
        return page.title();
      });
      return { url: target, pageTitle: title, path: out };
    } catch (err) {
      return { error: `Failed to save "${target}" as PDF: ${err instanceof Error ? err.message : String(err)}` };
    }
  },
});
