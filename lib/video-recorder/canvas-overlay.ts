/**
 * Canvas Overlay Manager
 * Handles drawing annotations on video stream
 */

export type DrawingTool = 'pen' | 'line' | 'arrow' | 'circle' | 'rectangle' | 'text' | 'select';

export interface DrawingState {
    tool: DrawingTool;
    color: string;
    lineWidth: number;
    isDrawing: boolean;
}

export interface DrawingObject {
    id: string;
    type: DrawingTool;
    color: string;
    lineWidth: number;
    points?: { x: number; y: number }[];
    startPoint?: { x: number; y: number };
    endPoint?: { x: number; y: number };
    text?: string;
}

export class CanvasOverlayManager {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private state: DrawingState;
    private objects: DrawingObject[] = [];
    private currentObject: DrawingObject | null = null;
    private history: DrawingObject[][] = [];
    private historyIndex: number = -1;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get canvas context');
        this.ctx = ctx;

        this.state = {
            tool: 'pen',
            color: '#ef4444',
            lineWidth: 3,
            isDrawing: false,
        };

        this.setupEventListeners();
    }

    private setupEventListeners() {
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('mouseleave', this.handleMouseUp.bind(this));

        // Touch support
        this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this));
        this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this));
        this.canvas.addEventListener('touchend', this.handleMouseUp.bind(this));
    }

    private getMousePos(e: MouseEvent | TouchEvent): { x: number; y: number } {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        if (e instanceof MouseEvent) {
            return {
                x: (e.clientX - rect.left) * scaleX,
                y: (e.clientY - rect.top) * scaleY,
            };
        } else {
            const touch = e.touches[0] || e.changedTouches[0];
            return {
                x: (touch.clientX - rect.left) * scaleX,
                y: (touch.clientY - rect.top) * scaleY,
            };
        }
    }

    private handleMouseDown(e: MouseEvent) {
        const pos = this.getMousePos(e);

        // Handle select tool
        if (this.state.tool === 'select') {
            const clickedObject = this.findObjectAtPoint(pos);
            if (clickedObject) {
                // Remove the clicked object
                this.objects = this.objects.filter(obj => obj.id !== clickedObject.id);
                this.saveToHistory();
                this.redraw();
            }
            return;
        }

        this.state.isDrawing = true;

        this.currentObject = {
            id: Date.now().toString(),
            type: this.state.tool,
            color: this.state.color,
            lineWidth: this.state.lineWidth,
        };

        if (this.state.tool === 'pen') {
            this.currentObject.points = [pos];
        } else {
            this.currentObject.startPoint = pos;
        }
    }

    private findObjectAtPoint(point: { x: number; y: number }): DrawingObject | null {
        // Check objects in reverse order (top to bottom)
        for (let i = this.objects.length - 1; i >= 0; i--) {
            const obj = this.objects[i];
            if (this.isPointInObject(point, obj)) {
                return obj;
            }
        }
        return null;
    }

    private isPointInObject(point: { x: number; y: number }, obj: DrawingObject): boolean {
        const tolerance = Math.max(obj.lineWidth * 2, 10); // Hit area tolerance

        switch (obj.type) {
            case 'pen':
                if (obj.points) {
                    for (const p of obj.points) {
                        const dist = Math.sqrt(Math.pow(point.x - p.x, 2) + Math.pow(point.y - p.y, 2));
                        if (dist <= tolerance) return true;
                    }
                }
                break;

            case 'line':
            case 'arrow':
                if (obj.startPoint && obj.endPoint) {
                    const dist = this.pointToLineDistance(point, obj.startPoint, obj.endPoint);
                    if (dist <= tolerance) return true;
                }
                break;

            case 'circle':
                if (obj.startPoint && obj.endPoint) {
                    const radius = Math.sqrt(
                        Math.pow(obj.endPoint.x - obj.startPoint.x, 2) +
                        Math.pow(obj.endPoint.y - obj.startPoint.y, 2)
                    );
                    const dist = Math.sqrt(
                        Math.pow(point.x - obj.startPoint.x, 2) +
                        Math.pow(point.y - obj.startPoint.y, 2)
                    );
                    if (Math.abs(dist - radius) <= tolerance) return true;
                }
                break;

            case 'rectangle':
                if (obj.startPoint && obj.endPoint) {
                    const minX = Math.min(obj.startPoint.x, obj.endPoint.x);
                    const maxX = Math.max(obj.startPoint.x, obj.endPoint.x);
                    const minY = Math.min(obj.startPoint.y, obj.endPoint.y);
                    const maxY = Math.max(obj.startPoint.y, obj.endPoint.y);

                    // Check if point is on any edge
                    if ((Math.abs(point.x - minX) <= tolerance || Math.abs(point.x - maxX) <= tolerance) &&
                        point.y >= minY - tolerance && point.y <= maxY + tolerance) return true;
                    if ((Math.abs(point.y - minY) <= tolerance || Math.abs(point.y - maxY) <= tolerance) &&
                        point.x >= minX - tolerance && point.x <= maxX + tolerance) return true;
                }
                break;
        }

        return false;
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

    private handleMouseMove(e: MouseEvent) {
        if (!this.state.isDrawing || !this.currentObject) return;

        const pos = this.getMousePos(e);

        if (this.state.tool === 'pen') {
            this.currentObject.points?.push(pos);
        } else {
            this.currentObject.endPoint = pos;
        }

        this.redraw();
    }

    private handleMouseUp() {
        if (!this.state.isDrawing) return;
        this.state.isDrawing = false;

        if (this.currentObject) {
            this.objects.push(this.currentObject);
            this.saveToHistory();
            this.currentObject = null;
        }

        this.redraw();
    }

    private handleTouchStart(e: TouchEvent) {
        e.preventDefault();
        this.handleMouseDown(e as any);
    }

    private handleTouchMove(e: TouchEvent) {
        e.preventDefault();
        this.handleMouseMove(e as any);
    }

    private saveToHistory() {
        // Remove any redo history
        this.history = this.history.slice(0, this.historyIndex + 1);
        // Save current state
        this.history.push([...this.objects]);
        this.historyIndex++;
    }

    private drawObject(obj: DrawingObject) {
        this.ctx.strokeStyle = obj.color;
        this.ctx.fillStyle = obj.color;
        this.ctx.lineWidth = obj.lineWidth;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        switch (obj.type) {
            case 'pen':
                if (obj.points && obj.points.length > 1) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(obj.points[0].x, obj.points[0].y);
                    for (let i = 1; i < obj.points.length; i++) {
                        this.ctx.lineTo(obj.points[i].x, obj.points[i].y);
                    }
                    this.ctx.stroke();
                }
                break;

            case 'line':
                if (obj.startPoint && obj.endPoint) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(obj.startPoint.x, obj.startPoint.y);
                    this.ctx.lineTo(obj.endPoint.x, obj.endPoint.y);
                    this.ctx.stroke();
                }
                break;

            case 'arrow':
                if (obj.startPoint && obj.endPoint) {
                    this.drawArrow(obj.startPoint, obj.endPoint);
                }
                break;

            case 'circle':
                if (obj.startPoint && obj.endPoint) {
                    const radius = Math.sqrt(
                        Math.pow(obj.endPoint.x - obj.startPoint.x, 2) +
                        Math.pow(obj.endPoint.y - obj.startPoint.y, 2)
                    );
                    this.ctx.beginPath();
                    this.ctx.arc(obj.startPoint.x, obj.startPoint.y, radius, 0, 2 * Math.PI);
                    this.ctx.stroke();
                }
                break;

            case 'rectangle':
                if (obj.startPoint && obj.endPoint) {
                    const width = obj.endPoint.x - obj.startPoint.x;
                    const height = obj.endPoint.y - obj.startPoint.y;
                    this.ctx.strokeRect(obj.startPoint.x, obj.startPoint.y, width, height);
                }
                break;
        }
    }

    private drawArrow(start: { x: number; y: number }, end: { x: number; y: number }) {
        const headLength = 15;
        const angle = Math.atan2(end.y - start.y, end.x - start.x);

        // Draw line
        this.ctx.beginPath();
        this.ctx.moveTo(start.x, start.y);
        this.ctx.lineTo(end.x, end.y);
        this.ctx.stroke();

        // Draw arrowhead
        this.ctx.beginPath();
        this.ctx.moveTo(end.x, end.y);
        this.ctx.lineTo(
            end.x - headLength * Math.cos(angle - Math.PI / 6),
            end.y - headLength * Math.sin(angle - Math.PI / 6)
        );
        this.ctx.moveTo(end.x, end.y);
        this.ctx.lineTo(
            end.x - headLength * Math.cos(angle + Math.PI / 6),
            end.y - headLength * Math.sin(angle + Math.PI / 6)
        );
        this.ctx.stroke();
    }

    public redraw() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw all objects
        this.objects.forEach(obj => this.drawObject(obj));

        // Draw current object being drawn
        if (this.currentObject) {
            this.drawObject(this.currentObject);
        }
    }

    public setTool(tool: DrawingTool) {
        this.state.tool = tool;
    }

    public setColor(color: string) {
        this.state.color = color;
    }

    public setLineWidth(width: number) {
        this.state.lineWidth = width;
    }

    public undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.objects = [...this.history[this.historyIndex]];
            this.redraw();
        }
    }

    public redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.objects = [...this.history[this.historyIndex]];
            this.redraw();
        }
    }

    public clear() {
        this.objects = [];
        this.saveToHistory();
        this.redraw();
    }

    public getCanvas(): HTMLCanvasElement {
        return this.canvas;
    }

    public destroy() {
        // Remove event listeners
        this.canvas.removeEventListener('mousedown', this.handleMouseDown);
        this.canvas.removeEventListener('mousemove', this.handleMouseMove);
        this.canvas.removeEventListener('mouseup', this.handleMouseUp);
        this.canvas.removeEventListener('mouseleave', this.handleMouseUp);
        this.canvas.removeEventListener('touchstart', this.handleTouchStart);
        this.canvas.removeEventListener('touchmove', this.handleTouchMove);
        this.canvas.removeEventListener('touchend', this.handleMouseUp);
    }
}
