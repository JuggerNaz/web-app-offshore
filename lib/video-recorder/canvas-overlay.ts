/**
 * Canvas Overlay Manager
 * Handles interactive drawing, text annotations, selection, moving, resizing, sticky tools, and rendering
 */

export type DrawingTool = 'pen' | 'line' | 'arrow' | 'circle' | 'rectangle' | 'text' | 'select';

export interface DrawingState {
    tool: DrawingTool;
    color: string;
    lineWidth: number;
    fontSize?: number;
    isDrawing: boolean;
    isSticky: boolean;
}

export interface Point {
    x: number; // Normalized coordinate (0 to 1)
    y: number; // Normalized coordinate (0 to 1)
}

export interface DrawingObject {
    id: string;
    type: DrawingTool;
    color: string;
    lineWidth: number;
    fontSize?: number;
    text?: string;
    points?: Point[];      // For pen/freehand
    startPoint?: Point;  // For line, arrow, circle, rectangle, text
    endPoint?: Point;    // For line, arrow, circle, rectangle, text
}

export class CanvasOverlayManager {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private state: DrawingState;
    private objects: DrawingObject[] = [];
    private currentObject: DrawingObject | null = null;
    private selectedObjectId: string | null = null;
    private history: DrawingObject[][] = [];
    private historyIndex: number = -1;

    // Drag / Interaction State
    private isDragging: boolean = false;
    private isResizing: boolean = false;
    private resizeHandle: 'tl' | 'tr' | 'bl' | 'br' | null = null;
    private dragStartPos: Point | null = null;
    private initialObjState: DrawingObject | null = null;

    public onSelectionChange?: (obj: DrawingObject | null) => void;
    public onTextRequest?: (pos: Point, existingText?: string, objId?: string) => void;
    public onObjectsChange?: (objects: DrawingObject[]) => void;
    public onToolChange?: (tool: DrawingTool, isSticky: boolean) => void;

    constructor(canvas: HTMLCanvasElement) {
        // Singleton failsafe: Destroy previous manager instance on this canvas if any
        if ((canvas as any).__overlayManager && (canvas as any).__overlayManager !== this) {
            try {
                (canvas as any).__overlayManager.destroy();
            } catch (e) {
                // Ignore cleanup errors
            }
        }
        (canvas as any).__overlayManager = this;

        this.canvas = canvas;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get canvas context');
        this.ctx = ctx;

        this.state = {
            tool: 'select',
            color: '#ef4444',
            lineWidth: 3,
            fontSize: 18,
            isDrawing: false,
            isSticky: false,
        };

        this.setupEventListeners();
    }

    private setupEventListeners() {
        this.canvas.addEventListener('mousedown', this.handleMouseDown);
        this.canvas.addEventListener('mousemove', this.handleMouseMove);
        this.canvas.addEventListener('mouseup', this.handleMouseUp);
        this.canvas.addEventListener('mouseleave', this.handleMouseUp);
        this.canvas.addEventListener('dblclick', this.handleDoubleClick);

        // Touch support
        this.canvas.addEventListener('touchstart', this.handleTouchStart);
        this.canvas.addEventListener('touchmove', this.handleTouchMove);
        this.canvas.addEventListener('touchend', this.handleMouseUp);

        // Keyboard shortcuts (Delete / Backspace)
        window.addEventListener('keydown', this.handleKeyDown);
    }

    private getMousePos(e: any): Point {
        const rect = this.canvas.getBoundingClientRect();
        let clientX = 0;
        let clientY = 0;

        if (e.clientX !== undefined) {
            clientX = e.clientX;
            clientY = e.clientY;
        } else if (e.touches && e.touches[0]) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else if (e.changedTouches && e.changedTouches[0]) {
            clientX = e.changedTouches[0].clientX;
            clientY = e.changedTouches[0].clientY;
        }

        const normX = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
        const normY = Math.max(0, Math.min(1, (clientY - rect.top) / Math.max(1, rect.height)));

        return { x: normX, y: normY };
    }

