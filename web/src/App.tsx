import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, getToolOrDynamicToolName, isToolOrDynamicToolUIPart } from "ai";
import { useMemo, useState } from "react";
import { Conversation, ConversationContent, Message, MessageText } from "./components/ai/conversation";
import { PromptInput, PromptSuggestions } from "./components/ai/prompt-input";
import { ToolInvocation } from "./components/eql/tool-results";

const SUGGESTIONS = [
  "What classes are available at launch?",
  "Search the wiki for Nagafen",
  "Latest official EQL news",
  "Suggest a WAR + CLR + MNK combo"
];

export default function App() {
  const [input, setInput] = useState("");
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/chat" }), []);

  const { messages, sendMessage, status } = useChat({ transport });
  const busy = status === "submitted" || status === "streaming";

  function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setInput("");
    void sendMessage({ text: trimmed });
  }

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-eql-border bg-eql-panel/70 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-col gap-1">
          <h1 className="font-display text-xl font-bold tracking-wide text-eql-gold">EverQuest Legends Guide</h1>
          <p className="text-sm text-eql-muted">
            AI chat grounded in the EQL wiki, official news, and curated public sources. Hosted on Cloudflare Workers — no custom domain required.
          </p>
        </div>
      </header>

      <Conversation>
        <ConversationContent>
          {messages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-eql-border bg-eql-panel/40 p-8 text-center">
              <p className="font-display text-lg text-eql-gold">Welcome, adventurer</p>
              <p className="mt-2 text-sm text-eql-muted">
                Ask about classes, races, zones, official news, or community guides. The guide searches live public sources before answering.
              </p>
            </div>
          ) : null}

          {messages.map((message) => (
            <Message key={message.id} role={message.role === "user" ? "user" : "assistant"}>
              {message.parts.map((part, index) => {
                if (part.type === "text") {
                  return part.text ? <MessageText key={index} text={part.text} /> : null;
                }
                if (isToolOrDynamicToolUIPart(part)) {
                  const toolName = getToolOrDynamicToolName(part);
                  const result = part.state === "output-available" ? part.output : undefined;
                  const errorText = part.state === "output-error" ? part.errorText : undefined;
                  return (
                    <ToolInvocation
                      key={`${part.toolCallId}-${index}`}
                      toolName={toolName}
                      state={part.state}
                      result={result}
                      errorText={errorText}
                    />
                  );
                }
                return null;
              })}
            </Message>
          ))}

          {busy ? (
            <Message role="assistant">
              <span className="inline-flex items-center gap-2 text-sm text-eql-muted">
                <span className="h-2 w-2 animate-pulse rounded-full bg-eql-gold" />
                Searching sources…
              </span>
            </Message>
          ) : null}
        </ConversationContent>

        {messages.length === 0 ? (
          <PromptSuggestions suggestions={SUGGESTIONS} onSelect={submit} disabled={busy} />
        ) : null}
      </Conversation>

      <PromptInput value={input} onChange={setInput} onSubmit={() => submit(input)} disabled={busy} />
    </div>
  );
}
