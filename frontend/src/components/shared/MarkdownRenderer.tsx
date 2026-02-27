import React, { useCallback } from 'react';
import ReactMarkdown from 'react-markdown';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/* ------------------------------------------------------------------ */
/*  Copy-to-clipboard helper                                           */
/* ------------------------------------------------------------------ */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);

  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      onClick={copy}
      className="absolute right-2 top-2 rounded border border-nexus-border bg-nexus-surface px-2 py-0.5
                 text-[10px] text-nexus-muted transition hover:bg-nexus-card/10 hover:text-nexus-text"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  return (
    <div className={`prose prose-invert max-w-none prose-sm ${className}`}>
      <ReactMarkdown
        components={{
          // Headings
          h1: ({ children }) => <h1 className="gradient-text text-2xl font-bold mb-4">{children}</h1>,
          h2: ({ children }) => <h2 className="text-xl font-semibold text-nexus-text mt-6 mb-3">{children}</h2>,
          h3: ({ children }) => <h3 className="text-lg font-semibold text-nexus-text mt-4 mb-2">{children}</h3>,

          // Paragraphs
          p: ({ children }) => <p className="text-nexus-text/90 leading-relaxed mb-3">{children}</p>,

          // Links
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-nexus-primary hover:text-nexus-primary/70 underline underline-offset-2 transition-colors"
            >
              {children}
            </a>
          ),

          // Inline code
          code: ({ className: codeClassName, children, ...props }) => {
            const isBlock = codeClassName?.includes('language-');
            const text = String(children).replace(/\n$/, '');

            if (isBlock) {
              return (
                <div className="relative my-3 group">
                  <CopyButton text={text} />
                  <pre className="overflow-x-auto rounded-xl border border-nexus-border bg-nexus-bg/80 p-4 text-sm">
                    <code className={`${codeClassName ?? ''} text-nexus-text/90`} {...props}>
                      {children}
                    </code>
                  </pre>
                </div>
              );
            }

            return (
              <code className="rounded bg-nexus-surface px-1.5 py-0.5 text-xs text-nexus-primary font-mono" {...props}>
                {children}
              </code>
            );
          },

          // Pre (passthrough — handled in code)
          pre: ({ children }) => <>{children}</>,

          // Tables
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto rounded-lg border border-nexus-border">
              <table className="min-w-full text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-nexus-surface/60">{children}</thead>,
          th: ({ children }) => (
            <th className="border-b border-nexus-border px-4 py-2 text-left font-semibold text-nexus-text">{children}</th>
          ),
          td: ({ children }) => (
            <td className="border-b border-nexus-border/30 px-4 py-2 text-nexus-text/80">{children}</td>
          ),

          // Lists
          ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1 text-nexus-text/90">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1 text-nexus-text/90">{children}</ol>,

          // Block-quote
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-nexus-primary/40 pl-4 my-3 italic text-nexus-muted">
              {children}
            </blockquote>
          ),

          // Horizontal rule
          hr: () => <hr className="my-6 border-nexus-border/50" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
