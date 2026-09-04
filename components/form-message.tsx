export type Message = { success: string } | { error: string } | { message: string };

export async function FormMessage({ message }: { message: Message | Promise<Message> }) {
  const resolvedMessage = await message;
  if (!resolvedMessage) return null;

  let rawError = "error" in resolvedMessage ? String(resolvedMessage.error || "") : "";
  if (rawError === "{}" || rawError === "[object Object]") {
    rawError = "Invalid email or password. Please check your credentials and try again.";
  }

  let rawSuccess = "success" in resolvedMessage ? String(resolvedMessage.success || "") : "";
  let rawInfo = "message" in resolvedMessage ? String(resolvedMessage.message || "") : "";

  return (
    <div className="flex flex-col gap-2 w-full text-sm">
      {rawSuccess && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-4 py-2.5 rounded-xl font-medium">
          {rawSuccess}
        </div>
      )}
      {rawError && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-2.5 rounded-xl font-medium">
          {rawError}
        </div>
      )}
      {rawInfo && (
        <div className="bg-blue-500/10 border border-blue-500/30 text-blue-300 px-4 py-2.5 rounded-xl font-medium">
          {rawInfo}
        </div>
      )}
    </div>
  );
}
