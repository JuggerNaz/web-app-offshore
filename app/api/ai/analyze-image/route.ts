
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const { image, prompt } = await req.json();

        if (!image) {
            return NextResponse.json({ error: "No image provided" }, { status: 400 });
        }

        // 1. Check for Google Gemini Key (Preferred Free Option)
        if (process.env.GOOGLE_API_KEY) {
            return await analyzeWithGemini(image, prompt, process.env.GOOGLE_API_KEY);
        }

        // 2. Check for OpenAI Key
        if (process.env.OPENAI_API_KEY) {
            return await analyzeWithOpenAI(image, prompt, process.env.OPENAI_API_KEY);
        }

        return NextResponse.json({
            text: "AI Configuration Missing. Please add GOOGLE_API_KEY or OPENAI_API_KEY to .env.local"
        });

    } catch (error) {
        console.error("AI Handler Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

// --- Google Gemini Implementation (REST API) ---
async function analyzeWithGemini(base64Image: string, prompt: string, apiKey: string) {
    try {
        // Extract base64 data only (remove "data:image/jpeg;base64," prefix)
        const base64Data = base64Image.split(",")[1] || base64Image;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

        const payload = {
            contents: [{
                parts: [
                    { text: prompt || "Analyze this image." },
                    { inline_data: { mime_type: "image/jpeg", data: base64Data } }
                ]
            }]
        };

        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const err = await response.text();
            console.error("Gemini API Error:", err);
            return NextResponse.json({ text: "Error calling Gemini API" }, { status: 500 });
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "No insights found.";

        return NextResponse.json({ text: text });

    } catch (e) {
        console.error("Gemini Wrapper Error:", e);
        return NextResponse.json({ text: "Failed to analyze with Gemini" }, { status: 500 });
    }
}

// --- OpenAI Implementation ---
async function analyzeWithOpenAI(image: string, prompt: string, apiKey: string) {
    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [
                    {
                        role: "system",
                        content: "You are an expert offshore inspection engineer. Provide technical, concise findings."
                    },
                    {
                        role: "user",
                        content: [
                            { type: "text", text: prompt || "Analyze this image." },
                            { type: "image_url", image_url: { url: image } }
                        ]
                    }
                ],
                max_tokens: 150
            })
        });

        if (!response.ok) return NextResponse.json({ text: "OpenAI API Error" }, { status: 500 });

        const data = await response.json();
        return NextResponse.json({ text: data.choices[0]?.message?.content || "No content." });

    } catch (e) {
        return NextResponse.json({ text: "Failed to analyze with OpenAI" }, { status: 500 });
    }
}
