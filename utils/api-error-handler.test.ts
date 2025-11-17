import { describe, it, expect, vi } from "vitest";
import { handleSupabaseError, ApiError, handleApiError } from "./api-error-handler";

// Mock console.error
vi.spyOn(console, "error").mockImplementation(() => {});

describe("API Error Handler", () => {
  describe("handleSupabaseError", () => {
    it("should handle PGRST116 error (Not Found)", async () => {
      const error = {
        code: "PGRST116",
        message: "Resource not found",
      };

      const response = handleSupabaseError(error, "Default message");
      const json = await response.json();

      expect(response.status).toBe(404);
      expect(json).toEqual({
        success: false,
        error: "Resource not found",
        code: "PGRST116",
      });
    });

    it("should handle 22P02 error (Bad Request)", async () => {
      const error = {
        code: "22P02",
        message: "Invalid input",
      };

      const response = handleSupabaseError(error, "Default message");
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toBe("Invalid input");
    });

    it("should use default message for unknown error codes", async () => {
      const error = {
        code: "UNKNOWN",
        message: "",
      };

      const response = handleSupabaseError(error, "Default message");
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.error).toBe("Default message");
    });

    it("should handle errors without codes", async () => {
      const error = {
        message: "Something went wrong",
      };

      const response = handleSupabaseError(error, "Default message");
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.error).toBe("Something went wrong");
    });
  });

  describe("ApiError", () => {
    it("should create ApiError with default status", () => {
      const error = new ApiError("Test error");
      expect(error.message).toBe("Test error");
      expect(error.statusCode).toBe(500);
      expect(error.name).toBe("ApiError");
    });

    it("should create ApiError with custom status and code", () => {
      const error = new ApiError("Not found", 404, "NOT_FOUND");
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe("NOT_FOUND");
    });
  });

  describe("handleApiError", () => {
    it("should handle ApiError correctly", async () => {
      const error = new ApiError("Unauthorized", 401, "UNAUTHORIZED");
      const response = handleApiError(error);
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json).toEqual({
        success: false,
        error: "Unauthorized",
        code: "UNAUTHORIZED",
      });
    });
  });
});
