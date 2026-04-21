
import { create } from 'zustand';
import { Attachment } from '@/components/data-table/columns';

export interface AttachmentFilters {
    searchQuery: string;
    fileType: string | null;
    hasAttachmentsOnly?: boolean; // Added for Tree View
}

export interface AttachmentStore {
    // Filter State
    filters: AttachmentFilters;
    setSearchQuery: (query: string) => void;
    setFileTypeFilter: (type: string | null) => void;
    setHasAttachmentsOnly: (enabled: boolean) => void; // Added for Tree View
    clearAllFilters: () => void;

    // Selection State
    selectedItems: Set<number>;
    toggleSelection: (id: number) => void;
    toggleAllSelection: (ids: number[]) => void;
    clearSelection: () => void;

    // UI State
    isSlideOverOpen: boolean;
    activeAttachment: Attachment | null;
    openSlideOver: (attachment: Attachment | null) => void; // null for add new? or specific add mode
    closeSlideOver: () => void;

    // Tree View State
    selectedPlatformId: number | null;
    setSelectedPlatformId: (id: number | null) => void;

    // Actions
    isDeleting: boolean;
    deleteAttachments: (ids: number[]) => Promise<void>;
}

export const useAttachmentStore = create<AttachmentStore>((set) => ({
    // Filter State
    filters: {
        searchQuery: '',
        fileType: null,
        hasAttachmentsOnly: true,
    },
    setSearchQuery: (query: string) => set((state: AttachmentStore) => ({ filters: { ...state.filters, searchQuery: query } })),
    setFileTypeFilter: (type: string | null) => set((state: AttachmentStore) => ({ filters: { ...state.filters, fileType: type } })),
    setHasAttachmentsOnly: (enabled: boolean) => set((state: AttachmentStore) => ({ filters: { ...state.filters, hasAttachmentsOnly: enabled } })),
    clearAllFilters: () => set({
        filters: {
            searchQuery: '',
            fileType: null,
            hasAttachmentsOnly: true,
        }
    }),

    // Selection State
    selectedItems: new Set(),
    toggleSelection: (id: number) => set((state: AttachmentStore) => {
        const newSelection = new Set(state.selectedItems);
        if (newSelection.has(id)) {
            newSelection.delete(id);
        } else {
            newSelection.add(id);
        }
        return { selectedItems: newSelection };
    }),
    toggleAllSelection: (ids: number[]) => set((state: AttachmentStore) => {
        const allSelected = ids.every((id: number) => state.selectedItems.has(id));
        const newSelection = new Set(state.selectedItems);

        if (allSelected) {
            ids.forEach((id: number) => newSelection.delete(id));
        } else {
            ids.forEach((id: number) => newSelection.add(id));
        }
        return { selectedItems: newSelection };
    }),
    clearSelection: () => set({ selectedItems: new Set() }),

    // UI State
    isSlideOverOpen: false,
    activeAttachment: null,
    openSlideOver: (attachment: Attachment | null) => set({ isSlideOverOpen: true, activeAttachment: attachment }),
    closeSlideOver: () => set({ isSlideOverOpen: false, activeAttachment: null }),

    // Tree View State
    selectedPlatformId: null,
    setSelectedPlatformId: (id: number | null) => set({ selectedPlatformId: id }),

    // Actions
    isDeleting: false,
    deleteAttachments: async (ids: number[]) => {
        set({ isDeleting: true });
        try {
            const { fetcher } = await import("@/utils/utils");
            const { mutate } = await import("swr");
            const { toast } = await import("sonner");

            await Promise.all(ids.map((id: number) => fetcher(`/api/attachment/${id}`, { method: 'DELETE' })));

            toast.success(`Successfully deleted ${ids.length} attachments`);
            set({ selectedItems: new Set() });
            mutate('/api/attachment');
        } catch (error) {
            console.error("Failed to delete attachments", error);
            const { toast } = await import("sonner");
            toast.error("Failed to delete some attachments");
        } finally {
            set({ isDeleting: false });
        }
    }
}));
