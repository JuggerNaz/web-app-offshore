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
import { ScrollArea } from "@/components/ui/scroll-area";
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
    RotateCw,
    LayoutGrid,
    Eye,
    ChevronLeft,
    ChevronRight,
    ArrowLeft,
    ArrowRight,
    ListOrdered,
    ArrowUpDown,
    Download
} from 'lucide-react';
import { toast } from "sonner";

interface AttachmentEditorDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    attachment: any;
    attachments?: any[];
    onSave: (updatedAttachment: any, allAttachments?: any[]) => void;
    onReorder?: (updatedAttachments: any[]) => void;
}

export function AttachmentEditorDialog({ 
    open, 
    onOpenChange, 
    attachment, 
    attachments: initialAttachmentsProp,
    onSave,
    onReorder 
}: AttachmentEditorDialogProps) {
    // ─── Multi-Attachment & Ordering State ──────────────────────────────
    const [allAttachments, setAllAttachments] = useState<any[]>([]);
    const [activeIndex, setActiveIndex] = useState<number>(0);
    const [viewMode, setViewMode] = useState<'CANVAS' | 'GRID' | 'GALLERY'>('CANVAS');
    const [isReordering, setIsReordering] = useState<boolean>(false);

    // Current active attachment helper
    const activeAttachment = allAttachments[activeIndex] || attachment;

    // ─── Single Attachment Editing State ────────────────────────────────
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
    const thumbnailStripRef = useRef<HTMLDivElement>(null);
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

    // Map to preserve unsaved changes across attachment switching
    const modificationsMapRef = useRef<Map<string | number, any>>(new Map());

    // ─── Initialize All Attachments for this Record ─────────────────────
    useEffect(() => {
        if (!open || !attachment) {
            setAllAttachments([]);
            setActiveIndex(0);
            modificationsMapRef.current.clear();
            return;
        }

        // Determine list of attachments belonging to this record
        const candidateList: any[] = 
            (initialAttachmentsProp && initialAttachmentsProp.length > 0)
                ? initialAttachmentsProp
                : (attachment.recordAttachments && attachment.recordAttachments.length > 0)
                ? attachment.recordAttachments
                : (attachment.allAttachments && attachment.allAttachments.length > 0)
                ? attachment.allAttachments
                : [attachment];

        // Ensure unique by ID / path
        const seen = new Set();
        const unique = candidateList.filter(item => {
            const key = item.id ? String(item.id) : (item.path || item.previewUrl || item.name);
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        // Sort by sort_order ascending if present, otherwise maintain original order
        const sorted = [...unique].sort((a: any, b: any) => {
            const orderA = a.meta?.sort_order !== undefined ? Number(a.meta.sort_order) : (a.sort_order !== undefined ? Number(a.sort_order) : 999999);
            const orderB = b.meta?.sort_order !== undefined ? Number(b.meta.sort_order) : (b.sort_order !== undefined ? Number(b.sort_order) : 999999);
            if (orderA !== orderB) return orderA - orderB;
            return 0;
        }).map((item, idx) => ({
            ...item,
            sort_order: item.meta?.sort_order !== undefined ? Number(item.meta.sort_order) : (item.sort_order !== undefined ? Number(item.sort_order) : idx),
            meta: {
                ...(item.meta || {}),
                sort_order: item.meta?.sort_order !== undefined ? Number(item.meta.sort_order) : (item.sort_order !== undefined ? Number(item.sort_order) : idx)
            }
        }));

        setAllAttachments(sorted);

        // Find index of clicked attachment
        const targetId = attachment.id ? String(attachment.id) : null;
        const targetPath = attachment.path || attachment.previewUrl;
        const foundIdx = sorted.findIndex(item => {
            if (targetId && String(item.id) === targetId) return true;
            if (targetPath && (item.path === targetPath || item.previewUrl === targetPath)) return true;
            return false;
        });
        setActiveIndex(foundIdx >= 0 ? foundIdx : 0);
    }, [open, attachment?.id, attachment?.path, initialAttachmentsProp]);

    // ─── Canvas Rendering & Geometry ───────────────────────────────────
    const getItemBounds = (item: any) => {
        if (item.type === 'RECT') {
            return {
                x: item.width < 0 ? item.x + item.width : item.x,
                y: item.height < 0 ? item.y + item.height : item.y,
                width: Math.abs(item.width),
                height: Math.abs(item.height)
            };
        } else if (item.type === 'ARROW') {
            const minX = Math.min(item.fromX, item.toX);
            const maxX = Math.max(item.fromX, item.toX);
            const minY = Math.min(item.fromY, item.toY);
            const maxY = Math.max(item.fromY, item.toY);
            return { x: minX, y: minY, width: Math.max(maxX - minX, 10), height: Math.max(maxY - minY, 10) };
        } else if (item.type === 'TEXT') {
            return { x: item.x, y: item.y - 16, width: (item.text.length * 9) + 8, height: 20 };
        } else if (item.type === 'PEN') {
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            item.path.forEach((p: any) => {
                minX = Math.min(minX, p.x);
                maxX = Math.max(maxX, p.x);
                minY = Math.min(minY, p.y);
                maxY = Math.max(maxY, p.y);
            });
            return { x: minX, y: minY, width: Math.max(maxX - minX, 10), height: Math.max(maxY - minY, 10) };
        }
        return { x: 0, y: 0, width: 0, height: 0 };
    };

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
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(toX, toY);
        ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
    };

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
        ctx.filter = 'none';

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

            if (activeTool === 'SELECT' && selectedItemIndex === index) {
                ctx.strokeStyle = '#3b82f6';
                ctx.lineWidth = 1;
                ctx.setLineDash([4, 4]);
                const bounds = getItemBounds(item);
                ctx.strokeRect(bounds.x - 4, bounds.y - 4, bounds.width + 8, bounds.height + 8);
                ctx.setLineDash([]);
            }
        });

        // 3. Current interactive stroke
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
        
        const containerW = container.clientWidth > 100 ? container.clientWidth : (typeof window !== 'undefined' ? Math.min(window.innerWidth * 0.6, 900) : 800);
        const containerH = container.clientHeight > 100 ? container.clientHeight : (typeof window !== 'undefined' ? Math.min(window.innerHeight * 0.65, 600) : 550);

        const maxW = Math.max(containerW - 32, 280);
        const maxH = Math.max(containerH - 32, 260);
        
        const naturalW = img.naturalWidth || img.width || 800;
        const naturalH = img.naturalHeight || img.height || 600;
        
        const ratio = Math.min(maxW / naturalW, maxH / naturalH, 1);
        canvas.width = Math.round(naturalW * ratio);
        canvas.height = Math.round(naturalH * ratio);

        renderCanvas(img);
    }, [imageObj, renderCanvas]);

    // ─── Image Loader ──────────────────────────────────────────────────
    const loadImage = async (targetAtt?: any) => {
        const att = targetAtt || activeAttachment;
        if (!att) return;

        const isPhoto = !att?.type || 
            String(att?.type).toUpperCase() === 'PHOTO' || 
            String(att?.type).toLowerCase().includes('image') || 
            String(att?.meta?.type).toUpperCase() === 'PHOTO' ||
            (!String(att?.type).toUpperCase().includes('VIDEO') && !String(att?.type).toUpperCase().includes('DOCUMENT'));

        if (!isPhoto) return;

        const currentLoadId = ++activeLoadIdRef.current;
        imageObjRef.current = null;
        setImageObj(null);
        setIsLoadingImage(true);
        setImageLoadError(false);

        const candidates: string[] = [];

        // 1. Replaced preview or local blob
        if (replacementPreviewUrl) {
            candidates.push(replacementPreviewUrl);
        }
        if (att.file && att.file instanceof File) {
            try {
                candidates.push(URL.createObjectURL(att.file));
            } catch {}
        }

        // 2. Proxied API URLs
        if (att.id) {
            const idStr = String(att.id);
            const pathParam = att.path || att.meta?.file_path || '';
            if (pathParam) {
                candidates.push(`/api/attachment/url?id=${encodeURIComponent(idStr)}&path=${encodeURIComponent(pathParam)}`);
            }
            candidates.push(`/api/attachment/url?id=${encodeURIComponent(idStr)}`);
        }

        const rawPath = att.path || att.meta?.file_path || att.file_path;
        if (rawPath) {
            const bucket = att.meta?.bucket || 'attachments';
            candidates.push(`/api/attachment/download?path=${encodeURIComponent(rawPath)}&bucket=${encodeURIComponent(bucket)}`);
            candidates.push(`/api/attachment/download?path=${encodeURIComponent(rawPath)}`);
        }

        // 3. Fallback direct / public URLs
        if (att.previewUrl && !att.previewUrl.startsWith('http')) {
            candidates.push(att.previewUrl);
        }
        if (att.meta?.file_url) candidates.push(att.meta.file_url);
        if (att.previewUrl) candidates.push(att.previewUrl);
        if (att.publicUrl) candidates.push(att.publicUrl);
        if (rawPath && (rawPath.startsWith('http://') || rawPath.startsWith('https://') || rawPath.startsWith('blob:') || rawPath.startsWith('data:'))) {
            candidates.push(rawPath);
        }

        const uniqueCandidates = Array.from(new Set(candidates.filter(Boolean)));

        const tryLoadCandidate = async (url: string): Promise<HTMLImageElement | null> => {
            if (!url) return null;
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
            return await loadDirect(false);
        };

        let loadedImg: HTMLImageElement | null = null;
        for (const cand of uniqueCandidates) {
            try {
                loadedImg = await tryLoadCandidate(cand);
                if (loadedImg) break;
            } catch {}
        }

        if (activeLoadIdRef.current !== currentLoadId) return;

        setIsLoadingImage(false);
        if (loadedImg) {
            imageObjRef.current = loadedImg;
            setImageObj(loadedImg);
        } else {
            setImageLoadError(true);
        }
    };

    // ─── Synchronize Active Attachment when activeIndex Changes ────────
    useEffect(() => {
        if (!open || !activeAttachment) return;

        // Check if we have cached modifications for this attachment
        const attKey = activeAttachment.id ? String(activeAttachment.id) : (activeAttachment.path || activeAttachment.previewUrl || `idx-${activeIndex}`);
        const cached = modificationsMapRef.current.get(attKey);

        setTitle(cached?.title ?? (activeAttachment?.title || activeAttachment?.name || ''));
        setDescription(cached?.description ?? (activeAttachment?.description || activeAttachment?.meta?.description || ''));
        setBrightness(cached?.brightness ?? 100);
        setContrast(cached?.contrast ?? 100);
        setDrawHistory(cached?.drawHistory ?? []);
        setImageLoadError(false);

        setReplacedFile(cached?.replacedFile ?? null);
        setReplacementPreviewUrl(cached?.replacementPreviewUrl ?? null);
        setIsReplaced(cached?.isReplaced ?? false);
        setReplacedFileType(cached?.replacedFileType ?? null);

        loadImage(activeAttachment);
    }, [open, activeIndex, allAttachments.length, reloadKey]);

    // Redraw canvas whenever image object or draw state updates
    useEffect(() => {
        if (!isLoadingImage && imageObj && canvasRef.current) {
            initCanvas(imageObj);
        }
    }, [isLoadingImage, imageObj, initCanvas, brightness, contrast, drawHistory]);

    // Resize observer
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

    // ─── Cache Current Modifications before switching attachments ──────
    const commitCurrentModifications = () => {
        if (!activeAttachment) return;
        const attKey = activeAttachment.id ? String(activeAttachment.id) : (activeAttachment.path || activeAttachment.previewUrl || `idx-${activeIndex}`);
        modificationsMapRef.current.set(attKey, {
            title,
            description,
            brightness,
            contrast,
            drawHistory,
            replacedFile,
            replacementPreviewUrl,
            isReplaced,
            replacedFileType
        });

        // Also update allAttachments in memory
        setAllAttachments(prev => prev.map((item, idx) => {
            if (idx === activeIndex) {
                return {
                    ...item,
                    title,
                    name: title || item.name,
                    description,
                    meta: {
                        ...(item.meta || {}),
                        title,
                        description,
                    },
                    ...(replacedFile ? {
                        file: replacedFile,
                        previewUrl: replacementPreviewUrl,
                        type: replacedFileType || item.type,
                    } : {})
                };
            }
            return item;
        }));
    };

    // ─── Switch Active Attachment ──────────────────────────────────────
    const handleSelectAttachment = (newIndex: number) => {
        if (newIndex < 0 || newIndex >= allAttachments.length || newIndex === activeIndex) return;
        commitCurrentModifications();
        setActiveIndex(newIndex);
        setViewMode('CANVAS');
    };

    // ─── Reordering Logic ──────────────────────────────────────────────
    const handleMoveAttachment = (index: number, direction: -1 | 1, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= allAttachments.length) return;

        commitCurrentModifications();

        const reordered = [...allAttachments];
        const [movedItem] = reordered.splice(index, 1);
        reordered.splice(targetIndex, 0, movedItem);

        // Assign explicit new sort_order (0-indexed)
        const updated = reordered.map((item, idx) => ({
            ...item,
            sort_order: idx,
            meta: {
                ...(item.meta || {}),
                sort_order: idx
            }
        }));

        setAllAttachments(updated);

        // If the moved item was active, update activeIndex to follow it
        if (index === activeIndex) {
            setActiveIndex(targetIndex);
        } else if (targetIndex === activeIndex) {
            setActiveIndex(index);
        }

        onReorder?.(updated);
        persistReorderToDb(updated);
        toast.success(`Moved to position #${targetIndex + 1}`);
    };

    // ─── Reset Order to Natural Creation/Capture Order ─────────────────
    const handleResetOrder = () => {
        commitCurrentModifications();

        const sorted = [...allAttachments].sort((a: any, b: any) => {
            const dateA = new Date(a.created_at || a.captured_at || a.meta?.captured_at || 0).getTime();
            const dateB = new Date(b.created_at || b.captured_at || b.meta?.captured_at || 0).getTime();
            if (dateA !== dateB) return dateA - dateB;
            return (a.name || '').localeCompare(b.name || '');
        }).map((item, idx) => ({
            ...item,
            sort_order: idx,
            meta: {
                ...(item.meta || {}),
                sort_order: idx
            }
        }));

        setAllAttachments(sorted);
        setActiveIndex(0);
        onReorder?.(sorted);
        persistReorderToDb(sorted);
        toast.success("Attachment order reset to original chronological order");
    };

    const persistReorderToDb = async (items: any[]) => {
        try {
            const reorderItems = items
                .filter(item => item.id && !String(item.id).startsWith('temp-') && !String(item.id).startsWith('rand-'))
                .map((item, idx) => ({
                    id: item.id,
                    sort_order: idx
                }));

            if (reorderItems.length > 0) {
                await fetch('/api/attachment/reorder', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ items: reorderItems })
                });
            }
        } catch (err) {
            console.warn("[AttachmentEditorDialog] Background reorder persistence warning:", err);
        }
    };

    // ─── File Replacement Handlers ─────────────────────────────────────
    const handleFileReplace = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const isImage = file.type.startsWith('image/');
        const isVid = file.type.startsWith('video/');

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
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleRevertReplacement = () => {
        setReplacedFile(null);
        setReplacementPreviewUrl(null);
        setIsReplaced(false);
        setReplacedFileType(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        loadImage(activeAttachment);
        toast.info("Reverted back to original attachment");
    };

    // ─── Canvas Mouse / Markup Handlers ────────────────────────────────
    const getPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) * (canvas.width / rect.width),
            y: (e.clientY - rect.top) * (canvas.height / rect.height)
        };
    };

    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!activeTool) return;
        const pos = getPos(e);

        if (activeTool === 'SELECT') {
            for (let i = drawHistory.length - 1; i >= 0; i--) {
                const b = getItemBounds(drawHistory[i]);
                if (pos.x >= b.x - 4 && pos.x <= b.x + b.width + 4 && pos.y >= b.y - 4 && pos.y <= b.y + b.height + 4) {
                    setSelectedItemIndex(i);
                    setIsDragging(true);
                    setDragOffset({ x: pos.x - (drawHistory[i].x ?? drawHistory[i].fromX ?? b.x), y: pos.y - (drawHistory[i].y ?? drawHistory[i].fromY ?? b.y) });
                    return;
                }
            }
            setSelectedItemIndex(null);
            return;
        }

        setIsDrawing(true);
        setStartPos(pos);

        if (activeTool === 'PEN') {
            setCurrentPath([pos]);
        } else if (activeTool === 'TEXT') {
            const text = prompt('Enter annotation text:');
            if (text) {
                setDrawHistory(prev => [...prev, {
                    type: 'TEXT',
                    text,
                    x: pos.x,
                    y: pos.y,
                    color: drawColor
                }]);
            }
            setIsDrawing(false);
        }
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const pos = getPos(e);

        if (isDragging && selectedItemIndex !== null && drawHistory[selectedItemIndex]) {
            const item = drawHistory[selectedItemIndex];
            const newX = pos.x - dragOffset.x;
            const newY = pos.y - dragOffset.y;

            setDrawHistory(prev => prev.map((it, idx) => {
                if (idx !== selectedItemIndex) return it;
                if (it.type === 'RECT' || it.type === 'TEXT') {
                    return { ...it, x: newX, y: newY };
                } else if (it.type === 'ARROW') {
                    const dx = newX - it.fromX;
                    const dy = newY - it.fromY;
                    return { ...it, fromX: newX, fromY: newY, toX: it.toX + dx, toY: it.toY + dy };
                } else if (it.type === 'PEN') {
                    const b = getItemBounds(it);
                    const dx = newX - b.x;
                    const dy = newY - b.y;
                    return { ...it, path: it.path.map((p: any) => ({ x: p.x + dx, y: p.y + dy })) };
                }
                return it;
            }));
            return;
        }

        if (!isDrawing) return;

        if (activeTool === 'PEN') {
            setCurrentPath(prev => [...prev, pos]);
        } else if (activeTool === 'RECT' || activeTool === 'ARROW') {
            renderCanvas();
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext('2d');
            if (ctx) {
                ctx.strokeStyle = drawColor;
                ctx.lineWidth = 3;
                if (activeTool === 'RECT') {
                    ctx.strokeRect(startPos.x, startPos.y, pos.x - startPos.x, pos.y - startPos.y);
                } else if (activeTool === 'ARROW') {
                    drawArrow(ctx, startPos.x, startPos.y, pos.x, pos.y);
                }
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
        const pos = getPos(e);

        if (activeTool === 'PEN' && currentPath.length > 1) {
            setDrawHistory(prev => [...prev, {
                type: 'PEN',
                path: currentPath,
                color: drawColor,
                lineWidth: 3
            }]);
            setCurrentPath([]);
        } else if (activeTool === 'RECT') {
            const w = pos.x - startPos.x;
            const h = pos.y - startPos.y;
            if (Math.abs(w) > 5 && Math.abs(h) > 5) {
                setDrawHistory(prev => [...prev, {
                    type: 'RECT',
                    x: startPos.x,
                    y: startPos.y,
                    width: w,
                    height: h,
                    color: drawColor
                }]);
            }
        } else if (activeTool === 'ARROW') {
            const dist = Math.hypot(pos.x - startPos.x, pos.y - startPos.y);
            if (dist > 10) {
                setDrawHistory(prev => [...prev, {
                    type: 'ARROW',
                    fromX: startPos.x,
                    fromY: startPos.y,
                    toX: pos.x,
                    toY: pos.y,
                    color: drawColor
                }]);
            }
        }
    };

    // ─── File Details Helpers ───────────────────────────────────────────
    const isVideo = replacedFileType ? replacedFileType === 'VIDEO' : (String(activeAttachment?.type).toUpperCase() === 'VIDEO' || String(activeAttachment?.meta?.type).toUpperCase() === 'VIDEO');
    const isDoc = replacedFileType ? replacedFileType === 'DOCUMENT' : (String(activeAttachment?.type).toUpperCase() === 'DOCUMENT' || String(activeAttachment?.meta?.type).toUpperCase() === 'DOCUMENT');

    const actualFileName = (
        replacedFile?.name ||
        activeAttachment?.meta?.original_file_name ||
        activeAttachment?.file?.name ||
        activeAttachment?.meta?.file_name ||
        activeAttachment?.file_name ||
        (activeAttachment?.path && typeof activeAttachment.path === 'string' ? activeAttachment.path.split('?')[0].split('/').pop() : '') ||
        activeAttachment?.name ||
        'attachment'
    );

    const fileExtension = (() => {
        if (actualFileName && actualFileName.includes('.')) {
            const ext = actualFileName.split('.').pop()?.toUpperCase();
            if (ext && ext.length >= 1 && ext.length <= 6) return ext;
        }
        const typeStr = (replacedFileType || activeAttachment?.type || activeAttachment?.meta?.type || '').toUpperCase();
        if (typeStr === 'VIDEO') return 'MP4';
        if (typeStr === 'DOCUMENT') return 'PDF';
        const mimeStr = (replacedFile?.type || activeAttachment?.meta?.mime || activeAttachment?.meta?.file_type || activeAttachment?.file?.type || '').toLowerCase();
        if (mimeStr.includes('png')) return 'PNG';
        if (mimeStr.includes('webp')) return 'WEBP';
        if (mimeStr.includes('gif')) return 'GIF';
        if (mimeStr.includes('pdf')) return 'PDF';
        if (mimeStr.includes('jpeg') || mimeStr.includes('jpg')) return 'JPG';
        if (mimeStr.includes('mp4')) return 'MP4';
        return isVideo ? 'MP4' : isDoc ? 'PDF' : 'JPG';
    })();

    const mimeType = replacedFile?.type || activeAttachment?.meta?.mime || activeAttachment?.meta?.file_type || activeAttachment?.file?.type || (isVideo ? 'video/mp4' : isDoc ? 'application/pdf' : 'image/jpeg');

    const rawSize = replacedFile ? replacedFile.size : (activeAttachment?.file?.size || activeAttachment?.meta?.file_size || activeAttachment?.meta?.size || activeAttachment?.size || null);
    const formattedSize = rawSize ? (rawSize < 1024 * 1024 ? `${(rawSize / 1024).toFixed(1)} KB` : `${(rawSize / (1024 * 1024)).toFixed(2)} MB`) : null;

    // ─── Save Changes ──────────────────────────────────────────────────
    const handleSave = async () => {
        if (!activeAttachment) return;
        const canvas = canvasRef.current;
        const effectiveName = (title || activeAttachment?.name || 'Attachment').trim();
        const effectiveType = replacedFileType || activeAttachment?.type || 'PHOTO';
        const isPhoto = !effectiveType || String(effectiveType).toUpperCase() === 'PHOTO';
        const hasVisualEdits = drawHistory.length > 0 || brightness !== 100 || contrast !== 100;

        const currentSortOrder = activeAttachment.sort_order !== undefined 
            ? Number(activeAttachment.sort_order) 
            : activeIndex;

        // Build current updated attachment
        const buildUpdatedAttachment = (extraProps: any = {}) => ({
            ...activeAttachment,
            title,
            name: effectiveName,
            description,
            sort_order: currentSortOrder,
            meta: {
                ...(activeAttachment?.meta || {}),
                title,
                description,
                sort_order: currentSortOrder,
                file_name: effectiveName,
                ...(extraProps.meta || {})
            },
            ...extraProps
        });

        // Update allAttachments list
        const updatedAllAttachments = allAttachments.map((item, idx) => {
            const itemOrder = item.sort_order !== undefined ? Number(item.sort_order) : idx;
            const itemKey = item.id ? String(item.id) : (item.path || item.previewUrl || `idx-${idx}`);
            const cached = modificationsMapRef.current.get(itemKey);

            if (idx === activeIndex) {
                return {
                    ...item,
                    title,
                    name: effectiveName,
                    description,
                    sort_order: itemOrder,
                    meta: {
                        ...(item.meta || {}),
                        title,
                        description,
                        sort_order: itemOrder,
                    }
                };
            }
            if (cached) {
                return {
                    ...item,
                    title: cached.title,
                    name: cached.title || item.name,
                    description: cached.description,
                    sort_order: itemOrder,
                    meta: {
                        ...(item.meta || {}),
                        title: cached.title,
                        description: cached.description,
                        sort_order: itemOrder,
                    },
                    ...(cached.replacedFile ? {
                        file: cached.replacedFile,
                        previewUrl: cached.replacementPreviewUrl,
                        type: cached.replacedFileType || item.type,
                        isEdited: true,
                        isReplaced: true,
                    } : {})
                };
            }
            return {
                ...item,
                sort_order: itemOrder,
                meta: {
                    ...(item.meta || {}),
                    sort_order: itemOrder
                }
            };
        });

        if (canvas && isPhoto && hasVisualEdits) {
            try {
                const baseName = (actualFileName || effectiveName).replace(/\.[^/.]+$/, "");
                const ext = (replacedFile?.type?.includes('png') || actualFileName.toLowerCase().endsWith('.png')) ? 'png' : 'jpg';
                const mime = ext === 'png' ? 'image/png' : 'image/jpeg';

                canvas.toBlob((blob) => {
                    if (blob) {
                        const newFile = new File([blob], `${baseName}_edited.${ext}`, { type: mime });
                        const newUrl = URL.createObjectURL(blob);
                        const finalUpdated = buildUpdatedAttachment({
                            file: newFile,
                            previewUrl: newUrl,
                            type: effectiveType,
                            isEdited: true,
                            isReplaced: true,
                            meta: {
                                original_file_name: `${baseName}_edited.${ext}`,
                                file_size: blob.size,
                                file_type: mime,
                                mime: mime,
                            }
                        });
                        onSave(finalUpdated, updatedAllAttachments);
                        onOpenChange(false);
                    } else if (replacedFile) {
                        const finalUpdated = buildUpdatedAttachment({
                            file: replacedFile,
                            previewUrl: replacementPreviewUrl,
                            type: effectiveType,
                            isEdited: true,
                            isReplaced: true,
                            meta: {
                                original_file_name: replacedFile.name,
                                file_size: replacedFile.size,
                                file_type: replacedFile.type,
                                mime: replacedFile.type,
                            }
                        });
                        onSave(finalUpdated, updatedAllAttachments);
                        onOpenChange(false);
                    } else {
                        const finalUpdated = buildUpdatedAttachment({
                            isEdited: false,
                            isReplaced: false
                        });
                        onSave(finalUpdated, updatedAllAttachments);
                        onOpenChange(false);
                    }
                }, mime, 0.92);
            } catch (canvasErr) {
                console.warn("[AttachmentEditorDialog] Canvas toBlob error fallback:", canvasErr);
                const finalUpdated = buildUpdatedAttachment(replacedFile ? {
                    file: replacedFile,
                    previewUrl: replacementPreviewUrl,
                    type: effectiveType,
                    isEdited: true,
                    isReplaced: true,
                    meta: {
                        original_file_name: replacedFile.name,
                        file_size: replacedFile.size,
                        file_type: replacedFile.type,
                        mime: replacedFile.type,
                    }
                } : {
                    isEdited: false,
                    isReplaced: false
                });
                onSave(finalUpdated, updatedAllAttachments);
                onOpenChange(false);
            }
        } else if (isReplaced && replacedFile) {
            const finalUpdated = buildUpdatedAttachment({
                file: replacedFile,
                previewUrl: replacementPreviewUrl,
                type: effectiveType,
                isEdited: true,
                isReplaced: true,
                meta: {
                    original_file_name: replacedFile.name,
                    file_size: replacedFile.size,
                    file_type: replacedFile.type,
                    mime: replacedFile.type,
                }
            });
            onSave(finalUpdated, updatedAllAttachments);
            onOpenChange(false);
        } else {
            const finalUpdated = buildUpdatedAttachment({
                isEdited: false,
                isReplaced: false
            });
            onSave(finalUpdated, updatedAllAttachments);
            onOpenChange(false);
        }
    };

    if (!open || !activeAttachment) return null;

    const rawDirectUrl = replacementPreviewUrl || (activeAttachment?.id ? `/api/attachment/url?id=${activeAttachment.id}` : '') || activeAttachment?.previewUrl || (activeAttachment?.path ? `/api/attachment/download?path=${encodeURIComponent(activeAttachment.path)}` : '');

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-7xl h-[92vh] flex flex-col p-0 overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl">
                <DialogHeader className="sr-only">
                    <DialogTitle>Edit Attachment: {activeAttachment?.title || activeAttachment?.name || 'Photo'}</DialogTitle>
                    <DialogDescription>
                        Modify attachment metadata, reorder photos for report printing, or apply visual markups.
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

                {/* ─── Top App Bar ─────────────────────────────────────────── */}
                <div className="h-14 bg-slate-900 border-b border-white/10 px-4 flex items-center justify-between gap-4 shrink-0">
                    {/* Left: View Mode Toggle & Markup Tools */}
                    <div className="flex items-center gap-3">
                        <div className="flex bg-slate-800/80 p-0.5 rounded-lg border border-white/10">
                            <button
                                type="button"
                                onClick={() => { commitCurrentModifications(); setViewMode('CANVAS'); }}
                                className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all ${viewMode === 'CANVAS' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                                title="Single Attachment Canvas Editor"
                            >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Editor</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => { commitCurrentModifications(); setViewMode('GALLERY'); }}
                                className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all ${viewMode === 'GALLERY' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                                title="View All Attachments of this Record in One Place"
                            >
                                <LayoutGrid className="w-3.5 h-3.5" />
                                <span>All ({allAttachments.length})</span>
                            </button>
                        </div>

                        {viewMode === 'CANVAS' && !isVideo && !isDoc && (
                            <div className="flex items-center gap-1 bg-slate-800/60 p-0.5 rounded-lg border border-white/5">
                                <Button 
                                    variant={activeTool === 'SELECT' ? 'secondary' : 'ghost'} 
                                    size="sm" 
                                    onClick={() => { setActiveTool(activeTool === 'SELECT' ? null : 'SELECT'); setSelectedItemIndex(null); }}
                                    className={`h-7 w-7 p-0 ${activeTool === 'SELECT' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                                    title="Select / Move Markup"
                                ><MousePointer2 className="w-3.5 h-3.5" /></Button>
                                <Button 
                                    variant={activeTool === 'PEN' ? 'secondary' : 'ghost'} 
                                    size="sm" 
                                    onClick={() => setActiveTool(activeTool === 'PEN' ? null : 'PEN')}
                                    className={`h-7 w-7 p-0 ${activeTool === 'PEN' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                                    title="Pencil"
                                ><Pencil className="w-3.5 h-3.5" /></Button>
                                <Button 
                                    variant={activeTool === 'RECT' ? 'secondary' : 'ghost'} 
                                    size="sm" 
                                    onClick={() => setActiveTool(activeTool === 'RECT' ? null : 'RECT')}
                                    className={`h-7 w-7 p-0 ${activeTool === 'RECT' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                                    title="Rectangle"
                                ><Square className="w-3.5 h-3.5" /></Button>
                                <Button 
                                    variant={activeTool === 'ARROW' ? 'secondary' : 'ghost'} 
                                    size="sm" 
                                    onClick={() => setActiveTool(activeTool === 'ARROW' ? null : 'ARROW')}
                                    className={`h-7 w-7 p-0 ${activeTool === 'ARROW' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                                    title="Arrow"
                                ><ArrowUpRight className="w-3.5 h-3.5" /></Button>
                                <Button 
                                    variant={activeTool === 'TEXT' ? 'secondary' : 'ghost'} 
                                    size="sm" 
                                    onClick={() => setActiveTool(activeTool === 'TEXT' ? null : 'TEXT')}
                                    className={`h-7 w-7 p-0 ${activeTool === 'TEXT' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                                    title="Text"
                                ><Type className="w-3.5 h-3.5" /></Button>
                                <div className="h-4 w-px bg-white/10 mx-0.5" />
                                <input 
                                    type="color" 
                                    value={drawColor} 
                                    onChange={(e) => setDrawColor(e.target.value)}
                                    className="w-5 h-5 rounded border-none bg-transparent cursor-pointer"
                                    title="Markup Color"
                                />
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => setDrawHistory(prev => prev.slice(0, -1))}
                                    disabled={drawHistory.length === 0}
                                    className="h-7 w-7 p-0 text-slate-400 hover:text-white disabled:opacity-20"
                                    title="Undo Stroke"
                                ><Undo className="w-3.5 h-3.5" /></Button>
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => setDrawHistory([])}
                                    disabled={drawHistory.length === 0}
                                    className="h-7 w-7 p-0 text-red-400 hover:text-red-300 disabled:opacity-20"
                                    title="Clear Annotations"
                                ><RotateCcw className="w-3.5 h-3.5" /></Button>
                            </div>
                        )}

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            className="h-7 px-2.5 text-[11px] font-bold text-blue-400 hover:text-white hover:bg-blue-600 bg-slate-800/80 border-blue-500/30 gap-1.5"
                            title="Choose a new file to replace this attachment"
                        >
                            <Upload className="w-3 h-3" />
                            <span>Replace File</span>
                        </Button>
                    </div>

                    {/* Center: Record Attachment Navigation (Next / Prev) */}
                    {allAttachments.length > 1 && (
                        <div className="flex items-center gap-2 bg-slate-800/80 px-2 py-1 rounded-lg border border-white/10">
                            <button
                                type="button"
                                disabled={activeIndex <= 0}
                                onClick={() => handleSelectAttachment(activeIndex - 1)}
                                className="p-1 rounded hover:bg-white/10 text-slate-300 hover:text-white disabled:opacity-30 transition"
                                title="Previous Attachment (Left Arrow)"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <div className="text-center px-1 min-w-[130px]">
                                <span className="text-xs font-bold text-white">
                                    Attachment {activeIndex + 1} of {allAttachments.length}
                                </span>
                                <span className="block text-[9px] font-black uppercase tracking-wider text-blue-400">
                                    Order #{activeIndex + 1} {activeIndex === 0 ? '• Report Cover' : ''}
                                </span>
                            </div>
                            <button
                                type="button"
                                disabled={activeIndex >= allAttachments.length - 1}
                                onClick={() => handleSelectAttachment(activeIndex + 1)}
                                className="p-1 rounded hover:bg-white/10 text-slate-300 hover:text-white disabled:opacity-30 transition"
                                title="Next Attachment (Right Arrow)"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                    {/* Right: Reset Order & Close */}
                    <div className="flex items-center gap-2">
                        {allAttachments.length > 1 && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleResetOrder}
                                className="h-8 px-2.5 text-xs font-bold text-slate-300 hover:text-white bg-slate-800/80 border-white/10 hover:border-blue-500/50 gap-1.5"
                                title="Reset attachments to default chronological order"
                            >
                                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                                <span>Reset Order</span>
                            </Button>
                        )}
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => onOpenChange(false)} 
                            className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg"
                        >
                            <X className="w-5 h-5" />
                        </Button>
                    </div>
                </div>

                {/* ─── Body Area ───────────────────────────────────────────── */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Left Main View (Canvas or All Grid) */}
                    <div className="flex-1 flex flex-col min-w-0 bg-slate-950 overflow-hidden">
                        {viewMode === 'GALLERY' ? (
                            /* ─── ALL ATTACHMENTS GRID VIEW ────────────────── */
                            <div className="flex-1 flex flex-col p-6 overflow-hidden">
                                <div className="flex items-center justify-between pb-4 border-b border-white/10">
                                    <div>
                                        <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                                            <LayoutGrid className="w-4 h-4 text-blue-400" />
                                            <span>Record Attachments ({allAttachments.length})</span>
                                        </h3>
                                        <p className="text-xs text-slate-400 mt-0.5">
                                            Photos and files belong to this inspection record. Reports will print photos in this exact order.
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleResetOrder}
                                            className="h-8 text-xs font-bold border-white/10 bg-slate-900 text-slate-300 hover:text-white gap-1.5"
                                        >
                                            <RotateCcw className="w-3.5 h-3.5 text-amber-400" /> Reset Order
                                        </Button>
                                        <Button
                                            size="sm"
                                            onClick={() => setViewMode('CANVAS')}
                                            className="h-8 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white gap-1.5"
                                        >
                                            <Eye className="w-3.5 h-3.5" /> Open Active in Editor
                                        </Button>
                                    </div>
                                </div>

                                <ScrollArea className="flex-1 mt-4 pr-3">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-6">
                                        {allAttachments.map((item, idx) => {
                                            const itemPreview = item.previewUrl || (item.id ? `/api/attachment/url?id=${encodeURIComponent(item.id)}` : (item.path ? `/api/attachment/download?path=${encodeURIComponent(item.path)}` : ''));
                                            const isItemPhoto = !item.type || String(item.type).toUpperCase() === 'PHOTO' || String(item.type).toLowerCase().includes('image');
                                            const isItemVideo = String(item.type).toUpperCase() === 'VIDEO';
                                            const isActive = idx === activeIndex;

                                            return (
                                                <div 
                                                    key={item.id || `att-${idx}`}
                                                    className={`group relative rounded-xl border flex flex-col overflow-hidden transition-all duration-200 ${
                                                        isActive 
                                                            ? 'border-blue-500 bg-slate-900/90 ring-2 ring-blue-500/40 shadow-xl shadow-blue-500/10' 
                                                            : 'border-white/10 bg-slate-900/50 hover:border-white/20 hover:bg-slate-900'
                                                    }`}
                                                >
                                                    {/* Top Bar on Card with Order Badge and Reorder Arrows */}
                                                    <div className="p-2.5 bg-slate-900 flex items-center justify-between border-b border-white/5">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="bg-blue-600 text-white font-black text-[10px] px-2 py-0.5 rounded shadow-sm flex items-center gap-1">
                                                                #{idx + 1}
                                                            </span>
                                                            {idx === 0 && (
                                                                <span className="text-[9px] font-black uppercase text-amber-400 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-600/30">
                                                                    Primary Photo
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Reorder Buttons */}
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                type="button"
                                                                disabled={idx === 0}
                                                                onClick={(e) => handleMoveAttachment(idx, -1, e)}
                                                                className="h-6 px-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white disabled:opacity-20 text-[10px] font-bold flex items-center gap-0.5 transition"
                                                                title="Move Earlier in Report Print Order"
                                                            >
                                                                <ArrowLeft className="w-3 h-3" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                disabled={idx === allAttachments.length - 1}
                                                                onClick={(e) => handleMoveAttachment(idx, 1, e)}
                                                                className="h-6 px-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white disabled:opacity-20 text-[10px] font-bold flex items-center gap-0.5 transition"
                                                                title="Move Later in Report Print Order"
                                                            >
                                                                <ArrowRight className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Card Preview Media */}
                                                    <div 
                                                        className="aspect-video bg-black/80 relative flex items-center justify-center cursor-pointer overflow-hidden group/thumb"
                                                        onClick={() => handleSelectAttachment(idx)}
                                                    >
                                                        {isItemPhoto && itemPreview ? (
                                                            <img 
                                                                src={itemPreview} 
                                                                alt={item.title || item.name} 
                                                                className="w-full h-full object-contain group-hover/thumb:scale-105 transition-transform duration-300"
                                                            />
                                                        ) : isItemVideo ? (
                                                            <div className="flex flex-col items-center gap-2 text-blue-400">
                                                                <Video className="w-10 h-10 opacity-80" />
                                                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Video Attachment</span>
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-col items-center gap-2 text-slate-400">
                                                                <FileText className="w-10 h-10 opacity-80" />
                                                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Document</span>
                                                            </div>
                                                        )}

                                                        <div className="absolute inset-0 bg-blue-600/20 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center">
                                                            <Button size="sm" className="bg-blue-600 text-white font-bold text-xs shadow-lg">
                                                                Open in Editor
                                                            </Button>
                                                        </div>
                                                    </div>

                                                    {/* Card Details / Inline Form */}
                                                    <div className="p-3 flex-1 flex flex-col gap-2 bg-slate-900/60">
                                                        <div>
                                                            <p className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Title</p>
                                                            <p className="text-xs font-bold text-white truncate" title={item.title || item.name}>
                                                                {item.title || item.name || 'Untitled'}
                                                            </p>
                                                        </div>

                                                        {item.description && (
                                                            <p className="text-[11px] text-slate-400 line-clamp-2 italic border-l-2 border-slate-700 pl-2">
                                                                {item.description}
                                                            </p>
                                                        )}

                                                        <div className="mt-auto pt-2 flex items-center justify-between border-t border-white/5 text-[10px] text-slate-500">
                                                            <span className="font-mono uppercase">{item.type || 'PHOTO'}</span>
                                                            <Button 
                                                                size="sm" 
                                                                variant="ghost" 
                                                                className="h-6 px-2 text-[10px] text-blue-400 hover:text-blue-300"
                                                                onClick={() => handleSelectAttachment(idx)}
                                                            >
                                                                Edit & Annotate →
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </ScrollArea>
                            </div>
                        ) : (
                            /* ─── SINGLE ATTACHMENT CANVAS / VIEWER ─────────── */
                            <>
                                <div ref={containerRef} className="flex-1 relative flex items-center justify-center p-4 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:20px_20px] overflow-hidden">
                                    {isVideo ? (
                                        <div className="flex flex-col items-center gap-4 w-full max-w-4xl">
                                            <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-white/5">
                                                <video 
                                                    key={replacementPreviewUrl || activeAttachment?.previewUrl || activeAttachment?.publicUrl}
                                                    controls 
                                                    preload="auto"
                                                    className="w-full h-full"
                                                >
                                                    <source 
                                                        src={replacementPreviewUrl || activeAttachment?.previewUrl || activeAttachment?.publicUrl} 
                                                        type={replacedFile?.type || activeAttachment?.file?.type || activeAttachment?.meta?.file_type || 'video/mp4'} 
                                                    />
                                                    Your browser does not support video playback.
                                                </video>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <Button asChild variant="secondary" size="sm" className="font-bold">
                                                    <a href={rawDirectUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                                                        <ExternalLink className="w-4 h-4" /> Open in New Tab
                                                    </a>
                                                </Button>
                                                {rawDirectUrl && (
                                                    <Button asChild variant="outline" size="sm" className="font-bold border-slate-700">
                                                        <a href={rawDirectUrl} download={activeAttachment?.name || 'video'} className="flex items-center gap-2">
                                                            <Download className="w-4 h-4" /> Download
                                                        </a>
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    ) : isDoc ? (
                                        <div className="flex flex-col items-center gap-4 p-8 bg-slate-900 rounded-2xl border border-white/5 max-w-md text-center">
                                            <FileText className="w-16 h-16 text-blue-400" />
                                            <div>
                                                <h4 className="text-sm font-bold text-white">{activeAttachment?.name || 'Document File'}</h4>
                                                <p className="text-xs text-slate-400 mt-1">Non-image documents can be downloaded or viewed directly.</p>
                                            </div>
                                            {rawDirectUrl && (
                                                <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-500 font-bold">
                                                    <a href={rawDirectUrl} target="_blank" rel="noopener noreferrer">
                                                        <ExternalLink className="w-4 h-4 mr-1.5" /> Open Document
                                                    </a>
                                                </Button>
                                            )}
                                        </div>
                                    ) : (
                                        <>
                                            {isLoadingImage && (
                                                <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-slate-950/70 backdrop-blur-sm gap-3 text-slate-400">
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
                                                className={`shadow-2xl bg-black rounded-lg max-w-full max-h-full ${activeTool ? 'cursor-crosshair' : 'cursor-default'} ${isLoadingImage ? 'opacity-0' : 'opacity-100 transition-opacity duration-200'}`}
                                            />
                                        </>
                                    )}
                                </div>

                                {/* ─── THUMBNAIL STRIP (CAROUSEL) AT BOTTOM OF CANVAS ─── */}
                                {allAttachments.length > 1 && (
                                    <div className="bg-slate-900/90 border-t border-white/10 px-3 py-2 shrink-0">
                                        <div className="flex items-center justify-between mb-1.5 px-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                                                    <ListOrdered className="w-3 h-3 text-blue-400" />
                                                    Record Attachments ({allAttachments.length})
                                                </span>
                                                <span className="text-[9px] text-slate-500">
                                                    Click to view • Use arrows to reorder report print order
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setViewMode('GALLERY')}
                                                className="text-[10px] font-bold text-blue-400 hover:text-blue-300 underline"
                                            >
                                                View Grid
                                            </button>
                                        </div>

                                        <div ref={thumbnailStripRef} className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-700">
                                            {allAttachments.map((item, idx) => {
                                                const itemPreview = item.previewUrl || (item.id ? `/api/attachment/url?id=${encodeURIComponent(item.id)}` : (item.path ? `/api/attachment/download?path=${encodeURIComponent(item.path)}` : ''));
                                                const isItemPhoto = !item.type || String(item.type).toUpperCase() === 'PHOTO' || String(item.type).toLowerCase().includes('image');
                                                const isItemVideo = String(item.type).toUpperCase() === 'VIDEO';
                                                const isActive = idx === activeIndex;

                                                return (
                                                    <div 
                                                        key={item.id || `thumb-${idx}`}
                                                        onClick={() => handleSelectAttachment(idx)}
                                                        className={`relative group shrink-0 w-28 h-20 rounded-lg overflow-hidden border cursor-pointer transition-all ${
                                                            isActive 
                                                                ? 'border-blue-500 ring-2 ring-blue-500 shadow-lg shadow-blue-500/20 bg-blue-950/40' 
                                                                : 'border-white/10 hover:border-white/30 bg-slate-950/60 opacity-80 hover:opacity-100'
                                                        }`}
                                                    >
                                                        {isItemPhoto && itemPreview ? (
                                                            <img 
                                                                src={itemPreview} 
                                                                alt={item.title || item.name} 
                                                                className="w-full h-full object-cover" 
                                                            />
                                                        ) : isItemVideo ? (
                                                            <div className="w-full h-full flex flex-col items-center justify-center bg-black/60 text-blue-400">
                                                                <Video className="w-5 h-5" />
                                                                <span className="text-[8px] font-bold uppercase mt-1">Video</span>
                                                            </div>
                                                        ) : (
                                                            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-slate-400">
                                                                <FileText className="w-5 h-5" />
                                                                <span className="text-[8px] font-bold uppercase mt-1">Doc</span>
                                                            </div>
                                                        )}

                                                        {/* Order Badge */}
                                                        <span className="absolute top-1 left-1 z-10 bg-black/80 backdrop-blur-sm text-white font-black text-[9px] px-1.5 py-0.2 rounded border border-white/20">
                                                            #{idx + 1}
                                                        </span>

                                                        {/* Reorder Buttons on Hover */}
                                                        <div className="absolute inset-x-0 bottom-0 bg-slate-950/90 py-0.5 px-1 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                type="button"
                                                                disabled={idx === 0}
                                                                onClick={(e) => handleMoveAttachment(idx, -1, e)}
                                                                className="p-0.5 rounded hover:bg-white/20 text-slate-300 disabled:opacity-20"
                                                                title="Move Earlier in Report"
                                                            >
                                                                <ChevronLeft className="w-3 h-3" />
                                                            </button>
                                                            <span className="text-[8px] font-black uppercase text-slate-400">
                                                                Order
                                                            </span>
                                                            <button
                                                                type="button"
                                                                disabled={idx === allAttachments.length - 1}
                                                                onClick={(e) => handleMoveAttachment(idx, 1, e)}
                                                                className="p-0.5 rounded hover:bg-white/20 text-slate-300 disabled:opacity-20"
                                                                title="Move Later in Report"
                                                            >
                                                                <ChevronRight className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Brightness & Contrast Sliders */}
                                {!isVideo && !isDoc && (
                                    <div className="p-3 bg-slate-900/60 flex items-center gap-8 border-t border-white/5 shrink-0">
                                        <div className="flex items-center gap-4 flex-1 max-w-xs">
                                            <Sun className="w-4 h-4 text-slate-400" />
                                            <Slider 
                                                value={[brightness]} 
                                                onValueChange={([v]) => setBrightness(v)} 
                                                min={50} max={150} 
                                                className="flex-1"
                                            />
                                            <span className="text-[10px] font-mono text-slate-400 w-8">{brightness}%</span>
                                        </div>
                                        <div className="flex items-center gap-4 flex-1 max-w-xs">
                                            <ContrastIcon className="w-4 h-4 text-slate-400" />
                                            <Slider 
                                                value={[contrast]} 
                                                onValueChange={([v]) => setContrast(v)} 
                                                min={50} max={150} 
                                                className="flex-1"
                                            />
                                            <span className="text-[10px] font-mono text-slate-400 w-8">{contrast}%</span>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* ─── Right Sidebar: Attachment Details & Ordering ─────── */}
                    <div className="w-80 border-l border-white/10 bg-slate-900 p-5 flex flex-col gap-5 shrink-0 overflow-y-auto">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between pb-2 border-b border-white/5">
                                <h3 className="text-xs font-black uppercase tracking-widest text-blue-400 flex items-center gap-1.5">
                                    <span>Attachment Details</span>
                                </h3>
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-white/10">
                                    #{activeIndex + 1} of {allAttachments.length}
                                </span>
                            </div>

                            {/* Report Order Control Card */}
                            {allAttachments.length > 1 && (
                                <div className="p-3 rounded-lg bg-slate-800/80 border border-white/10 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-[10px] font-bold uppercase text-slate-300 flex items-center gap-1">
                                            <ListOrdered className="w-3.5 h-3.5 text-blue-400" />
                                            <span>Report Print Order</span>
                                        </Label>
                                        <span className="text-xs font-black text-blue-400">
                                            Position #{activeIndex + 1}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 leading-tight">
                                        Photos print in reports in this sequential order. Position #1 is printed first.
                                    </p>
                                    <div className="flex items-center gap-2 pt-1">
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            disabled={activeIndex <= 0}
                                            onClick={(e) => handleMoveAttachment(activeIndex, -1, e)}
                                            className="flex-1 h-8 text-[11px] font-bold border-white/10 hover:border-blue-500/50 bg-slate-800 text-slate-200 gap-1"
                                            title="Move Earlier in Report Order"
                                        >
                                            <ArrowLeft className="w-3.5 h-3.5" /> Move Earlier
                                        </Button>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            disabled={activeIndex >= allAttachments.length - 1}
                                            onClick={(e) => handleMoveAttachment(activeIndex, 1, e)}
                                            className="flex-1 h-8 text-[11px] font-bold border-white/10 hover:border-blue-500/50 bg-slate-800 text-slate-200 gap-1"
                                            title="Move Later in Report Order"
                                        >
                                            Move Later <ArrowRight className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Title & Description Fields */}
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-bold uppercase text-slate-400">Title</Label>
                                <Input 
                                    value={title} 
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Photo title / reference..."
                                    className="bg-slate-800 border-white/10 text-white focus:border-blue-500 text-xs h-9"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-bold uppercase text-slate-400">Description</Label>
                                <textarea 
                                    value={description} 
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="w-full h-24 bg-slate-800 border border-white/10 rounded-md p-2.5 text-xs text-white focus:outline-none focus:border-blue-500 resize-none"
                                    placeholder="Add observation specifics or caption..."
                                />
                            </div>

                            {/* File Information & Replacement Section */}
                            <div className="space-y-2.5 pt-3 border-t border-white/5">
                                <div className="flex items-center justify-between">
                                    <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                        <FileUp className="w-3.5 h-3.5 text-blue-400" />
                                        <span>Attachment File</span>
                                    </Label>
                                    {isReplaced ? (
                                        <span className="text-[9px] font-black text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/40 uppercase tracking-wider">
                                            File Replaced
                                        </span>
                                    ) : (
                                        <span className="text-[9px] font-mono font-bold text-blue-400 bg-blue-950/60 px-2 py-0.5 rounded border border-blue-500/30 uppercase">
                                            .{fileExtension}
                                        </span>
                                    )}
                                </div>

                                {/* Actual File Information Card */}
                                <div className={`p-3 rounded-lg border transition-all ${
                                    isReplaced 
                                        ? 'bg-emerald-950/30 border-emerald-500/40 shadow-sm' 
                                        : 'bg-slate-800/80 border-white/10'
                                }`}>
                                    <div className="flex items-start gap-2.5">
                                        <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                                            isReplaced 
                                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                                                : isVideo 
                                                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                                                : isDoc 
                                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                                                : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                        }`}>
                                            {isVideo ? (
                                                <Video className="w-4 h-4" />
                                            ) : isDoc ? (
                                                <FileText className="w-4 h-4" />
                                            ) : (
                                                <ImagePlus className="w-4 h-4" />
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="font-mono text-[11px] font-bold text-white break-all select-all leading-tight" title={actualFileName}>
                                                    {actualFileName}
                                                </span>
                                                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-black uppercase bg-slate-700 text-slate-200 border border-white/10 shrink-0">
                                                    .{fileExtension}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-400 font-mono flex-wrap">
                                                <span className="truncate max-w-[140px]">{mimeType}</span>
                                                {formattedSize && (
                                                    <>
                                                        <span>•</span>
                                                        <span className="text-slate-300 font-bold">{formattedSize}</span>
                                                    </>
                                                )}
                                            </div>

                                            {isReplaced && replacedFile && (
                                                <p className="text-[10px] text-emerald-400 font-medium mt-1.5 flex items-center gap-1">
                                                    <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                                                    <span>New file ready to upload upon saving</span>
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => fileInputRef.current?.click()}
                                            className={`flex-1 h-7 text-[11px] font-bold gap-1.5 transition-all ${
                                                isReplaced 
                                                    ? 'bg-emerald-900/40 hover:bg-emerald-800/60 text-emerald-200 border-emerald-500/40' 
                                                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border-white/10 hover:border-blue-500/50'
                                            }`}
                                            title="Choose a new file to replace this attachment"
                                        >
                                            <Upload className="w-3 h-3 text-blue-400" />
                                            <span>{isReplaced ? "Choose Different File" : "Replace Attachment File"}</span>
                                        </Button>

                                        {isReplaced && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={handleRevertReplacement}
                                                className="h-7 px-2 text-[11px] font-bold text-amber-400 hover:text-amber-300 hover:bg-amber-950/40"
                                                title="Cancel replacement and keep original file"
                                            >
                                                Revert
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Save & Discard Buttons */}
                        <div className="mt-auto space-y-2.5 pt-4 border-t border-white/5">
                            <Button 
                                className="w-full bg-blue-600 hover:bg-blue-500 font-black uppercase tracking-wider h-10 shadow-lg shadow-blue-600/20 text-xs"
                                onClick={handleSave}
                            >
                                <Save className="w-4 h-4 mr-2" /> Save Changes
                            </Button>
                            <Button 
                                variant="outline" 
                                className="w-full border-white/10 bg-transparent hover:bg-white/5 text-slate-400 h-10 text-xs"
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
