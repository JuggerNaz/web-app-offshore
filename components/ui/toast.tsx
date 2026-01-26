'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
    id: string;
    type: ToastType;
    message: string;
    duration?: number;
}

interface ToastContextType {
    toasts: Toast[];
    showToast: (message: string, type?: ToastType, duration?: number) => void;
    removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const showToast = useCallback((message: string, type: ToastType = 'info', duration?: number) => {
        const id = Date.now().toString();
        const defaultDuration = 3000; // 3 seconds for all types
        const toast: Toast = {
            id,
            type,
            message,
            duration: duration ?? defaultDuration,
        };

        setToasts(prev => [...prev, toast]);

        // Auto-dismiss
        setTimeout(() => {
            removeToast(id);
        }, toast.duration);
    }, [removeToast]);

    return (
        <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
            {children}
            <ToastContainer toasts={toasts} onRemove={removeToast} />
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within ToastProvider');
    }
    return context;
}

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
    return (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md">
            {toasts.map(toast => (
                <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
            ))}
        </div>
    );
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
    const bgColor = {
        success: 'bg-green-600',
        error: 'bg-red-600',
        info: 'bg-blue-600',
    }[toast.type];

    const icon = {
        success: '✓',
        error: '✕',
        info: 'ℹ',
    }[toast.type];

    return (
        <div
            className={`${bgColor} text-white px-4 py-3 rounded-lg shadow-lg flex items-start gap-3 animate-slide-in-right`}
            role="alert"
        >
            <span className="text-xl font-bold">{icon}</span>
            <p className="flex-1 text-sm">{toast.message}</p>
            <button
                onClick={() => onRemove(toast.id)}
                className="text-white hover:text-gray-200 transition-colors"
                aria-label="Close"
            >
                ✕
            </button>
        </div>
    );
}
