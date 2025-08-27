"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { getUpdateTypeColor, formatChangelogDate, type ChangelogEntry } from "@/utils/changelog";
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';

export function ChangelogCard({ entry }: { entry: ChangelogEntry }) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Define custom components with proper types
  const customComponents: Components = {
    h1: ({ children, ...props }) => <h2 className="text-xl font-bold text-foreground mb-3 mt-6 first:mt-0" {...props}>{children}</h2>,
    h2: ({ children, ...props }) => <h3 className="text-lg font-semibold text-foreground mb-2 mt-4" {...props}>{children}</h3>,
    h3: ({ children, ...props }) => <h4 className="text-base font-semibold text-foreground mb-2 mt-3" {...props}>{children}</h4>,
    h4: ({ children, ...props }) => <h5 className="text-sm font-semibold text-foreground mb-2 mt-2" {...props}>{children}</h5>,
    p: ({ children, ...props }) => <p className="mb-3 leading-relaxed" {...props}>{children}</p>,
    ul: ({ children, ...props }) => <ul className="list-disc list-outside space-y-1 mb-3 ml-6" {...props}>{children}</ul>,
    ol: ({ children, ...props }) => <ol className="list-decimal list-outside space-y-1 mb-3 ml-6" {...props}>{children}</ol>,
    li: ({ children, ...props }) => (
      <li className="text-sm mb-1" {...props}>
        <div className="flex-1">{children}</div>
      </li>
    ),
    code: ({ children, ...props }) => {
      // Check if this is inline code by checking if the className prop includes "language-"
      const isBlock = props.className?.includes('language-');
      if (!isBlock) {
        return <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono" {...props}>{children}</code>;
      }
      return <code className="block bg-muted p-3 rounded-md overflow-x-auto text-xs font-mono mb-3" {...props}>{children}</code>;
    },
    pre: ({ children, ...props }) => <pre className="bg-muted p-3 rounded-md overflow-x-auto text-xs font-mono mb-3" {...props}>{children}</pre>,
    blockquote: ({ children, ...props }) => <blockquote className="border-l-4 border-primary pl-4 italic mb-3 text-muted-foreground" {...props}>{children}</blockquote>,
    strong: ({ children, ...props }) => <strong className="font-semibold text-foreground" {...props}>{children}</strong>,
    em: ({ children, ...props }) => <em className="italic" {...props}>{children}</em>,
    a: ({ children, ...props }) => <a className="text-primary hover:underline" {...props}>{children}</a>,
    hr: ({ ...props }) => <hr className="my-4 border-border" {...props} />,
    table: ({ children, ...props }) => <table className="w-full border-collapse border border-border mb-3" {...props}>{children}</table>,
    thead: ({ children, ...props }) => <thead className="bg-muted" {...props}>{children}</thead>,
    tbody: ({ children, ...props }) => <tbody {...props}>{children}</tbody>,
    tr: ({ children, ...props }) => <tr className="border-b border-border" {...props}>{children}</tr>,
    td: ({ children, ...props }) => <td className="border border-border px-2 py-1 text-sm" {...props}>{children}</td>,
    th: ({ children, ...props }) => <th className="border border-border px-2 py-1 text-sm font-semibold" {...props}>{children}</th>,
  };

  // Extract a preview from the content (first paragraph after the title)
  const getPreview = (content: string) => {
    const lines = content.split('\n');
    const overviewIndex = lines.findIndex(line => line.toLowerCase().includes('## overview'));
    
    if (overviewIndex !== -1) {
      // Find the next non-empty line after overview
      for (let i = overviewIndex + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line && !line.startsWith('#') && !line.startsWith('**')) {
          return line.length > 200 ? line.substring(0, 200) + '...' : line;
        }
      }
    }
    
    // Fallback: get first substantial paragraph
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('**') && trimmed.length > 50) {
        return trimmed.length > 200 ? trimmed.substring(0, 200) + '...' : trimmed;
      }
    }
    
    return 'Click to view details...';
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <CardTitle className="text-xl">{entry.title}</CardTitle>
              {entry.metadata.version && (
                <Badge variant="outline" className="font-mono text-xs">
                  {entry.metadata.version}
                </Badge>
              )}
              {entry.metadata.type && (
                <Badge className={getUpdateTypeColor(entry.metadata.type)}>
                  {entry.metadata.type}
                </Badge>
              )}
              {entry.metadata.status && (
                <Badge variant="secondary" className="text-xs">
                  {entry.metadata.status}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <CalendarIcon className="h-4 w-4" />
              <span className="text-sm">
                {formatChangelogDate(entry.metadata.date)}
              </span>
            </div>
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors ml-4"
          >
            {isExpanded ? (
              <>
                <ChevronDownIcon className="h-4 w-4" />
                Hide Details
              </>
            ) : (
              <>
                <ChevronRightIcon className="h-4 w-4" />
                Show Details
              </>
            )}
          </button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {!isExpanded && (
            <p className="text-muted-foreground">{getPreview(entry.content)}</p>
          )}
          
          {isExpanded && (
            <div className="prose prose-sm max-w-none text-muted-foreground">
              <ReactMarkdown components={customComponents}>
                {entry.content}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
