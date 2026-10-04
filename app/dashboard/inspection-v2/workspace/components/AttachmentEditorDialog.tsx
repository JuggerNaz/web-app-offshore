import React, { useState, useRef, useEffect, useCallback } from 'react';
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
    FileText,
    Video,
    ExternalLink,
    RefreshCw,
    Upload,
    CheckCircle2,
    FileUp,
    ImagePlus,
    RotateCw
} from 'lucide-react';
import { toast } from "sonner";

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
    
    // Replacement state
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [replacedFile, setReplacedFile] = useState<File | null>(null);
    const [replacementPreviewUrl, setReplacementPreviewUrl] = useState<string | null>(null);
    const [isReplaced, setIsReplaced] = useState<boolean>(false);
    const [replacedFileType, setReplacedFileType] = useState<'PHOTO' | 'VIDEO' | 'DOCUMENT' | null>(null);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const imageObjRef = useRef<HTMLImageElement | null>(null);
    const activeLoadIdRef = useRef<number>(0);

    const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);
    const [drawHistory, setDrawHistory] = useState<any[]>([]);
    const [isDrawing, setIsDrawing] = useState(false);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });
    const [currentPath, setCurrentPath] = useState<any[]>([]);

    const [isLoadingImage, setIsLoadingImage] = useState(false);
    const [imageLoadError, setImageLoadError] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);

    const renderCanvas = useCallback((imgOverride?: HTMLImageElement | null) => {
        const canvas = canvasRef.current;
        const img = imgOverride !== undefined ? imgOverride : (imageObjRef.current || imageObj);
        if (!canvas || !img) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 1. Draw image with filters
        ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        ctx.filter = 'none'; // reset filter for annotations

        // 2. Draw History Items
        drawHistory.forEach((item, index) => {
            ctx.strokeStyle = item.color;
            ctx.fillStyle = item.color;
            ctx.lineWidth = item.lineWidth || 3;
            ctx.font = 'bold 16px sans-serif';

            if (item.type === 'PEN') {
                if (item.path.length < 2) return;
                ctx.beginPath();
                ctx.moveTo(item.path[0].x, item.path[0].y);
                for (let i = 1; i < item.path.length; i++) {
                    ctx.lineTo(item.path[i].x, item.path[i].y);
                }
                ctx.stroke();
            } else if (item.type === 'RECT') {
                ctx.strokeRect(item.x, item.y, item.width, item.height);
            } else if (item.type === 'ARROW') {
                drawArrow(ctx, item.fromX, item.fromY, item.toX, item.toY);
            } else if (item.type === 'TEXT') {
                ctx.fillText(item.text, item.x, item.y);
            }

            // Selection box for active move
            if (activeTool === 'SELECT' && selectedItemIndex === index) {
                ctx.strokeStyle = '#3b82f6';
                ctx.lineWidth = 1;
                ctx.setLineDash([4, 4]);
                const bounds = getItemBounds(item);
                ctx.strokeRect(bounds.x - 4, bounds.y - 4, bounds.width + 8, bounds.height + 8);
                ctx.setLineDash([]);
            }
        });

        // 3. Draw current interactive stroke
        if (isDrawing) {
            ctx.strokeStyle = drawColor;
            ctx.lineWidth = 3;
            if (activeTool === 'PEN' && currentPath.length > 1) {
                ctx.beginPath();
                ctx.moveTo(currentPath[0].x, currentPath[0].y);
                for (let i = 1; i < currentPath.length; i++) {
                    ctx.lineTo(currentPath[i].x, currentPath[i].y);
                }
                ctx.stroke();
            }
        }
    }, [imageObj, brightness, contrast, drawHistory, activeTool, selectedItemIndex, isDrawing, drawColor, currentPath]);

    const initCanvas = useCallback((imgOverride?: HTMLImageElement | null) => {
        const img = imgOverride || imageObjRef.current || imageObj;
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !img || !container) return;
        
        const containerW = container.clientWidth > 100 ? container.clientWidth : (window.innerWidth ? Math.min(window.innerWidth * 0.6, 900) : 800);
        const containerH = container.clientHeight > 100 ? container.clientHeight : (window.innerHeight ? Math.min(window.innerHeight * 0.7, 700) : 600);

        const maxW = Math.max(containerW - 48, 300);
        const maxH = Math.max(containerH - 48, 300);
        
        const naturalW = img.naturalWidth || img.width || 800;
        const naturalH = img.naturalHeight || img.height || 600;
        
        const ratio = Math.min(maxW / naturalW, maxH / naturalH, 1);
        canvas.width = Math.round(naturalW * ratio);
        canvas.height = Math.round(naturalH * ratio);

        renderCanvas(img);
    }, [imageObj, renderCanvas]);

    const loadImage = async () => {
        if (!attachment) return;

        const isPhoto = !attachment?.type || 
            String(attachment?.type).toUpperCase() === 'PHOTO' || 
            String(attachment?.type).toLowerCase().includes('image') || 
            String(attachment?.meta?.type).toUpperCase() === 'PHOTO' ||
            (!String(attachment?.type).toUpperCase().includes('VIDEO') && !String(attachment?.type).toUpperCase().includes('DOCUMENT'));

        if (!isPhoto) return;

        const currentLoadId = ++activeLoadIdRef.current;
        imageObjRef.current = null;
        setImageObj(null);
        setIsLoadingImage(true);
        setImageLoadError(false);

        const candidates: string[] = [];

        // 1. Direct local Blob (if present in memory)
        if (attachment.file && attachment.file instanceof File) {
            try {
                candidates.push(URL.createObjectURL(attachment.file));
            } catch {}
        }

        // 2. Proxied API URLs (Primary candidates to guarantee same-origin CORS streaming for canvas)
        if (attachment.id) {
            const idStr = String(attachment.id);
            const pathParam = attachment.path || attachment.meta?.file_path || '';
            if (pathParam) {
                candidates.push(`/api/attachment/url?id=${encodeURIComponent(idStr)}&path=${encodeURIComponent(pathParam)}`);
            }
            candidates.push(`/api/attachment/url?id=${encodeURIComponent(idStr)}`);
        }

        const rawPath = attachment.path || attachment.meta?.file_path || attachment.file_path;
        if (rawPath) {
            const bucket = attachment.meta?.bucket || 'attachments';
            candidates.push(`/api/attachment/download?path=${encodeURIComponent(rawPath)}&bucket=${encodeURIComponent(bucket)}`);
            candidates.push(`/api/attachment/download?path=${encodeURIComponent(rawPath)}`);
        }

        // 3. Fallback direct / public URLs
        if (attachment.previewUrl && !attachment.previewUrl.startsWith('http')) {
            candidates.push(attachment.previewUrl);
        }
        if (attachment.meta?.file_url) candidates.push(attachment.meta.file_url);
        if (attachment.previewUrl) candidates.push(attachment.previewUrl);
        if (attachment.publicUrl) candidates.push(attachment.publicUrl);
        if (rawPath && (rawPath.startsWith('http://') || rawPath.startsWith('https://') || rawPath.startsWith('blob:') || rawPath.startsWith('data:'))) {
            candidates.push(rawPath);
        }

        const uniqueCandidates = Array.from(new Set(candidates.filter(Boolean)));

        const tryLoadCandidate = async (url: string): Promise<HTMLImageElement | null> => {
            if (!url) return null;

            // Attempt 1: Fetch as blob to guarantee CORS compliance on canvas
            try {
                const resp = await fetch(url);
                if (resp.ok) {
                    const blob = await resp.blob();
                    if (blob.size > 0) {
                        const blobUrl = URL.createObjectURL(blob);
                        const blobImg = new Image();
                        const loaded = await new Promise<HTMLImageElement | null>((resolve) => {
                            blobImg.onload = () => resolve(blobImg);
                            blobImg.onerror = () => resolve(null);
                            blobImg.src = blobUrl;
                        });
                        if (loaded) return loaded;
                    }
                }
            } catch {}

            // Attempt 2: Direct Image load with crossOrigin
            const loadDirect = (useCross: boolean) => new Promise<HTMLImageElement | null>((resolve) => {
                const img = new Image();
                if (useCross && typeof window !== 'undefined' && (url.startsWith('http://') || url.startsWith('https://'))) {
                    try {
                        const parsed = new URL(url);
                        if (parsed.host !== window.location.host) {
                            img.crossOrigin = "anonymous";
                        }
                    } catch {}
                }
                const timeout = setTimeout(() => {
                    img.onload = null;
                    img.onerror = null;
                    resolve(null);
                }, 4000);
                img.onload = () => {
                    clearTimeout(timeout);
                    resolve(img);
                };
                img.onerror = () => {
                    clearTimeout(timeout);
                    resolve(null);
                };
                img.src = url;
            });

            const withCross = await loadDirect(true);
            if (withCross) return withCross;

            // Attempt 3: Direct Image load without crossOrigin
            return await loadDirect(false);
        };

        let loadedImg: HTMLImageElement | null = null;
        for (const cand of uniqueCandidates) {
            try {
                loadedImg = await tryLoadCandidate(cand);
                if (loadedImg) break;
            } catch {}
        }

        if (activeLoadIdRef.current !== currentLoadId) {
            // Superseded by another attachment selection
            return;
        }

        setIsLoadingImage(false);
        if (loadedImg) {
            imageObjRef.current = loadedImg;
            setImageObj(loadedImg);
        } else {
            setImageLoadError(true);
        }
    };

    const handleFileReplace = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const isImage = file.type.startsWith('image/');
        const isVid = file.type.startsWith('video/');
        const isDocFile = !isImage && !isVid;

        const localBlobUrl = URL.createObjectURL(file);
        setReplacedFile(file);
        setReplacementPreviewUrl(localBlobUrl);
        setIsReplaced(true);
        setReplacedFileType(isImage ? 'PHOTO' : isVid ? 'VIDEO' : 'DOCUMENT');

        if (isImage) {
            setIsLoadingImage(true);
            setImageLoadError(false);
            const img = new Image();
            img.onload = () => {
                imageObjRef.current = img;
                setImageObj(img);
                setImageLoadError(false);
                setIsLoadingImage(false);
                setDrawHistory([]);
                initCanvas(img);
            };
            img.onerror = () => {
                setIsLoadingImage(false);
                setImageLoadError(true);
            };
            img.src = localBlobUrl;
        } else {
            imageObjRef.current = null;
            setImageObj(null);
            setIsLoadingImage(false);
            setImageLoadError(false);
        }

        toast.success(`Attachment replaced with ${file.name}`);
        // Reset file input value so same file can be re-selected if desired
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleRevertReplacement = () => {
        setReplacedFile(null);
        setReplacementPreviewUrl(null);
        setIsReplaced(false);
        setReplacedFileType(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        loadImage();
        toast.info("Reverted back to original attachment");
    };

    useEffect(() => {
        if (open && attachment) {
            setTitle(attachment?.title || attachment?.name || '');
            setDescription(attachment?.description || attachment?.meta?.description || '');
            setBrightness(100);
            setContrast(100);
            setDrawHistory([]);
            setImageLoadError(false);
            setReplacedFile(null);
            setReplacementPreviewUrl(null);
            setIsReplaced(false);
            setReplacedFileType(null);
            loadImage();
        } else if (!open) {
            imageObjRef.current = null;
            setImageObj(null);
            setReplacedFile(null);
            setReplacementPreviewUrl(null);
            setIsReplaced(false);
            setReplacedFileType(null);
            activeLoadIdRef.current++;
        }
    }, [open, attachment?.id, attachment?.path, attachment?.previewUrl, reloadKey]);

    // Redraw canvas whenever image object, container size, filters, or draw history changes
    useEffect(() => {
        if (!isLoadingImage && imageObj && canvasRef.current) {
            initCanvas(imageObj);
        }
    }, [isLoadingImage, imageObj, initCanvas]);

    // Resize observer to keep canvas perfectly fitted on layout transitions
    useEffect(() => {
        if (!containerRef.current) return;
        const ro = new ResizeObserver(() => {
            if (imageObjRef.current && canvasRef.current) {
                initCanvas(imageObjRef.current);
            }
        });
        ro.observe(containerRef.current);
        return () => ro.disconnect();
    }, [initCanvas]);

    const drawArrow = (ctx: CanvasRenderingContext2D, fromX: number, fromY: number, toX: number, toY: number) => {
        const headlen = 12;
        const angle = Math.atan2(toY - fromY, toX - fromX);
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(toX, toY);
        ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
    };

    const getItemBounds = (item: any) => {
        if (item.type === 'RECT') {
            return { x: item.x, y: item.y, width: item.width, height: item.height };
        } else if (item.type === 'ARROW') {
            const minX = Math.min(item.fromX, item.toX);
            const minY = Math.min(item.fromY, item.toY);
            const maxX = Math.max(item.fromX, item.toX);
            const maxY = Math.max(item.fromY, item.toY);
            return { x: minX, y: minY, width: maxX - minX || 10, height: maxY - minY || 10 };
        } else if (item.type === 'TEXT') {
            return { x: item.x, y: item.y - 16, width: 100, height: 20 };
        } else if (item.type === 'PEN') {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            item.path.forEach((p: any) => {
                minX = Math.min(minX, p.x);
                minY = Math.min(minY, p.y);
                maxX = Math.max(maxX, p.x);
                maxY = Math.max(maxY, p.y);
            });
            return { x: minX, y: minY, width: maxX - minX || 10, height: maxY - minY || 10 };
        }
        return { x: 0, y: 0, width: 0, height: 0 };
    };

    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (activeTool === 'SELECT') {
            for (let i = drawHistory.length - 1; i >= 0; i--) {
                const b = getItemBounds(drawHistory[i]);
                if (x >= b.x - 5 && x <= b.x + b.width + 5 && y >= b.y - 5 && y <= b.y + b.height + 5) {
                    setSelectedItemIndex(i);
                    setIsDragging(true);
                    setDragOffset({ x: x - b.x, y: y - b.y });
                    setTimeout(() => renderCanvas(), 0);
                    return;
                }
            }
            setSelectedItemIndex(null);
            setTimeout(() => renderCanvas(), 0);
            return;
        }

        if (!activeTool) return;

        setIsDrawing(true);
        setStartPos({ x, y });

        if (activeTool === 'PEN') {
            setCurrentPath([{ x, y }]);
        } else if (activeTool === 'TEXT') {
            const text = prompt('Enter annotation text:');
            if (text) {
                setDrawHistory(prev => [...prev, {
                    type: 'TEXT',
                    text,
                    x,
                    y,
                    color: drawColor
                }]);
            }
            setIsDrawing(false);
        }
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (isDragging && selectedItemIndex !== null) {
            const item = drawHistory[selectedItemIndex];
            if (!item) return;

            const newHistory = [...drawHistory];
            const dx = x - dragOffset.x;
            const dy = y - dragOffset.y;

            if (item.type === 'RECT' || item.type === 'TEXT') {
                newHistory[selectedItemIndex] = { ...item, x: dx, y: dy };
            } else if (item.type === 'ARROW') {
                const diffX = dx - item.fromX;
                const diffY = dy - item.fromY;
                newHistory[selectedItemIndex] = {
                    ...item,
                    fromX: item.fromX + diffX,
                    fromY: item.fromY + diffY,
                    toX: item.toX + diffX,
                    toY: item.toY + diffY
                };
            } else if (item.type === 'PEN') {
                const b = getItemBounds(item);
                const diffX = dx - b.x;
                const diffY = dy - b.y;
                newHistory[selectedItemIndex] = {
                    ...item,
                    path: item.path.map((p: any) => ({ x: p.x + diffX, y: p.y + diffY }))
                };
            }
            setDrawHistory(newHistory);
            return;
        }

        if (!isDrawing) return;

        if (activeTool === 'PEN') {
            setCurrentPath(prev => [...prev, { x, y }]);
            renderCanvas();
        } else if (activeTool === 'RECT' || activeTool === 'ARROW') {
            renderCanvas();
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            ctx.strokeStyle = drawColor;
            ctx.lineWidth = 3;
            if (activeTool === 'RECT') {
                ctx.strokeRect(startPos.x, startPos.y, x - startPos.x, y - startPos.y);
            } else if (activeTool === 'ARROW') {
                drawArrow(ctx, startPos.x, startPos.y, x, y);
            }
        }
    };

    const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (isDragging) {
            setIsDragging(false);
            return;
        }

        if (!isDrawing) return;
        setIsDrawing(false);

        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (activeTool === 'PEN') {
            if (currentPath.length > 1) {
                setDrawHistory(prev => [...prev, {
                    type: 'PEN',
                    path: currentPath,
                    color: drawColor,
                    lineWidth: 3
                }]);
            }
            setCurrentPath([]);
        } else if (activeTool === 'RECT') {
            setDrawHistory(prev => [...prev, {
                type: 'RECT',
                x: Math.min(startPos.x, x),
                y: Math.min(startPos.y, y),
                width: Math.abs(x - startPos.x),
                height: Math.abs(y - startPos.y),
                color: drawColor,
                lineWidth: 3
            }]);
        } else if (activeTool === 'ARROW') {
            setDrawHistory(prev => [...prev, {
                type: 'ARROW',
                fromX: startPos.x,
                fromY: startPos.y,
                toX: x,
                toY: y,
                color: drawColor,
                lineWidth: 3
            }]);
        }
    };

    const handleSave = () => {
        const canvas = canvasRef.current;
        const effectiveFile = replacedFile || attachment?.file;
        const effectiveName = title || replacedFile?.name || attachment?.name || 'attachment.jpg';
        const effectiveType = replacedFileType || (effectiveFile?.type?.startsWith('video/') ? 'VIDEO' : effectiveFile?.type?.startsWith('image/') ? 'PHOTO' : (attachment?.type || 'PHOTO'));

        if (canvas && (drawHistory.length > 0 || isReplaced) && (effectiveType === 'PHOTO' || (!replacedFileType && !isVideo && !isDoc))) {
            try {
                canvas.toBlob((blob) => {
                    if (blob) {
                        const newFile = new File([blob], effectiveName, { type: replacedFile?.type || 'image/jpeg' });
                        const newUrl = URL.createObjectURL(blob);
                        onSave({
                            ...attachment,
                            title,
                            name: effectiveName,
                            description,
                            file: newFile,
                            previewUrl: newUrl,
                            type: effectiveType,
                            meta: {
                                ...(attachment?.meta || {}),
                                title,
                                description,
                                file_name: effectiveName,
                                file_size: newFile.size,
                                type: effectiveType
                            },
                            isEdited: true
                        });
                        onOpenChange(false);
                    } else if (replacedFile) {
                        onSave({
                            ...attachment,
                            title,
                            name: effectiveName,
                            description,
                            file: replacedFile,
                            previewUrl: replacementPreviewUrl,
                            type: effectiveType,
                            meta: {
                                ...(attachment?.meta || {}),
                                title,
                                description,
                                file_name: effectiveName,
                                file_size: replacedFile.size,
                                type: effectiveType
                            },
                            isEdited: true
                        });
                        onOpenChange(false);
                    } else {
                        onSave({
                            ...attachment,
                            title,
                            name: title || attachment?.name,
                            description
                        });
                        onOpenChange(false);
                    }
                }, replacedFile?.type || 'image/jpeg', 0.9);
            } catch (canvasErr) {
                console.warn("[AttachmentEditorDialog] Canvas toBlob error:", canvasErr);
                onSave({
                    ...attachment,
                    title,
                    name: effectiveName,
                    description,
                    ...(replacedFile ? {
                        file: replacedFile,
                        previewUrl: replacementPreviewUrl,
                        type: effectiveType,
                        meta: {
                            ...(attachment?.meta || {}),
                            title,
                            description,
                            file_name: effectiveName,
                            file_size: replacedFile.size,
                            type: effectiveType
                        },
                        isEdited: true
                    } : {})
                });
                onOpenChange(false);
            }
        } else if (isReplaced && replacedFile) {
            onSave({
                ...attachment,
                title,
                name: effectiveName,
                description,
                file: replacedFile,
                previewUrl: replacementPreviewUrl,
                type: effectiveType,
                meta: {
                    ...(attachment?.meta || {}),
                    title,
                    description,
                    file_name: effectiveName,
                    file_size: replacedFile.size,
                    type: effectiveType
                },
                isEdited: true
            });
            onOpenChange(false);
        } else {
            onSave({
                ...attachment,
                title,
                name: title || attachment?.name,
                description
            });
            onOpenChange(false);
        }
    };

    if (!open && !attachment) return null;

    const isVideo = replacedFileType ? replacedFileType === 'VIDEO' : (String(attachment?.type).toUpperCase() === 'VIDEO' || String(attachment?.meta?.type).toUpperCase() === 'VIDEO');
    const isDoc = replacedFileType ? replacedFileType === 'DOCUMENT' : (String(attachment?.type).toUpperCase() === 'DOCUMENT' || String(attachment?.meta?.type).toUpperCase() === 'DOCUMENT');
    const rawDirectUrl = replacementPreviewUrl || (attachment?.id ? `/api/attachment/url?id=${attachment.id}` : '') || attachment?.previewUrl || (attachment?.path ? `/api/attachment/download?path=${encodeURIComponent(attachment.path)}` : '');

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0 overflow-hidden bg-slate-900 border-none shadow-2xl">
                <DialogHeader className="sr-only">
                    <DialogTitle>Edit Attachment: {attachment?.title || attachment?.name || 'Photo'}</DialogTitle>
                    <DialogDescription>
                        Modify attachment metadata, replace file, or apply visual markups and filters.
                    </DialogDescription>
                </DialogHeader>

                {/* Hidden File Input for Replacement */}
                <input 
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileReplace}
                    accept="image/*,video/*,application/pdf,.doc,.docx"
                    className="hidden"
                />

                <div className="flex flex-1 overflow-hidden">
                    <div className="flex-1 flex flex-col min-w-0 bg-slate-950">
                        <div className="p-4 bg-slate-900/50 flex items-center justify-between border-b border-white/5">
                            <div className="flex items-center gap-4">
                                {!isVideo && !isDoc && (
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
                                )}

                                {!isVideo && !isDoc && (
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
                                            onClick={() => setDrawHistory(prev => prev.slice(0, -1))}
                                            disabled={drawHistory.length === 0}
                                            className="text-slate-400 h-8"
                                            title="Undo"
                                        ><Undo className="w-4 h-4" /></Button>
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            onClick={() => setDrawHistory([])}
                                            className="text-red-400 h-8 hover:text-red-300 hover:bg-red-950/30"
                                            title="Clear Annotations"
                                        ><RotateCcw className="w-4 h-4" /></Button>
                                    </div>
                                )}

                                {/* Top Toolbar: Replace File Action Button */}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="h-8 px-2.5 text-xs font-bold text-blue-400 hover:text-white hover:bg-blue-600 bg-slate-800 border-blue-500/30 hover:border-blue-400 gap-1.5 transition-colors shadow-sm"
                                    title="Choose a new file to replace this attachment"
                                >
                                    <Upload className="w-3.5 h-3.5 text-blue-400 group-hover:text-white" />
                                    <span>Replace File</span>
                                </Button>
                            </div>

                            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-slate-400 hover:text-white">
                                <X className="w-5 h-5" />
                            </Button>
                        </div>

                        <div ref={containerRef} className="flex-1 relative flex items-center justify-center p-6 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:20px_20px] overflow-hidden">
                            {isVideo ? (
                                <div className="flex flex-col items-center gap-6 w-full max-w-4xl">
                                    <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-white/5">
                                        <video 
                                            key={replacementPreviewUrl || attachment?.previewUrl || attachment?.publicUrl}
                                            controls 
                                            preload="auto"
                                            className="w-full h-full"
                                        >
                                            <source 
                                                src={replacementPreviewUrl || attachment?.previewUrl || attachment?.publicUrl} 
                                                type={replacedFile?.type || attachment?.file?.type || attachment?.meta?.file_type || 
                                                     (attachment?.name?.toLowerCase().endsWith('.mov') ? 'video/quicktime' : 
                                                      attachment?.name?.toLowerCase().endsWith('.webm') ? 'video/webm' : 
                                                      attachment?.name?.toLowerCase().endsWith('.ogg') ? 'video/ogg' : 'video/mp4')} 
                                            />
                                            Your browser does not support the video tag or the format is incompatible.
                                        </video>
                                    </div>
                                    <div className="flex flex-col items-center gap-3 bg-slate-900/50 p-4 rounded-lg border border-white/5 w-full">
                                        <div className="flex items-center gap-4">
                                            <Button asChild variant="secondary" size="sm" className="font-bold">
                                                <a href={replacementPreviewUrl || attachment?.previewUrl || attachment?.publicUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                                                    <ExternalLink className="w-4 h-4" /> Open in New Tab
                                                </a>
                                            </Button>
                                            <Button asChild variant="outline" size="sm" className="font-bold border-slate-700">
                                                <a href={replacementPreviewUrl || attachment?.previewUrl || attachment?.publicUrl} download={replacedFile?.name || attachment?.name || 'video'} className="flex items-center gap-2">
                                                    <Save className="w-4 h-4" /> Download Original
                                                </a>
                                            </Button>
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                onClick={() => fileInputRef.current?.click()}
                                                className="font-bold border-blue-500/40 text-blue-400 hover:bg-blue-950/50"
                                            >
                                                <Upload className="w-4 h-4 mr-1.5" /> Replace Video
                                            </Button>
                                        </div>
                                        <div className="text-center space-y-1">
                                            <p className="text-[11px] text-slate-400 font-medium">
                                                Format: <span className="text-blue-400 font-bold uppercase">{replacedFile?.type || attachment?.file?.type || attachment?.meta?.file_type || 'Unknown'}</span>
                                            </p>
                                            <p className="text-[10px] text-slate-500 italic max-w-md">
                                                Note: Formats like MKV, MOV (some codecs), and WMV may not play directly in all browsers. 
                                                If you see a black screen, please use the "Open in New Tab" or "Download" buttons above.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ) : isDoc ? (
                                <div className="flex flex-col items-center gap-6 p-12 bg-slate-900 border border-white/5 rounded-xl shadow-2xl max-w-md w-full">
                                    <FileText className="w-20 h-20 text-blue-500 opacity-60" />
                                    <div className="text-center space-y-2">
                                        <p className="text-white font-bold text-sm truncate max-w-xs">{replacedFile?.name || attachment?.name || 'Document'}</p>
                                        <p className="text-slate-400 text-xs">This file type cannot be previewed directly.</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Button asChild variant="secondary" size="sm">
                                            <a href={replacementPreviewUrl || attachment?.previewUrl || attachment?.publicUrl} target="_blank" rel="noopener noreferrer">
                                                Open in New Tab
                                            </a>
                                        </Button>
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            onClick={() => fileInputRef.current?.click()}
                                            className="border-blue-500/40 text-blue-400 hover:bg-blue-950/50 font-bold"
                                        >
                                            <Upload className="w-3.5 h-3.5 mr-1.5" /> Replace Document
                                        </Button>
                                    </div>
                                </div>
                            ) : imageLoadError ? (
                                <div className="flex flex-col items-center justify-center p-12 gap-4 bg-slate-900 border border-white/5 rounded-xl text-slate-400 max-w-md text-center">
                                    <FileText className="w-16 h-16 text-slate-600" />
                                    <div>
                                        <p className="text-white font-bold text-sm mb-1">{attachment?.title || attachment?.name || "Attachment"}</p>
                                        <p className="text-xs text-slate-400">Image preview cannot be decoded directly. You can replace the file or edit details on the right.</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button size="sm" variant="outline" onClick={() => setReloadKey(k => k + 1)} className="border-slate-700 text-slate-200">
                                            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Retry
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} className="border-blue-500/40 text-blue-400 hover:bg-blue-950/50">
                                            <Upload className="w-3.5 h-3.5 mr-1.5" /> Replace File
                                        </Button>
                                        {rawDirectUrl && (
                                            <Button asChild size="sm" variant="secondary">
                                                <a href={rawDirectUrl} target="_blank" rel="noopener noreferrer">
                                                    Open Raw
                                                </a>
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {isLoadingImage && (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-slate-950/60 backdrop-blur-sm gap-3 text-slate-400">
                                            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                            <span className="text-xs font-bold uppercase tracking-wider">Loading image preview...</span>
                                        </div>
                                    )}
                                    <canvas 
                                        ref={canvasRef}
                                        onMouseDown={handleMouseDown}
                                        onMouseMove={handleMouseMove}
                                        onMouseUp={handleMouseUp}
                                        onMouseLeave={handleMouseUp}
                                        className={`shadow-2xl bg-black rounded-md max-w-full max-h-full ${activeTool ? 'cursor-crosshair' : 'cursor-default'} ${isLoadingImage ? 'opacity-0' : 'opacity-100 transition-opacity duration-200'}`}
                                    />
                                </>
                            )}
                        </div>
                        
                        {!isVideo && !isDoc && (
                            <div className="p-4 bg-slate-900/50 flex items-center gap-8 border-t border-white/5">
                                <div className="flex items-center gap-4 flex-1 max-w-xs">
                                    <Sun className="w-4 h-4 text-slate-400" />
                                    <Slider 
                                        value={[brightness]} 
                                        onValueChange={([v]) => setBrightness(v)} 
                                        min={50} max={150} 
                                        className="flex-1"
                                    />
                                    <span className="text-[10px] font-mono text-slate-500 w-8">{brightness}%</span>
                                </div>
                                <div className="flex items-center gap-4 flex-1 max-w-xs">
                                    <ContrastIcon className="w-4 h-4 text-slate-400" />
                                    <Slider 
                                        value={[contrast]} 
                                        onValueChange={([v]) => setContrast(v)} 
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
                                    className="w-full h-28 bg-slate-800 border border-white/10 rounded-md p-3 text-xs text-white focus:outline-none focus:border-blue-500 resize-none"
                                    placeholder="Add notes or observation..."
                                />
                            </div>

                            {/* Dedicated Replace Attachment Section in Sidebar */}
                            <div className="space-y-2 pt-3 border-t border-white/5">
                                <div className="flex items-center justify-between">
                                    <Label className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1.5">
                                        <FileUp className="w-3.5 h-3.5 text-blue-400" />
                                        <span>Attachment File</span>
                                    </Label>
                                    {isReplaced && (
                                        <span className="text-[9px] font-black text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-600/50 uppercase tracking-wider">
                                            Replaced
                                        </span>
                                    )}
                                </div>

                                {isReplaced && replacedFile ? (
                                    <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/40 space-y-2 text-xs animate-in fade-in-50 duration-200">
                                        <div className="flex items-start gap-2 text-emerald-300 font-medium">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                            <div className="flex-1 min-w-0">
                                                <p className="font-mono text-[11px] font-bold text-white truncate" title={replacedFile.name}>
                                                    {replacedFile.name}
                                                </p>
                                                <p className="text-[10px] text-emerald-400/80 font-mono">
                                                    {(replacedFile.size / (1024 * 1024)).toFixed(2)} MB • {replacedFile.type || 'File'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between pt-1 border-t border-emerald-500/20 text-[10px]">
                                            <button
                                                type="button"
                                                onClick={() => fileInputRef.current?.click()}
                                                className="text-blue-400 hover:text-blue-300 underline font-bold"
                                            >
                                                Choose Another
                                            </button>
                                            <button 
                                                type="button" 
                                                onClick={handleRevertReplacement}
                                                className="text-amber-400 hover:text-amber-300 underline font-bold"
                                            >
                                                Revert Original
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-full h-9 bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white border-white/10 hover:border-blue-500/50 text-xs font-bold gap-2 shadow-sm"
                                    >
                                        <Upload className="w-3.5 h-3.5 text-blue-400" />
                                        Replace Attachment File
                                    </Button>
                                )}
                            </div>
                        </div>

                        <div className="mt-auto space-y-3">
                            <Button 
                                className="w-full bg-blue-600 hover:bg-blue-500 font-bold uppercase tracking-wider h-11 shadow-lg shadow-blue-600/20"
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