    private handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Delete' || e.key === 'Backspace') {
            const activeEl = document.activeElement;
            if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
                return;
            }
            if (this.selectedObjectId) {
                this.deleteSelected();
            }
        }
    };

    private getBoundingBox(obj: DrawingObject): { minX: number; minY: number; maxX: number; maxY: number } {
        let minX = 1, minY = 1, maxX = 0, maxY = 0;

        if (obj.points && obj.points.length > 0) {
            obj.points.forEach(p => {
                minX = Math.min(minX, p.x);
                minY = Math.min(minY, p.y);
                maxX = Math.max(maxX, p.x);
                maxY = Math.max(maxY, p.y);
            });
        } else if (obj.startPoint) {
            const start = obj.startPoint;
            const end = obj.endPoint || start;

            if (obj.type === 'circle') {
                const r = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
                minX = Math.max(0, start.x - r);
                maxX = Math.min(1, start.x + r);
                minY = Math.max(0, start.y - r);
                maxY = Math.min(1, start.y + r);
            } else if (obj.type === 'text' && obj.text) {
                const W = this.canvas.width || 800;
                const H = this.canvas.height || 600;
                const fSize = Math.max(12, Math.round(((obj.fontSize || 18) / 800) * H));
                this.ctx.font = `bold ${fSize}px system-ui, -apple-system, sans-serif`;
                const metrics = this.ctx.measureText(obj.text);
                const pad = fSize * 0.4;

                const textWidthNorm = (metrics.width + pad * 2) / W;
                const textHeightNorm = (fSize + pad * 1.5) / H;

                minX = Math.max(0, start.x - pad / W);
                maxX = Math.min(1, start.x + textWidthNorm);
                minY = Math.max(0, start.y - pad / H);
                maxY = Math.min(1, start.y + textHeightNorm);
            } else {
                minX = Math.min(start.x, end.x);
                maxX = Math.max(start.x, end.x);
                minY = Math.min(start.y, end.y);
                maxY = Math.max(start.y, end.y);
            }
        }

        const padX = 0.01;
        const padY = 0.01;
        return {
            minX: Math.max(0, minX - padX),
            minY: Math.max(0, minY - padY),
            maxX: Math.min(1, maxX + padX),
            maxY: Math.min(1, maxY + padY),
        };
    }

    private getHandleAtPoint(pos: Point, obj: DrawingObject): 'tl' | 'tr' | 'bl' | 'br' | null {
        const box = this.getBoundingBox(obj);
        const handleRadius = 0.03;

        const handles = [
            { id: 'tl', x: box.minX, y: box.minY },
            { id: 'tr', x: box.maxX, y: box.minY },
            { id: 'bl', x: box.minX, y: box.maxY },
            { id: 'br', x: box.maxX, y: box.maxY },
        ];

        for (const h of handles) {
            const dist = Math.sqrt(Math.pow(pos.x - h.x, 2) + Math.pow(pos.y - h.y, 2));
            if (dist <= handleRadius) {
                return h.id as any;
            }
        }

        return null;
    }

    private pointToLineDistance(point: { x: number; y: number }, start: { x: number; y: number }, end: { x: number; y: number }): number {
        const A = point.x - start.x;
        const B = point.y - start.y;
        const C = end.x - start.x;
        const D = end.y - start.y;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;

        if (lenSq !== 0) param = dot / lenSq;

        let xx, yy;

        if (param < 0) {
            xx = start.x;
            yy = start.y;
        } else if (param > 1) {
            xx = end.x;
            yy = end.y;
        } else {
            xx = start.x + param * C;
            yy = start.y + param * D;
        }

        const dx = point.x - xx;
        const dy = point.y - yy;
        return Math.sqrt(dx * dx + dy * dy);
    }

    private isPointInObject(pos: Point, obj: DrawingObject): boolean {
        const W = this.canvas.width || 800;
        const H = this.canvas.height || 600;
        const px = pos.x * W;
        const py = pos.y * H;

        const tolerance = Math.max((obj.lineWidth / 1000) * Math.min(W, H) * 2, 12);

        switch (obj.type) {
            case 'pen':
                if (obj.points) {
                    for (let i = 0; i < obj.points.length; i++) {
                        const p = obj.points[i];
                        const dist = Math.sqrt(Math.pow(px - p.x * W, 2) + Math.pow(py - p.y * H, 2));
                        if (dist <= tolerance) return true;
                    }
                }
                break;

            case 'line':
            case 'arrow':
                if (obj.startPoint && obj.endPoint) {
                    const sx = obj.startPoint.x * W;
                    const sy = obj.startPoint.y * H;
                    const ex = obj.endPoint.x * W;
                    const ey = obj.endPoint.y * H;
                    const dist = this.pointToLineDistance({ x: px, y: py }, { x: sx, y: sy }, { x: ex, y: ey });
                    if (dist <= tolerance) return true;
                }
                break;

            case 'circle':
                if (obj.startPoint && obj.endPoint) {
                    const sx = obj.startPoint.x * W;
                    const sy = obj.startPoint.y * H;
                    const ex = obj.endPoint.x * W;
                    const ey = obj.endPoint.y * H;
                    const radius = Math.sqrt(Math.pow(ex - sx, 2) + Math.pow(ey - sy, 2));
                    const dist = Math.sqrt(Math.pow(px - sx, 2) + Math.pow(py - sy, 2));
                    if (dist <= radius + tolerance) return true;
                }
                break;

            case 'rectangle':
                if (obj.startPoint && obj.endPoint) {
                    const minX = Math.min(obj.startPoint.x, obj.endPoint.x) * W;
                    const maxX = Math.max(obj.startPoint.x, obj.endPoint.x) * W;
                    const minY = Math.min(obj.startPoint.y, obj.endPoint.y) * H;
                    const maxY = Math.max(obj.startPoint.y, obj.endPoint.y) * H;

                    if (px >= minX - tolerance && px <= maxX + tolerance &&
                        py >= minY - tolerance && py <= maxY + tolerance) return true;
                }
                break;

            case 'text':
                if (obj.startPoint && obj.text) {
                    const box = this.getBoundingBox(obj);
                    return this.isPointInBox(pos, box);
                }
                break;
        }

        return false;
    }

    private isPointInBox(pos: Point, box: { minX: number; minY: number; maxX: number; maxY: number }): boolean {
        return pos.x >= box.minX && pos.x <= box.maxX && pos.y >= box.minY && pos.y <= box.maxY;
    }

    private findObjectAtPoint(pos: Point): DrawingObject | null {
        for (let i = this.objects.length - 1; i >= 0; i--) {
            const obj = this.objects[i];
            if (this.isPointInObject(pos, obj)) {
                return obj;
            }
        }
        return null;
    }

    private handleMouseDown = (e: MouseEvent) => {
        const pos = this.getMousePos(e);

        if (this.state.tool === 'select') {
            if (this.selectedObjectId) {
                const selectedObj = this.objects.find(o => o.id === this.selectedObjectId);
                if (selectedObj) {
                    const handle = this.getHandleAtPoint(pos, selectedObj);
                    if (handle) {
                        this.isResizing = true;
                        this.resizeHandle = handle;
                        this.dragStartPos = pos;
                        this.initialObjState = JSON.parse(JSON.stringify(selectedObj));
                        return;
                    }

                    const box = this.getBoundingBox(selectedObj);
                    if (this.isPointInObject(pos, selectedObj) || this.isPointInBox(pos, box)) {
                        this.isDragging = true;
                        this.dragStartPos = pos;
                        this.initialObjState = JSON.parse(JSON.stringify(selectedObj));
                        return;
                    }
                }
            }

            const clickedObject = this.findObjectAtPoint(pos);
            if (clickedObject) {
                this.selectedObjectId = clickedObject.id;
                this.isDragging = true;
                this.dragStartPos = pos;
                this.initialObjState = JSON.parse(JSON.stringify(clickedObject));
                this.onSelectionChange?.(clickedObject);
            } else {
                this.selectedObjectId = null;
                this.onSelectionChange?.(null);
            }
            this.redraw();
            return;
        }

        this.selectedObjectId = null;
        this.onSelectionChange?.(null);

        if (this.state.tool === 'text') {
            if (this.onTextRequest) {
                this.onTextRequest(pos);
            } else {
                const inputTxt = prompt("Enter annotation text:", "Defect Area");
                if (inputTxt && inputTxt.trim()) {
                    this.addTextObject(pos, inputTxt.trim());
                }
            }
            return;
        }

        this.state.isDrawing = true;
        this.currentObject = {
            id: Date.now().toString(),
            type: this.state.tool,
            color: this.state.color,
            lineWidth: this.state.lineWidth,
            fontSize: this.state.fontSize || 18,
        };

        if (this.state.tool === 'pen') {
            this.currentObject.points = [pos];
        } else {
            this.currentObject.startPoint = pos;
            this.currentObject.endPoint = pos;
        }
    };

    public addTextObject(pos: Point, text: string) {
        const textObj: DrawingObject = {
            id: Date.now().toString(),
            type: 'text',
            color: this.state.color,
            lineWidth: this.state.lineWidth,
            fontSize: this.state.fontSize || 18,
            text: text,
            startPoint: pos,
            endPoint: { x: Math.min(1, pos.x + 0.2), y: Math.min(1, pos.y + 0.05) },
        };
        this.objects.push(textObj);
        this.selectedObjectId = textObj.id;
        
        // Auto switch back to selection tool unless tool is locked/sticky
        if (!this.state.isSticky) {
            this.state.tool = 'select';
            this.onToolChange?.('select', false);
        }
        
        this.onSelectionChange?.(textObj);
        this.saveToHistory();
        this.redraw();
    }

    public updateTextObject(objId: string, text: string) {
        const obj = this.objects.find(o => o.id === objId);
        if (obj && obj.type === 'text') {
            obj.text = text;
            this.saveToHistory();
            this.redraw();
        }
    }

    private handleMouseMove = (e: MouseEvent) => {
        const pos = this.getMousePos(e);

        if (this.isResizing && this.selectedObjectId && this.initialObjState && this.dragStartPos) {
            const obj = this.objects.find(o => o.id === this.selectedObjectId);
            if (!obj) return;

            const dx = pos.x - this.dragStartPos.x;
            const dy = pos.y - this.dragStartPos.y;

            if (obj.type === 'pen' && obj.points && this.initialObjState.points) {
                const initialBox = this.getBoundingBox(this.initialObjState);
                const width = Math.max(0.01, initialBox.maxX - initialBox.minX);
                const height = Math.max(0.01, initialBox.maxY - initialBox.minY);

                let scaleX = 1;
                let scaleY = 1;

                if (this.resizeHandle === 'br') {
                    scaleX = Math.max(0.2, (width + dx) / width);
                    scaleY = Math.max(0.2, (height + dy) / height);
                } else if (this.resizeHandle === 'tl') {
                    scaleX = Math.max(0.2, (width - dx) / width);
                    scaleY = Math.max(0.2, (height - dy) / height);
                }

                obj.points = this.initialObjState.points.map(p => ({
                    x: Math.max(0, Math.min(1, initialBox.minX + (p.x - initialBox.minX) * scaleX)),
                    y: Math.max(0, Math.min(1, initialBox.minY + (p.y - initialBox.minY) * scaleY)),
                }));
            } else if (obj.startPoint && this.initialObjState.startPoint) {
                if (this.resizeHandle === 'br' || this.resizeHandle === 'tr') {
                    obj.endPoint = {
                        x: Math.max(0, Math.min(1, (this.initialObjState.endPoint?.x || obj.startPoint.x) + dx)),
                        y: Math.max(0, Math.min(1, (this.initialObjState.endPoint?.y || obj.startPoint.y) + dy)),
                    };
                } else if (this.resizeHandle === 'tl' || this.resizeHandle === 'bl') {
                    obj.startPoint = {
                        x: Math.max(0, Math.min(1, this.initialObjState.startPoint.x + dx)),
                        y: Math.max(0, Math.min(1, this.initialObjState.startPoint.y + dy)),
                    };
                }

                if (obj.type === 'text' && obj.fontSize && this.initialObjState.fontSize) {
                    const fontDelta = (dx + dy) * 50;
                    obj.fontSize = Math.max(10, Math.min(72, Math.round(this.initialObjState.fontSize + fontDelta)));
                }
            }

            this.redraw();
            return;
        }

        if (this.isDragging && this.selectedObjectId && this.initialObjState && this.dragStartPos) {
            const obj = this.objects.find(o => o.id === this.selectedObjectId);
            if (!obj) return;

            const dx = pos.x - this.dragStartPos.x;
            const dy = pos.y - this.dragStartPos.y;

            if (obj.points && this.initialObjState.points) {
                obj.points = this.initialObjState.points.map(p => ({
                    x: Math.max(0, Math.min(1, p.x + dx)),
                    y: Math.max(0, Math.min(1, p.y + dy)),
                }));
            }
            if (obj.startPoint && this.initialObjState.startPoint) {
                obj.startPoint = {
                    x: Math.max(0, Math.min(1, this.initialObjState.startPoint.x + dx)),
                    y: Math.max(0, Math.min(1, this.initialObjState.startPoint.y + dy)),
                };
            }
            if (obj.endPoint && this.initialObjState.endPoint) {
                obj.endPoint = {
                    x: Math.max(0, Math.min(1, this.initialObjState.endPoint.x + dx)),
                    y: Math.max(0, Math.min(1, this.initialObjState.endPoint.y + dy)),
                };
            }

            this.redraw();
            return;
        }

        if (!this.state.isDrawing || !this.currentObject) return;

        if (this.state.tool === 'pen') {
            this.currentObject.points?.push(pos);
        } else {
            this.currentObject.endPoint = pos;
        }

        this.redraw();
    };

    private handleMouseUp = () => {
        if (this.isDragging || this.isResizing) {
            this.isDragging = false;
            this.isResizing = false;
            this.resizeHandle = null;
            this.dragStartPos = null;
            this.initialObjState = null;
            this.saveToHistory();
            this.redraw();
            return;
        }

        if (!this.state.isDrawing) return;
        this.state.isDrawing = false;

        if (this.currentObject) {
            this.objects.push(this.currentObject);
            this.selectedObjectId = this.currentObject.id;
            this.saveToHistory();
            this.currentObject = null;

            // Auto-switch to Selection Tool after drawing 1 object UNLESS tool is Sticky (locked)
            if (!this.state.isSticky) {
                this.state.tool = 'select';
                this.onToolChange?.('select', false);
            }
            this.onSelectionChange?.(this.getSelectedObject());
        }

        this.redraw();
    };

    private handleDoubleClick = (e: MouseEvent) => {
        const pos = this.getMousePos(e);
        const obj = this.findObjectAtPoint(pos);
        if (obj && obj.type === 'text') {
            if (this.onTextRequest) {
                this.onTextRequest(pos, obj.text, obj.id);
            } else {
                const newTxt = prompt("Edit text annotation:", obj.text || "");
                if (newTxt !== null && newTxt.trim()) {
                    this.updateTextObject(obj.id, newTxt.trim());
                }
            }
        }
    };

    private handleTouchStart = (e: TouchEvent) => {
        e.preventDefault();
        this.handleMouseDown(e as any);
    };

    private handleTouchMove = (e: TouchEvent) => {
        e.preventDefault();
        this.handleMouseMove(e as any);
    };

    private drawObject(obj: DrawingObject, W: number, H: number) {
        this.ctx.strokeStyle = obj.color;
        this.ctx.fillStyle = obj.color;
        this.ctx.lineWidth = Math.max(obj.lineWidth || 2, Math.round(((obj.lineWidth || 3) / 800) * Math.min(W, H)));
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        switch (obj.type) {
            case 'pen':
                if (obj.points && obj.points.length > 0) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(obj.points[0].x * W, obj.points[0].y * H);
                    if (obj.points.length === 1) {
                        this.ctx.lineTo(obj.points[0].x * W + 0.5, obj.points[0].y * H + 0.5);
                    } else {
                        for (let i = 1; i < obj.points.length; i++) {
                            this.ctx.lineTo(obj.points[i].x * W, obj.points[i].y * H);
                        }
                    }
                    this.ctx.stroke();
                }
                break;

            case 'line':
                if (obj.startPoint && obj.endPoint) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(obj.startPoint.x * W, obj.startPoint.y * H);
                    this.ctx.lineTo(obj.endPoint.x * W, obj.endPoint.y * H);
                    this.ctx.stroke();
                }
                break;

            case 'arrow':
                if (obj.startPoint && obj.endPoint) {
                    this.drawArrow(obj.startPoint, obj.endPoint, W, H);
                }
                break;

            case 'circle':
                if (obj.startPoint && obj.endPoint) {
                    const startX = obj.startPoint.x * W;
                    const startY = obj.startPoint.y * H;
                    const endX = obj.endPoint.x * W;
                    const endY = obj.endPoint.y * H;
                    const radius = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));

                    this.ctx.beginPath();
                    this.ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
                    this.ctx.stroke();
                }
                break;

            case 'rectangle':
                if (obj.startPoint && obj.endPoint) {
                    const x = obj.startPoint.x * W;
                    const y = obj.startPoint.y * H;
                    const width = (obj.endPoint.x - obj.startPoint.x) * W;
                    const height = (obj.endPoint.y - obj.startPoint.y) * H;
                    this.ctx.strokeRect(x, y, width, height);
                }
                break;

            case 'text':
                if (obj.startPoint && obj.text) {
                    const x = obj.startPoint.x * W;
                    const y = obj.startPoint.y * H;
                    const fSize = Math.max(12, Math.round(((obj.fontSize || 18) / 800) * H));

                    this.ctx.font = `bold ${fSize}px system-ui, -apple-system, sans-serif`;
                    this.ctx.textBaseline = 'top';
                    const metrics = this.ctx.measureText(obj.text);
                    const pad = fSize * 0.4;

                    this.ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
                    this.ctx.beginPath();
                    if (typeof this.ctx.roundRect === 'function') {
                        this.ctx.roundRect(x - pad, y - pad / 2, metrics.width + pad * 2, fSize + pad * 1.2, 6);
                    } else {
                        this.ctx.rect(x - pad, y - pad / 2, metrics.width + pad * 2, fSize + pad * 1.2);
                    }
                    this.ctx.fill();
                    this.ctx.strokeStyle = obj.color;
                    this.ctx.stroke();

                    this.ctx.fillStyle = obj.color;
                    this.ctx.fillText(obj.text, x, y);
                }
                break;
        }

        if (obj.id === this.selectedObjectId) {
            const box = this.getBoundingBox(obj);
            const bx = box.minX * W;
            const by = box.minY * H;
            const bw = (box.maxX - box.minX) * W;
            const bh = (box.maxY - box.minY) * H;

            this.ctx.save();
            this.ctx.strokeStyle = '#3b82f6';
            this.ctx.lineWidth = 1.5;
            this.ctx.setLineDash([4, 4]);
            this.ctx.strokeRect(bx, by, bw, bh);
            this.ctx.restore();

            const handleSize = 8;
            this.ctx.fillStyle = '#3b82f6';
            [
                { x: bx, y: by },
                { x: bx + bw, y: by },
                { x: bx, y: by + bh },
                { x: bx + bw, y: by + bh },
            ].forEach(h => {
                this.ctx.fillRect(h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize);
            });
        }
    }

    private drawArrow(start: Point, end: Point, W: number, H: number) {
        const sx = start.x * W;
        const sy = start.y * H;
        const ex = end.x * W;
        const ey = end.y * H;
        const headLength = 16;
        const angle = Math.atan2(ey - sy, ex - sx);

        this.ctx.beginPath();
        this.ctx.moveTo(sx, sy);
        this.ctx.lineTo(ex, ey);
        this.ctx.stroke();

        this.ctx.beginPath();
        this.ctx.moveTo(ex, ey);
        this.ctx.lineTo(ex - headLength * Math.cos(angle - Math.PI / 6), ey - headLength * Math.sin(angle - Math.PI / 6));
        this.ctx.moveTo(ex, ey);
        this.ctx.lineTo(ex - headLength * Math.cos(angle + Math.PI / 6), ey - headLength * Math.sin(angle + Math.PI / 6));
        this.ctx.stroke();
    }

    public redraw() {
        const rect = this.canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        const targetW = Math.floor(rect.width);
        const targetH = Math.floor(rect.height);

        if (this.canvas.width !== targetW || this.canvas.height !== targetH) {
            this.canvas.width = targetW;
            this.canvas.height = targetH;
        }

        const W = this.canvas.width;
        const H = this.canvas.height;

        this.ctx.clearRect(0, 0, W, H);
        this.objects.forEach(obj => this.drawObject(obj, W, H));

        if (this.currentObject) {
            this.drawObject(this.currentObject, W, H);
        }
    }

    public setTool(tool: DrawingTool, isSticky: boolean = false) {
        this.state.tool = tool;
        this.state.isSticky = tool === 'select' ? false : isSticky;
        if (tool !== 'select') {
            this.selectedObjectId = null;
            this.onSelectionChange?.(null);
            this.redraw();
        }
    }

    public getTool(): { tool: DrawingTool; isSticky: boolean } {
        return { tool: this.state.tool, isSticky: this.state.isSticky };
    }

    public setColor(color: string) {
        this.state.color = color;
        if (this.selectedObjectId) {
            const obj = this.objects.find(o => o.id === this.selectedObjectId);
            if (obj) {
                obj.color = color;
                this.saveToHistory();
                this.redraw();
            }
        }
    }

    public setLineWidth(width: number) {
        this.state.lineWidth = width;
        if (this.selectedObjectId) {
            const obj = this.objects.find(o => o.id === this.selectedObjectId);
            if (obj) {
                obj.lineWidth = width;
                this.saveToHistory();
                this.redraw();
            }
        }
    }

    public deleteSelected() {
        if (this.selectedObjectId) {
            this.objects = this.objects.filter(o => o.id !== this.selectedObjectId);
            this.selectedObjectId = null;
            this.onSelectionChange?.(null);
            this.saveToHistory();
            this.redraw();
        }
    }

    public getSelectedObject(): DrawingObject | null {
        if (!this.selectedObjectId) return null;
        return this.objects.find(o => o.id === this.selectedObjectId) || null;
    }

    public undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.objects = JSON.parse(JSON.stringify(this.history[this.historyIndex]));
            this.selectedObjectId = null;
            this.onSelectionChange?.(null);
            this.onObjectsChange?.(this.objects);
            this.redraw();
        }
    }

    public redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.objects = JSON.parse(JSON.stringify(this.history[this.historyIndex]));
            this.selectedObjectId = null;
            this.onSelectionChange?.(null);
            this.onObjectsChange?.(this.objects);
            this.redraw();
        }
    }

    public clear() {
        this.objects = [];
        this.selectedObjectId = null;
        this.onSelectionChange?.(null);
        this.saveToHistory();
        this.redraw();
    }

    public getObjects(): DrawingObject[] {
        return this.objects;
    }

    public setObjects(objects: DrawingObject[]) {
        this.objects = JSON.parse(JSON.stringify(objects));
        this.history = [JSON.parse(JSON.stringify(objects))];
        this.historyIndex = 0;
        this.redraw();
        this.onObjectsChange?.(this.objects);
    }

    public getCanvas(): HTMLCanvasElement {
        return this.canvas;
    }

    private saveToHistory() {
        this.history = this.history.slice(0, this.historyIndex + 1);
        this.history.push(JSON.parse(JSON.stringify(this.objects)));
        this.historyIndex++;
        this.onObjectsChange?.(this.objects);
    }

    public destroy() {
        if ((this.canvas as any).__overlayManager === this) {
            delete (this.canvas as any).__overlayManager;
        }
        this.canvas.removeEventListener('mousedown', this.handleMouseDown);
        this.canvas.removeEventListener('mousemove', this.handleMouseMove);
        this.canvas.removeEventListener('mouseup', this.handleMouseUp);
        this.canvas.removeEventListener('mouseleave', this.handleMouseUp);
        this.canvas.removeEventListener('dblclick', this.handleDoubleClick);
        this.canvas.removeEventListener('touchstart', this.handleTouchStart);
        this.canvas.removeEventListener('touchmove', this.handleTouchMove);
        this.canvas.removeEventListener('touchend', this.handleMouseUp);
        window.removeEventListener('keydown', this.handleKeyDown);
    }
}
