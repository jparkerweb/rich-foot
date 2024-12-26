// ------------------------
// -- convert HSL to Hex --
// ------------------------
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


// -----------------------------
// -- convert RGB/RGBA to hex --
// -----------------------------
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


// -----------------------------
// -- blendRgbaWithBackground --
// -----------------------------
export function blendRgbaWithBackground(rgba, backgroundRgb) {
    // Extract foreground RGBA values
    const rgbaMatch = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+),\s*(\d*\.?\d+)\)/);
    if (!rgbaMatch) return null;

    const [ , fr, fg, fb, fa] = rgbaMatch.map(Number); // Parse to numbers
    const alpha = fa !== undefined ? fa : 1; // Default alpha to 1 if not provided
    
    // Extract background RGB values
    const rgbMatch = backgroundRgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!rgbMatch) return null;

    const [ , br, bg, bb] = rgbMatch.map(Number); // Parse to numbers

    // Blend each channel using the formula: result = fg * alpha + bg * (1 - alpha)
    const r = Math.round(fr * alpha + br * (1 - alpha));
    const g = Math.round(fg * alpha + bg * (1 - alpha));
    const b = Math.round(fb * alpha + bb * (1 - alpha));

    // Return the blended color as an RGB string
    return `rgb(${r}, ${g}, ${b})`;
}


// ------------------
// -- format dates --
// ------------------
export function formatDate(date, format) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = d.getMonth();
    const day = d.getDate();
    const weekday = d.getDay();
    
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthsShort = months.map(m => m.slice(0, 3));
    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const weekdaysShort = weekdays.map(w => w.slice(0, 3));

    // Helper to pad numbers
    const pad = (num) => num.toString().padStart(2, '0');

    // Create a map of tokens to their values
    const tokens = {
        'dddd': weekdays[weekday],
        'ddd': weekdaysShort[weekday],
        'dd': pad(day),
        'd': day.toString(),
        'mmmm': months[month],
        'mmm': monthsShort[month],
        'mm': pad(month + 1),
        'm': (month + 1).toString(),
        'yyyy': year.toString(),
        'yy': year.toString().slice(-2)
    };

    // Sort tokens by length (longest first) to avoid partial matches
    const sortedTokens = Object.keys(tokens).sort((a, b) => b.length - a.length);

    // Replace each token with a unique placeholder
    let result = format.toLowerCase(); // Make case-insensitive
    const replacements = new Map();
    
    sortedTokens.forEach((token, index) => {
        const placeholder = `__${index}__`;
        replacements.set(placeholder, tokens[token]);
        result = result.replace(new RegExp(token, 'gi'), placeholder);
    });

    // Replace placeholders with final values
    replacements.forEach((value, placeholder) => {
        result = result.replace(new RegExp(placeholder, 'g'), value);
    });

    return result;
}