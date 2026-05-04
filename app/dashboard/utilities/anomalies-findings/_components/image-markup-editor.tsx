"use client";

import React, { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Pencil, 
  Type, 
  RotateCcw, 
  Trash2, 
  Download, 
  Save, 
  Palette 
} from "lucide-react";

interface ImageMarkupEditorProps {
  imageUrl: string;
  onSave?: (canvasDataUrl: string) => void;
}

export function ImageMarkupEditor({ imageUrl, onSave }: ImageMarkupEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [tool, setTool] = useState<"draw" | "text">("draw");
  const [color, setColor] = useState("#ef4444"); // Default red
  const [isDrawing, setIsDrawing] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [textPos, setTextPos] = useState<{ x: number; y: number } | null>(null);
  const [history, setHistory] = useState<string[]>([]);

  // Load the image onto the canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl;
    img.onload = () => {
      // Scale canvas to fit image while capping max size
      const maxWidth = 800;
      const scale = Math.min(1, maxWidth / img.width);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      // Save initial state to history
      setHistory([canvas.toDataURL()]);
    };
  }, [imageUrl]);

  const saveHistory = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setHistory((prev) => [...prev, canvas.toDataURL()]);
  };

  const undo = () => {
    if (history.length <= 1) return;
    const newHistory = [...history];
    newHistory.pop(); // Remove current state
    const previousState = newHistory[newHistory.length - 1];

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.src = previousState;
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      setHistory(newHistory);
    };
  };

  const clearAll = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl;
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      setHistory([canvas.toDataURL()]);
    };
    setTextPos(null);
    setTextInput("");
  };

  // Draw Mode Handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool !== "draw") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || tool !== "draw") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      saveHistory();
    }
  };

  // Text Mode Handlers
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool !== "text") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setTextPos({ x, y });
  };

  const applyText = () => {
    if (!textPos || !textInput) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = color;
    ctx.font = "bold 20px Arial";
    ctx.fillText(textInput, textPos.x, textPos.y);

    saveHistory();
    setTextInput("");
    setTextPos(null);
  };

  const downloadImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = url;
    link.download = "marked-inspection-image.png";
    link.click();
  };

  const handleSaveToDB = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (onSave) {
      onSave(canvas.toDataURL("image/png"));
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full bg-background/50 p-3 rounded-lg border border-border">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 w-full border-b border-border pb-2">
        <div className="flex items-center gap-2">
          <Button
            variant={tool === "draw" ? "default" : "outline"}
            size="sm"
            onClick={() => setTool("draw")}
            className="h-8 px-3 text-xs flex items-center gap-1"
          >
            <Pencil className="h-3.5 w-3.5" /> Mark
          </Button>
          <Button
            variant={tool === "text" ? "default" : "outline"}
            size="sm"
            onClick={() => setTool("text")}
            className="h-8 px-3 text-xs flex items-center gap-1"
          >
            <Type className="h-3.5 w-3.5" /> Text
          </Button>

          {/* Color Select */}
          <div className="flex items-center gap-1 ml-2">
            <Palette className="h-3.5 w-3.5 text-muted-foreground" />
            <input 
              type="color" 
              value={color} 
              onChange={(e) => setColor(e.target.value)} 
              className="w-6 h-6 rounded cursor-pointer border-none bg-transparent"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={undo}
            disabled={history.length <= 1}
            className="h-8 w-8"
            title="Undo"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={clearAll}
            className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
            title="Clear"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={downloadImage}
            className="h-8 px-3 text-xs flex items-center gap-1"
          >
            <Download className="h-3.5 w-3.5" /> Download
          </Button>
          {onSave && (
            <Button
              variant="default"
              size="sm"
              onClick={handleSaveToDB}
              className="h-8 px-3 text-xs flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700"
            >
              <Save className="h-3.5 w-3.5" /> Save
            </Button>
          )}
        </div>
      </div>

      {/* Text Input overlay for placement */}
      {tool === "text" && textPos && (
        <div className="flex items-center gap-2 w-full max-w-sm">
          <Input
            placeholder="Type text to insert..."
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            className="h-8 text-xs bg-background border-border"
            autoFocus
          />
          <Button size="sm" onClick={applyText} className="h-8 text-xs">
            Apply
          </Button>
        </div>
      )}

      {/* Canvas Area */}
      <div className="relative border border-border/80 bg-muted/20 rounded-md shadow-inner overflow-hidden cursor-crosshair">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onClick={handleCanvasClick}
          className="block max-w-full"
        />
      </div>

      {tool === "text" && !textPos && (
        <span className="text-[10px] text-muted-foreground italic">
          * Click anywhere on the image above to place the text insertion mark.
        </span>
      )}
    </div>
  );
}
