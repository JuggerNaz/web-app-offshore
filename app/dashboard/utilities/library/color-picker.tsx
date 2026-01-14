"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ColorPickerProps {
    onColorChange: (rgb: string, colorName: string) => void;
    initialColor?: string;
    initialName?: string;
}

// Common color names mapped to RGB values
const COLOR_NAMES: Record<string, string> = {
    "255,0,0": "Red",
    "0,255,0": "Green",
    "0,0,255": "Blue",
    "255,255,0": "Yellow",
    "255,0,255": "Magenta",
    "0,255,255": "Cyan",
    "255,255,255": "White",
    "0,0,0": "Black",
    "128,128,128": "Gray",
    "255,165,0": "Orange",
    "128,0,128": "Purple",
    "165,42,42": "Brown",
    "255,192,203": "Pink",
    "0,128,0": "Dark Green",
    "0,0,128": "Navy",
    "128,0,0": "Maroon",
    "192,192,192": "Silver",
    "255,215,0": "Gold",
};

// Reverse mapping: Color name to RGB
const NAME_TO_RGB: Record<string, string> = {
    "Red": "255,0,0",
    "Green": "0,255,0",
    "Blue": "0,0,255",
    "Yellow": "255,255,0",
    "Orange": "255,165,0",
    "Purple": "128,0,128",
    "Pink": "255,192,203",
    "Brown": "165,42,42",
    "Black": "0,0,0",
    "White": "255,255,255",
    "Gray": "128,128,128",
    "Silver": "192,192,192",
    "Gold": "255,215,0",
    "Cyan": "0,255,255",
    "Magenta": "255,0,255",
    "Dark Red": "139,0,0",
    "Dark Green": "0,100,0",
    "Dark Blue": "0,0,139",
    "Light Red": "255,182,193",
    "Light Green": "144,238,144",
    "Light Blue": "173,216,230",
    "Navy": "0,0,128",
    "Maroon": "128,0,0",
};

// Convert RGB string to hex
function rgbToHex(rgb: string): string {
    const parts = rgb.split(',').map(p => parseInt(p.trim()));
    if (parts.length !== 3) return "#000000";
    return "#" + parts.map(p => {
        const hex = p.toString(16);
        return hex.length === 1 ? "0" + hex : hex;
    }).join('');
}

// Convert hex to RGB string
function hexToRgb(hex: string): string {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return "0,0,0";
    return `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}`;
}

// Find closest color name
function getColorName(rgb: string): string {
    // Check if exact match exists
    if (COLOR_NAMES[rgb]) {
        return COLOR_NAMES[rgb];
    }

    // Find closest color by calculating distance
    const [r, g, b] = rgb.split(',').map(p => parseInt(p.trim()));
    let minDistance = Infinity;
    let closestName = "Custom Color";

    for (const [knownRgb, name] of Object.entries(COLOR_NAMES)) {
        const [kr, kg, kb] = knownRgb.split(',').map(p => parseInt(p.trim()));
        const distance = Math.sqrt(
            Math.pow(r - kr, 2) +
            Math.pow(g - kg, 2) +
            Math.pow(b - kb, 2)
        );

        if (distance < minDistance) {
            minDistance = distance;
            closestName = name;
        }
    }

    // If very close to a known color (within 30 units), use that name
    return minDistance < 30 ? closestName : "Custom Color";
}

export function ColorPicker({ onColorChange, initialColor, initialName }: ColorPickerProps) {
    const [hexColor, setHexColor] = useState(initialColor ? rgbToHex(initialColor) : "#000000");
    const [rgbColor, setRgbColor] = useState(initialColor || "0,0,0");
    const [colorName, setColorName] = useState(initialName || "Black");

    useEffect(() => {
        if (initialColor) {
            setHexColor(rgbToHex(initialColor));
            setRgbColor(initialColor);
            setColorName(initialName || getColorName(initialColor));
        }
    }, [initialColor, initialName]);

    const handleColorChange = (hex: string) => {
        setHexColor(hex);
        const rgb = hexToRgb(hex);
        setRgbColor(rgb);
        const name = getColorName(rgb);
        setColorName(name);
        onColorChange(rgb, name);
    };

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>Pick a Color</Label>
                <div className="flex gap-3 items-center">
                    <input
                        type="color"
                        value={hexColor}
                        onChange={(e) => handleColorChange(e.target.value)}
                        className="h-12 w-20 rounded border border-slate-300 cursor-pointer"
                    />
                    <div className="flex-1">
                        <Input
                            value={hexColor}
                            onChange={(e) => handleColorChange(e.target.value)}
                            placeholder="#000000"
                            className="font-mono"
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                    <Label>RGB Value (lib_id)</Label>
                    <Input
                        value={rgbColor}
                        readOnly
                        className="bg-slate-100 dark:bg-slate-900 font-mono"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="color_name">Color Name (lib_desc)</Label>
                    <div className="relative">
                        <select
                            id="color_name_select"
                            value={colorName}
                            onChange={(e) => {
                                const value = e.target.value;
                                setColorName(value);

                                // If it's a predefined color, update RGB and hex too
                                if (NAME_TO_RGB[value]) {
                                    const newRgb = NAME_TO_RGB[value];
                                    const newHex = rgbToHex(newRgb);
                                    setRgbColor(newRgb);
                                    setHexColor(newHex);
                                    onColorChange(newRgb, value);
                                } else {
                                    onColorChange(rgbColor, value);
                                }
                            }}
                            className="w-full h-10 px-3 py-2 text-sm rounded-md border border-input bg-background ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                            <option value="">-- Select or type custom --</option>
                            <optgroup label="Common Colors">
                                <option value="Red">Red</option>
                                <option value="Green">Green</option>
                                <option value="Blue">Blue</option>
                                <option value="Yellow">Yellow</option>
                                <option value="Orange">Orange</option>
                                <option value="Purple">Purple</option>
                                <option value="Pink">Pink</option>
                                <option value="Brown">Brown</option>
                                <option value="Black">Black</option>
                                <option value="White">White</option>
                                <option value="Gray">Gray</option>
                                <option value="Silver">Silver</option>
                                <option value="Gold">Gold</option>
                                <option value="Cyan">Cyan</option>
                                <option value="Magenta">Magenta</option>
                            </optgroup>
                            <optgroup label="Shades">
                                <option value="Dark Red">Dark Red</option>
                                <option value="Dark Green">Dark Green</option>
                                <option value="Dark Blue">Dark Blue</option>
                                <option value="Light Red">Light Red</option>
                                <option value="Light Green">Light Green</option>
                                <option value="Light Blue">Light Blue</option>
                                <option value="Navy">Navy</option>
                                <option value="Maroon">Maroon</option>
                            </optgroup>
                        </select>
                    </div>
                    <Input
                        value={colorName}
                        onChange={(e) => {
                            setColorName(e.target.value);
                            onColorChange(rgbColor, e.target.value);
                        }}
                        placeholder="Or type custom name..."
                        className="mt-2"
                    />
                </div>
            </div>

            <div className="p-4 rounded border" style={{ backgroundColor: hexColor }}>
                <p className="text-center font-semibold" style={{
                    color: parseInt(hexColor.slice(1, 3), 16) +
                        parseInt(hexColor.slice(3, 5), 16) +
                        parseInt(hexColor.slice(5, 7), 16) > 382 ? '#000' : '#fff'
                }}>
                    Preview: {colorName}
                </p>
            </div>
        </div>
    );
}
