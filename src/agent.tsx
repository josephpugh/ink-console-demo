import React, { useState, useCallback, useEffect } from "react";
import { render, Box, Text, useApp, useInput } from "ink";
import TextInput from "ink-text-input";
import Gradient from "ink-gradient";
import BigText from "ink-big-text";
import Spinner from "ink-spinner";
import { marked } from "marked";
import { markedTerminal } from "marked-terminal";
import { CopilotClient } from "@github/copilot-sdk";
import type { PermissionHandler, PermissionRequestResult } from "@github/copilot-sdk";
import { getWeatherTool } from "./weather-tool.js";
import { writeMarkdownTool } from "./write-file-tool.js";
import {
  browserScreenshotTool,
  browserExtractTextTool,
  browserSavePdfTool,
  browserOutputDir,
} from "./browser-tools.js";

const apiKey = process.env.OPENAI_API_KEY ?? process.env.COPILOT_PROVIDER_API_KEY;
if (!apiKey) {
  throw new Error("Set OPENAI_API_KEY (or COPILOT_PROVIDER_API_KEY) before starting the agent.");
}

// Cohesive "sky to sunset" palette used across the UI.
const SKY = ["#36d1dc", "#5b86e5"];
const SUNSET = ["#f6d365", "#fda085"];

// Bubble sizing — single column with an asymmetric indent that hints left/right:
// user bubbles are pushed in from the left, agent bubbles in from the right.
const COLUMNS = process.stdout.columns ?? 80;
const INDENT = 6; // characters the bubble is inset from one side
const CONTENT_WIDTH = Math.max(36, COLUMNS - 2); // minus the root Box padding (1 each side)
const BUBBLE_WIDTH = CONTENT_WIDTH - INDENT; // both roles use this width, offset opposite ways
const INNER_WIDTH = BUBBLE_WIDTH - 4; // minus border (2) and horizontal padding (2)

// Render agent markdown to ANSI styling that Ink passes through verbatim.
marked.use(
  markedTerminal({
    width: INNER_WIDTH,
    reflowText: true,
    tab: 2,
    showSectionPrefix: false, // drop the leading "##" markers, keep heading styling
  }) as any
);

function renderMarkdown(md: string): string {
  try {
    return (marked.parse(md, { async: false }) as string).trimEnd();
  } catch {
    return md;
  }
}

interface Message {
  role: "user" | "agent";
  content: string;
  time: string;
}

const now = () =>
  new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// Bridge between the async permission handler and the Ink UI: the handler parks
// a request here, the App renders a y/n prompt, and the answer resolves the promise.
interface PendingPermission {
  filename: string;
  resolve: (allow: boolean) => void;
}
let setPendingPermission: ((p: PendingPermission | null) => void) | null = null;

const onPermissionRequest: PermissionHandler = (request) => {
  // Auto-approve everything except writing files, which needs explicit consent.
  if (request.kind === "custom-tool" && request.toolName === "write_markdown") {
    const raw = String(request.args?.filename ?? "file.md");
    const filename = raw.endsWith(".md") ? raw : `${raw}.md`;
    return new Promise<PermissionRequestResult>((resolve) => {
      const setPending = setPendingPermission;
      if (!setPending) {
        resolve({ kind: "reject", feedback: "No UI available to confirm the write." });
        return;
      }
      setPending({
        filename,
        resolve: (allow: boolean) => {
          setPending(null);
          resolve(
            allow
              ? { kind: "approve-once" }
              : { kind: "reject", feedback: "User declined the file write." }
          );
        },
      });
    });
  }
  return { kind: "approve-once" };
};

const client = new CopilotClient();
await client.start();

const session = await client.createSession({
  model: "gpt-4.1",
  provider: {
    type: "openai",
    baseUrl: "https://api.openai.com/v1",
    apiKey,
  },
  streaming: true,
  tools: [
    getWeatherTool,
    writeMarkdownTool,
    browserScreenshotTool,
    browserExtractTextTool,
    browserSavePdfTool,
  ],
  systemMessage: {
    content: [
      "You are a friendly assistant that specializes in weather but can also browse the web with a headless browser.",
      "For weather: use the get_weather tool to look up current US conditions and present them concisely. If asked about a non-US city, say you only support US cities for live weather.",
      "Browser tools: use browser_screenshot to capture a full-page PNG of a website, browser_extract_text to read or summarize a page's text content, and browser_save_pdf to archive a page as a PDF.",
      "Feel free to combine tools — e.g. read a page with browser_extract_text then use write_markdown to save a summary, or take a screenshot and report where it was saved.",
      `Screenshots and PDFs are saved under "${browserOutputDir}". Always tell the user the exact file path of anything you save.`,
      "When the user asks to save or write text/markdown, use the write_markdown tool (it writes to the current directory).",
    ].join(" "),
  },
  onPermissionRequest,
});

function Banner() {
  return (
    <Box flexDirection="column" alignItems="center" marginBottom={1}>
      <Gradient colors={SKY}>
        <BigText text="weather" font="tiny" />
      </Gradient>
      <Box marginTop={-1}>
        <Text dimColor>⛅  your friendly forecast companion  🌤</Text>
      </Box>
    </Box>
  );
}

