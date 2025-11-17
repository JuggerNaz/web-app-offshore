import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getStoragePublicUrl,
  isCompleteUrl,
  extractFilename,
  processAttachmentUrl,
  truncateText,
} from "./storage";

describe("Storage Utilities", () => {
  beforeEach(() => {
    // Mock environment variable
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  });

  describe("getStoragePublicUrl", () => {
    it("should generate correct public URL", () => {
      const url = getStoragePublicUrl("attachments", "test/file.pdf");
      expect(url).toBe(
        "https://test.supabase.co/storage/v1/object/public/attachments/test/file.pdf"
      );
    });

    it("should return empty string for missing path", () => {
      const url = getStoragePublicUrl("attachments", "");
      expect(url).toBe("");
    });

    it("should return empty string for missing URL", () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      const url = getStoragePublicUrl("attachments", "file.pdf");
      expect(url).toBe("");
    });
  });

  describe("isCompleteUrl", () => {
    it("should return true for http URLs", () => {
      expect(isCompleteUrl("http://example.com")).toBe(true);
    });

    it("should return true for https URLs", () => {
      expect(isCompleteUrl("https://example.com")).toBe(true);
    });

    it("should return false for relative paths", () => {
      expect(isCompleteUrl("uploads/file.pdf")).toBe(false);
    });
  });

  describe("extractFilename", () => {
    it("should extract filename from path", () => {
      expect(extractFilename("uploads/test/file.pdf")).toBe("file.pdf");
    });

    it("should extract filename from URL", () => {
      expect(extractFilename("https://example.com/path/to/file.pdf")).toBe("file.pdf");
    });

    it("should remove query parameters", () => {
      expect(extractFilename("https://example.com/file.pdf?token=abc")).toBe("file.pdf");
    });

    it("should return 'File' for empty string", () => {
      expect(extractFilename("")).toBe("File");
    });
  });

  describe("processAttachmentUrl", () => {
    it("should process attachment with complete URL", () => {
      const attachment = {
        path: "https://example.com/file.pdf",
        name: "Test File",
      };
      const result = processAttachmentUrl(attachment);
      expect(result.fileUrl).toBe("https://example.com/file.pdf");
      expect(result.fileName).toBe("Test File");
    });

    it("should convert relative path to public URL", () => {
      const attachment = {
        path: "uploads/file.pdf",
        name: "Test File",
      };
      const result = processAttachmentUrl(attachment);
      expect(result.fileUrl).toBe(
        "https://test.supabase.co/storage/v1/object/public/attachments/uploads/file.pdf"
      );
    });

    it("should prefer meta.file_url over path", () => {
      const attachment = {
        path: "old-path.pdf",
        name: "Test",
        meta: {
          file_url: "https://example.com/new-path.pdf",
          original_file_name: "Original Name",
        },
      };
      const result = processAttachmentUrl(attachment);
      expect(result.fileUrl).toBe("https://example.com/new-path.pdf");
      expect(result.fileName).toBe("Original Name");
    });
  });

  describe("truncateText", () => {
    it("should truncate long text", () => {
      expect(truncateText("This is a long text", 10)).toBe("This is a ...");
    });

    it("should not truncate short text", () => {
      expect(truncateText("Short", 10)).toBe("Short");
    });

    it("should handle exact length", () => {
      expect(truncateText("Exact", 5)).toBe("Exact");
    });
  });
});
