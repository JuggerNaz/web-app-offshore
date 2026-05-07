import React, { useState, useRef, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { 
    X, 
    Save, 
    Undo, 
    Type, 
    Square, 
    ArrowUpRight, 
    Pencil, 
    Sun, 
    Contrast as ContrastIcon, 
    RotateCcw,
    MousePointer2,
} from 'lucide-react';
import { toast } from 'sonner';

interface AttachmentEditorDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    attachment: any;
    onSave: (updatedAttachment: any) => void;
}

export function AttachmentEditorDialog({ open, onOpenChange, attachment, onSave }: AttachmentEditorDialogProps) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [brightness, setBrightness] = useState(100);
    const [contrast, setContrast] = useState(100);
    const [activeTool, setActiveTool] = useState<'SELECT' | 'PEN' | 'RECT' | 'ARROW' | 'TEXT' | null>(null);
    const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [drawColor, setDrawColor] = useState('#ff0000');
    
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);
    const [drawHistory, setDrawHistory] = useState<any[]>([]);
    const [isDrawing, setIsDrawing] = useState(false);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });
    const [currentPath, setCurrentPath] = useState<any[]>([]);

    useEffect(() => {
        if (open && attachment) {
            setTitle(attachment.title || attachment.name || '');
            setDescription(attachment.description || attachment.meta?.description || '');
            setBrightness(100);
            setContrast(100);
            setDrawHistory([]);
            
            if (attachment.type === 'PHOTO' || !attachment.type) {
                const img = new Image();
                img.crossOrigin = "anonymous";
                const url = attachment.previewUrl || (attachment.publicUrl);
                img.src = url;
                img.onload = () => {
                    setImageObj(img);
                    // Use a small delay to ensure refs are ready
                    setTimeout(() => initCanvas(img), 100);
                };
            }
        }
    }, [open, attachment]);

    const initCanvas = (img: HTMLImageElement) => {
        const canvas = canvasRef.current;
        if (!canvas || !containerRef.current) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const containerWidth = containerRef.current.clientWidth - 40;
        const containerHeight = containerRef.current.clientHeight - 40;
        
        const imgRatio = img.width / img.height;
        const containerRatio = containerWidth / containerHeight;
        
        let displayWidth, displayHeight;
        if (imgRatio > containerRatio) {
            displayWidth = containerWidth;
            displayHeight = containerWidth / imgRatio;
        } else {
            displayHeight = containerHeight;
            displayWidth = containerHeight * imgRatio;
        }

        canvas.width = displayWidth;
        canvas.height = displayHeight;
        renderCanvas(img, displayWidth, displayHeight);
    };

    const renderCanvas = (imgOverride?: HTMLImageElement, w?: number, h?: number) => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        const img = imgOverride || imageObj;
        if (!ctx || !canvas || !img) return;

        const width = w || canvas.width;
        const height = h || canvas.height;

        ctx.clearRect(0, 0, width, height);
        
        ctx.save();
        ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
        ctx.drawImage(img, 0, 0, width, height);
        ctx.restore();

        drawHistory.forEach((item, idx) => {
            if (idx === selectedItemIndex) {
                ctx.save();
                ctx.setLineDash([5, 5]);
                ctx.shadowBlur = 10;
                ctx.shadowColor = item.color;
                drawItem(ctx, item);
                ctx.restore();
            } else {
                drawItem(ctx, item);
            }
        });
        
        if (isDrawing && currentPath.length > 0) {
            drawItem(ctx, { tool: activeTool, color: drawColor, path: currentPath });
        }
    };

    const drawItem = (ctx: CanvasRenderingContext2D, item: any) => {
        ctx.strokeStyle = item.color;
        ctx.fillStyle = item.color;
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        if (item.tool === 'PEN') {
            ctx.beginPath();
            item.path.forEach((p: any, i: number) => {
                if (i === 0) ctx.moveTo(p.x, p.y);
                else ctx.lineTo(p.x, p.y);
            });
            ctx.stroke();
        } else if (item.tool === 'RECT') {
            const start = item.path[0];
            const end = item.path[item.path.length - 1];
            ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
        } else if (item.tool === 'ARROW') {
            const start = item.path[0];
            const end = item.path[item.path.length - 1];
            drawArrow(ctx, start.x, start.y, end.x, end.y);
        } else if (item.tool === 'TEXT') {
            const start = item.path[0];
            ctx.font = 'bold 20px Arial';
            ctx.fillText(item.text || 'Text', start.x, start.y);
        }
    };

    const drawArrow = (ctx: CanvasRenderingContext2D, fromx: number, fromy: number, tox: number, toy: number) => {
        const headlen = 15;
        const angle = Math.atan2(toy - fromy, tox - fromx);
        ctx.beginPath();
        ctx.moveTo(fromx, fromy);
        ctx.lineTo(tox, toy);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(tox, toy);
        ctx.lineTo(tox - headlen * Math.cos(angle - Math.PI / 6), toy - headlen * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(tox - headlen * Math.cos(angle + Math.PI / 6), toy - headlen * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
    };
    const handleMouseDown = (e: React.MouseEvent) => {
        if (!activeTool) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        if (activeTool === 'SELECT') {
            // Find item under mouse (reverse order to get top-most)
            let foundIdx = -1;
            for (let i = drawHistory.length - 1; i >= 0; i--) {
                if (isPointInItem(x, y, drawHistory[i])) {
                    foundIdx = i;
                    break;
                }
            }
            setSelectedItemIndex(foundIdx);
            if (foundIdx !== -1) {
                setIsDragging(true);
                setStartPos({ x, y });
            }
            renderCanvas();
            return;
        }

        setIsDrawing(true);
        setStartPos({ x, y });
        setCurrentPath([{ x, y }]);
    };

    const isPointInItem = (x: number, y: number, item: any) => {
        // Simple bounding box hit test
        const minX = Math.min(...item.path.map((p: any) => p.x));
        const maxX = Math.max(...item.path.map((p: any) => p.x));
        const minY = Math.min(...item.path.map((p: any) => p.y));
        const maxY = Math.max(...item.path.map((p: any) => p.y));
        
        // Add padding for lines/arrows
        const pad = item.tool === 'PEN' || item.tool === 'ARROW' ? 10 : 0;
        return x >= minX - pad && x <= maxX + pad && y >= minY - pad && y <= maxY + pad;
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        if (isDragging && selectedItemIndex !== null) {
            const dx = x - startPos.x;
            const dy = y - startPos.y;
            
            setDrawHistory(prev => prev.map((item, idx) => {
                if (idx === selectedItemIndex) {
                    return {
                        ...item,
                        path: item.path.map((p: any) => ({ x: p.x + dx, y: p.y + dy }))
                    };
                }
                return item;
            }));
            setStartPos({ x, y });
            renderCanvas();
            return;
        }

        if (!isDrawing || !activeTool) return;
        
        if (activeTool === 'PEN') {
            setCurrentPath(prev => [...prev, { x, y }]);
        } else if (activeTool !== 'SELECT') {
            setCurrentPath([startPos, { x, y }]);
        }
        renderCanvas();
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        if (!isDrawing) return;
        setIsDrawing(false);
        
        if (activeTool === 'TEXT') {
            const text = prompt('Enter markup text:');
            if (text) {
                setDrawHistory(prev => [...prev, { tool: 'TEXT', color: drawColor, path: currentPath, text }]);
            }
        } else if (activeTool !== 'SELECT') {
            setDrawHistory(prev => [...prev, { tool: activeTool, color: drawColor, path: currentPath }]);
        }
        setCurrentPath([]);
        setTimeout(renderCanvas, 0);
    };

    const handleSave = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        if (attachment.type === 'PHOTO' || !attachment.type) {
            canvas.toBlob((blob) => {
                if (blob) {
                    const newFile = new File([blob], attachment.name, { type: 'image/jpeg' });
                    const newUrl = URL.createObjectURL(blob);
                    
                    onSave({
                        ...attachment,
                        title,
                        description,
                        file: newFile,
                        previewUrl: newUrl,
                        isEdited: true
                    });
                    toast.success('Attachment updated');
                    onOpenChange(false);
                }
            }, 'image/jpeg', 0.9);
        } else {
            onSave({
                ...attachment,
                title,
                description
            });
            onOpenChange(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0 overflow-hidden bg-slate-900 border-none shadow-2xl">
                <DialogHeader className="sr-only">
                    <DialogTitle>Edit Attachment: {attachment?.title || 'Photo'}</DialogTitle>
                    <DialogDescription>
                        Modify attachment metadata or apply visual markups and filters.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-1 overflow-hidden">
                    <div className="flex-1 flex flex-col min-w-0 bg-slate-950">
                        <div className="p-4 bg-slate-900/50 flex items-center justify-between border-b border-white/5">
                            <div className="flex items-center gap-4">
                                <div className="flex bg-slate-800 rounded-lg p-1 gap-1">
                                    <Button 
                                        variant={activeTool === 'SELECT' ? 'secondary' : 'ghost'} 
                                        size="sm" 
                                        onClick={() => { setActiveTool(activeTool === 'SELECT' ? null : 'SELECT'); setSelectedItemIndex(null); }}
                                        className={`h-8 w-8 p-0 ${activeTool === 'SELECT' ? 'text-white' : 'text-slate-300 hover:text-white'}`}
                                        title="Select / Move"
                                    ><MousePointer2 className="w-4 h-4" /></Button>
                                    <Button 
                                        variant={activeTool === 'PEN' ? 'secondary' : 'ghost'} 
                                        size="sm" 
                                        onClick={() => setActiveTool(activeTool === 'PEN' ? null : 'PEN')}
                                        className={`h-8 w-8 p-0 ${activeTool === 'PEN' ? 'text-white' : 'text-slate-300 hover:text-white'}`}
                                        title="Pencil"
                                    ><Pencil className="w-4 h-4" /></Button>
                                    <Button 
                                        variant={activeTool === 'RECT' ? 'secondary' : 'ghost'} 
                                        size="sm" 
                                        onClick={() => setActiveTool(activeTool === 'RECT' ? null : 'RECT')}
                                        className={`h-8 w-8 p-0 ${activeTool === 'RECT' ? 'text-white' : 'text-slate-300 hover:text-white'}`}
                                        title="Rectangle"
                                    ><Square className="w-4 h-4" /></Button>
                                    <Button 
                                        variant={activeTool === 'ARROW' ? 'secondary' : 'ghost'} 
                                        size="sm" 
                                        onClick={() => setActiveTool(activeTool === 'ARROW' ? null : 'ARROW')}
                                        className={`h-8 w-8 p-0 ${activeTool === 'ARROW' ? 'text-white' : 'text-slate-300 hover:text-white'}`}
                                        title="Arrow"
                                    ><ArrowUpRight className="w-4 h-4" /></Button>
                                    <Button 
                                        variant={activeTool === 'TEXT' ? 'secondary' : 'ghost'} 
                                        size="sm" 
                                        onClick={() => setActiveTool(activeTool === 'TEXT' ? null : 'TEXT')}
                                        className={`h-8 w-8 p-0 ${activeTool === 'TEXT' ? 'text-white' : 'text-slate-300 hover:text-white'}`}
                                        title="Text"
                                    ><Type className="w-4 h-4" /></Button>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="color" 
                                        value={drawColor} 
                                        onChange={(e) => setDrawColor(e.target.value)}
                                        className="w-6 h-6 rounded border-none bg-transparent cursor-pointer"
                                    />
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        onClick={() => { setDrawHistory(prev => prev.slice(0, -1)); setTimeout(renderCanvas, 0); }}
                                        disabled={drawHistory.length === 0}
                                        className="text-slate-400 h-8"
                                    ><Undo className="w-4 h-4" /></Button>
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        onClick={() => { setDrawHistory([]); setTimeout(renderCanvas, 0); }}
                                        className="text-red-400 h-8 hover:text-red-300 hover:bg-red-950/30"
                                    ><RotateCcw className="w-4 h-4" /></Button>
                                </div>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-slate-400 hover:text-white">
                                <X className="w-5 h-5" />
                            </Button>
                        </div>

                        <div ref={containerRef} className="flex-1 relative flex items-center justify-center p-8 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:20px_20px]">
                            {attachment?.type === 'VIDEO' ? (
                                <video src={attachment.previewUrl || attachment.publicUrl} controls className="max-w-full max-h-full rounded shadow-2xl" />
                            ) : (
                                <canvas 
                                    ref={canvasRef}
                                    onMouseDown={handleMouseDown}
                                    onMouseMove={handleMouseMove}
                                    onMouseUp={handleMouseUp}
                                    onMouseLeave={handleMouseUp}
                                    className={`shadow-2xl bg-black ${activeTool ? 'cursor-crosshair' : 'cursor-default'}`}
                                />
                            )}
                        </div>
                        
                        {(attachment?.type === 'PHOTO' || !attachment?.type) && (
                            <div className="p-4 bg-slate-900/50 flex items-center gap-8 border-t border-white/5">
                                <div className="flex items-center gap-4 flex-1 max-w-xs">
                                    <Sun className="w-4 h-4 text-slate-400" />
                                    <Slider 
                                        value={[brightness]} 
                                        onValueChange={([v]) => { setBrightness(v); setTimeout(renderCanvas, 0); }} 
                                        min={50} max={150} 
                                        className="flex-1"
                                    />
                                    <span className="text-[10px] font-mono text-slate-500 w-8">{brightness}%</span>
                                </div>
                                <div className="flex items-center gap-4 flex-1 max-w-xs">
                                    <ContrastIcon className="w-4 h-4 text-slate-400" />
                                    <Slider 
                                        value={[contrast]} 
                                        onValueChange={([v]) => { setContrast(v); setTimeout(renderCanvas, 0); }} 
                                        min={50} max={150} 
                                        className="flex-1"
                                    />
                                    <span className="text-[10px] font-mono text-slate-500 w-8">{contrast}%</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="w-80 border-l border-white/5 bg-slate-900 p-6 flex flex-col gap-6">
                        <div className="space-y-4">
                            <h3 className="text-xs font-black uppercase tracking-widest text-blue-500">Attachment Details</h3>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase text-slate-400">Title</Label>
                                <Input 
                                    value={title} 
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="bg-slate-800 border-white/10 text-white focus:border-blue-500"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase text-slate-400">Description</Label>
                                <textarea 
                                    value={description} 
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="w-full h-32 bg-slate-800 border border-white/10 rounded-md p-3 text-xs text-white focus:outline-none focus:border-blue-500 resize-none"
                                    placeholder="Add notes or observation..."
                                />
                            </div>
                        </div>

                        <div className="mt-auto space-y-3">
                            <Button 
                                className="w-full bg-blue-600 hover:bg-blue-500 font-bold uppercase tracking-wider h-11"
                                onClick={handleSave}
                            >
                                <Save className="w-4 h-4 mr-2" /> Save Changes
                            </Button>
                            <Button 
                                variant="outline" 
                                className="w-full border-white/10 bg-transparent hover:bg-white/5 text-slate-400 h-11"
                                onClick={() => onOpenChange(false)}
                            >
                                Discard
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