function WelcomeCard() {
  const examples = [
    "What's the weather in Boston?",
    "Screenshot news.ycombinator.com",
    "Open example.com and save a summary to page.md",
  ];
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      paddingX={2}
      paddingY={1}
      marginBottom={1}
    >
      <Gradient colors={SUNSET}>
        <Text bold>✨ Try asking</Text>
      </Gradient>
      <Box marginTop={1} flexDirection="column">
        {examples.map((ex, i) => (
          <Text key={i} color="gray">
            <Text color="cyan">{"  › "}</Text>
            {ex}
          </Text>
        ))}
      </Box>
    </Box>
  );
}

function Bubble({
  message,
  width,
  format = false,
}: {
  message: Message;
  width: number;
  format?: boolean;
}) {
  const isUser = message.role === "user";
  const accent = isUser ? "gray" : "blue"; // user: gray · assistant: blue
  const label = isUser ? "You" : "Forecast";
  const icon = isUser ? "❯" : "⛅";
  const body = format ? renderMarkdown(message.content) : message.content;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={accent}
      paddingX={1}
      width={width}
      marginLeft={isUser ? INDENT : 0}
      marginBottom={1}
    >
      <Box justifyContent="space-between">
        <Text bold color={accent}>
          {icon} {label}
        </Text>
        <Text dimColor> {message.time}</Text>
      </Box>
      <Text wrap="wrap">{body}</Text>
    </Box>
  );
}

function App() {
  const { exit } = useApp();
  const bubbleWidth = BUBBLE_WIDTH;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [turnTime, setTurnTime] = useState("");
  const [cursorOn, setCursorOn] = useState(true);
  const [pending, setPending] = useState<PendingPermission | null>(null);

  // Let the permission handler drive a prompt through this component.
  useEffect(() => {
    setPendingPermission = setPending;
    return () => {
      setPendingPermission = null;
    };
  }, []);

  useInput((inputChar, key) => {
    if (key.ctrl && inputChar === "c") {
      client.stop().then(() => exit());
      return;
    }
    if (pending) {
      if (inputChar.toLowerCase() === "y" || key.return) pending.resolve(true);
      else if (inputChar.toLowerCase() === "n" || key.escape) pending.resolve(false);
    }
  });

  // Blink the typing cursor while a response is in flight.
  useEffect(() => {
    if (!loading) return;
    const id = setInterval(() => setCursorOn((c) => !c), 450);
    return () => clearInterval(id);
  }, [loading]);

  const handleSubmit = useCallback(
    async (value: string) => {
      if (!value.trim() || loading) return;
      if (value.trim().toLowerCase() === "exit") {
        await client.stop();
        exit();
        return;
      }

      setInput("");
      setMessages((prev) => [...prev, { role: "user", content: value, time: now() }]);
      setTurnTime(now());
      setStreamingText("");
      setLoading(true);

      // Append each streamed chunk to the live reply as it arrives.
      const unsubscribe = session.on("assistant.message_delta", (event) => {
        setStreamingText((prev) => prev + event.data.deltaContent);
      });

      try {
        const response = await session.sendAndWait({ prompt: value });
        const content = response?.data.content ?? "(no response)";
        setMessages((prev) => [...prev, { role: "agent", content, time: now() }]);
      } finally {
        unsubscribe();
        setStreamingText("");
        setLoading(false);
      }
    },
    [exit, loading]
  );

  return (
    <Box flexDirection="column" padding={1}>
      <Banner />

      {messages.length === 0 && <WelcomeCard />}

      {messages.map((msg, i) => (
        <Bubble key={i} message={msg} width={bubbleWidth} format={msg.role === "agent"} />
      ))}

      {loading && streamingText === "" && !pending && (
        <Box marginBottom={1}>
          <Text color="magenta">
            <Spinner type="dots" />
          </Text>
          <Gradient colors={SKY}>
            <Text> reading the skies…</Text>
          </Gradient>
        </Box>
      )}

      {loading && streamingText !== "" && (
        <Bubble
          message={{
            role: "agent",
            content: streamingText + (cursorOn ? "▋" : " "),
            time: turnTime,
          }}
          width={bubbleWidth}
        />
      )}

      {pending ? (
        <Box borderStyle="round" borderColor="yellow" paddingX={1} flexDirection="column">
          <Text>
            <Text bold color="yellow">{"⚠  Permission "}</Text>
            <Text>allow write to </Text>
            <Text bold color="cyan">{pending.filename}</Text>
            <Text>?</Text>
          </Text>
        </Box>
      ) : (
        <Box
          borderStyle="round"
          borderColor={loading ? "gray" : "cyan"}
          paddingX={1}
        >
          <Gradient colors={loading ? ["#777", "#777"] : SUNSET}>
            <Text bold>{"❯ "}</Text>
          </Gradient>
          <TextInput
            value={input}
            onChange={setInput}
            onSubmit={handleSubmit}
            placeholder={loading ? "reading the skies…" : "Ask about the weather in any US city…"}
          />
        </Box>
      )}

      <Box marginTop={0} paddingX={1}>
        {pending ? (
          <Text dimColor>
            <Text color="green">y</Text>/<Text color="green">↵</Text> allow ·{" "}
            <Text color="red">n</Text>/<Text color="red">esc</Text> deny
          </Text>
        ) : (
          <Text dimColor>
            ↵ send · type <Text color="cyan">exit</Text> or <Text color="cyan">Ctrl+C</Text> to quit
          </Text>
        )}
      </Box>
    </Box>
  );
}

render(<App />);
