/**
 * Utility functions for Rich Foot plugin
 * Color conversion and manipulation
 */

/**
 * Convert HSL to Hex color format
 * @param {number|string} h - Hue (0-360)
 * @param {number|string} s - Saturation (0-100)
 * @param {number|string} l - Lightness (0-100)
 * @returns {string} Hex color string
 */
export function hslToHex(h, s, l) {
    // Evaluate calc expressions if present
    const evalCalc = (expr) => {
        if (typeof expr !== 'string') return expr;
        if (expr.includes('calc(')) {
            // Extract the expression inside calc()
            const calcExpr = expr.match(/calc\((.*?)\)/)[1];
            // Basic evaluation of simple math expressions
            return Function(`'use strict'; return (${calcExpr})`)();
        }
        return parseFloat(expr);
    };

    h = evalCalc(h);
    s = evalCalc(s);
    l = evalCalc(l);

    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Convert RGB/RGBA to Hex color format
 * @param {string} color - RGB or RGBA color string
 * @returns {string} Hex color string
 */
export function rgbToHex(color) {
    // For HSLA colors, create a temporary div to convert to RGB
    if (color.startsWith('hsl')) {
        const temp = document.createElement('div');
        temp.style.color = color;
        document.body.appendChild(temp);
        color = getComputedStyle(temp).color;
        document.body.removeChild(temp);
    }

    // Extract RGB values, handling both RGB and RGBA
    const rgb = color.match(/\d+/g);
    if (!rgb || rgb.length < 3) return '#000000';

    // Take only the first 3 values (RGB) and ensure they're valid hex values
    const [r, g, b] = rgb.slice(0, 3).map(x => {
        // Ensure value is between 0-255
        const val = Math.min(255, Math.max(0, Math.round(parseFloat(x))));
        return val.toString(16).padStart(2, '0');
    });

    return `#${r}${g}${b}`;
}

/**
 * Blend RGBA color with background RGB
 * @param {string} rgba - RGBA color string
 * @param {string} backgroundRgb - RGB color string
 * @returns {string|null} Blended RGB color string or null if invalid
 */
export function blendRgbaWithBackground(rgba, backgroundRgb) {
    // Extract foreground RGBA values
    const rgbaMatch = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+),\s*(\d*\.?\d+)\)/);
    if (!rgbaMatch) return null;

    const [, fr, fg, fb, fa] = rgbaMatch.map(Number);
    const alpha = fa !== undefined ? fa : 1;

    // Extract background RGB values
    const rgbMatch = backgroundRgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!rgbMatch) return null;

    const [, br, bg, bb] = rgbMatch.map(Number);

    // Blend each channel using the formula: result = fg * alpha + bg * (1 - alpha)
    const r = Math.round(fr * alpha + br * (1 - alpha));
    const g = Math.round(fg * alpha + bg * (1 - alpha));
    const b = Math.round(fb * alpha + bb * (1 - alpha));

    return `rgb(${r}, ${g}, ${b})`;
}
