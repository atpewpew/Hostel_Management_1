const PDFParser = require('pdf2json');
const fs = require('fs').promises;

// Standard day names in chronological order
const DAYS_OF_WEEK = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday'
];

// Day aliases mapping
const DAY_ALIASES = {
    'sun': 'Sunday',
    'sunday': 'Sunday',
    'mon': 'Monday',
    'monday': 'Monday',
    'tue': 'Tuesday',
    'tues': 'Tuesday',
    'tuesday': 'Tuesday',
    'wed': 'Wednesday',
    'wednesday': 'Wednesday',
    'thu': 'Thursday',
    'thur': 'Thursday',
    'thurs': 'Thursday',
    'thursday': 'Thursday',
    'fri': 'Friday',
    'friday': 'Friday',
    'sat': 'Saturday',
    'saturday': 'Saturday'
};

// Meal types standard list
const MEAL_TYPES = ['Breakfast', 'Lunch', 'Snacks', 'Dinner'];

/**
 * Clean decoded text string
 */
function cleanText(text) {
    if (!text) return '';
    try {
        text = decodeURIComponent(text);
    } catch (e) {
        // keep text as is if decodeURI fails
    }
    return text.replace(/\r/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Identify if a word or phrase matches a Day of the week
 */
function matchDay(str) {
    if (!str) return null;
    const lower = str.toLowerCase().replace(/[^a-z]/g, '');
    if (DAY_ALIASES[lower]) return DAY_ALIASES[lower];
    for (const [alias, standardDay] of Object.entries(DAY_ALIASES)) {
        if (lower === alias || lower.startsWith(alias)) return standardDay;
    }
    return null;
}

/**
 * Strict matcher for DAY headers in tables
 */
function matchDayHeader(str) {
    if (!str || str.split(',').length > 1) return null;
    const trimmed = str.trim();
    if (trimmed.length > 20) return null;
    const words = trimmed.split(/\s+/);
    if (words.length > 2) return null;
    return matchDay(trimmed);
}

/**
 * Strict matcher for MEAL headers in tables
 */
function matchMealHeader(str) {
    if (!str || str.split(',').length > 1) return null;
    const trimmed = str.trim();
    if (trimmed.length > 35) return null;
    const lower = trimmed.toLowerCase();

    if (/breakfast|b\/f|\bbf\b/i.test(lower)) return 'Breakfast';
    if (/lunch/i.test(lower)) return 'Lunch';
    if (/snacks?|hi-tea|high\s*tea|tiffin/i.test(lower)) return 'Snacks';
    if (/dinner|supper/i.test(lower)) return 'Dinner';

    if (/\btea\b/i.test(lower) && trimmed.split(/\s+/).length <= 2 && !/dosa|idli|samosa|bonda|cake|curry|rice/i.test(lower)) {
        return 'Snacks';
    }

    if (/(0?[7-9]:[0-5][0-9]|10:00)\s*(am)?/i.test(lower)) return 'Breakfast';
    if (/(1[2-4]:[0-5][0-9]|0?1:[0-5][0-9]|0?2:[0-5][0-9])\s*(pm)?/i.test(lower)) return 'Lunch';
    if (/(1[6-8]:[0-5][0-9]|0?4:[0-5][0-9]|0?5:[0-5][0-9]|0?6:[0-5][0-9])\s*(pm)?/i.test(lower)) return 'Snacks';
    if (/(19:[0-5][0-9]|2[0-2]:[0-5][0-9]|0?7:[0-5][0-9]|0?8:[0-5][0-9]|0?9:[0-5][0-9])\s*(pm)?/i.test(lower)) return 'Dinner';

    return null;
}

/**
 * Check if text is non-dish metadata (headers, table titles, page noise, instructions, footnotes)
 */
function isNoiseText(str, w = 0) {
    if (!str || str.length < 2) return true;
    const trimmed = str.trim();
    const lower = trimmed.toLowerCase();

    // Spanning width note (across multiple columns in timetable)
    if (w > 200) return true;

    // Header keywords & instructions
    if (/^(day|days|time|timings|timing|menu|mess|timetable|hostel|weekly|monthly|date|sr|no|s\.no)$/i.test(lower)) {
        return true;
    }
    if (/hostel\s+mess\s+weekly/i.test(lower)) return true;

    // Common footnote and instruction patterns
    if (/^note\s*:/i.test(lower)) return true;
    if (/to be provided everyday/i.test(lower)) return true;
    if (/equal quantity without repeating/i.test(lower)) return true;
    if (/quantity of (chicken|paneer)/i.test(lower)) return true;
    if (/cooked weight/i.test(lower)) return true;
    if (/special dinner/i.test(lower)) return true;
    if (/starters\s*:/i.test(lower)) return true;
    if (/main course\s*:/i.test(lower)) return true;
    if (/monthly once/i.test(lower)) return true;
    if (/rs\s*:\s*\d+/i.test(lower)) return true;

    // Category row labels in multi-category timetable menus
    const categoryLabels = [
        'regular items', 'accompaniments', 'sprouts', 'sides', 'curry item',
        'dal item', 'dry item', 'sambar/rasam/pulusu', 'sambar/rasam', 'drink',
        'snack items', 'fruits', 'sweets/ice-cream', 'sweets', 'salad', 'roti/chapati'
    ];
    if (categoryLabels.includes(lower)) return true;

    return false;
}

/**
 * Clean individual dish string
 */
function cleanDish(str) {
    if (!str) return '';
    return str
        .replace(/^[\s,;+•*-]+|[\s,;+•*-]+$/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Split comma, newline, slash separated food list into distinct dish strings
 */
function splitIntoDishes(str) {
    if (!str) return [];
    return str
        .split(/[,;\n\r•\*]+|\s\+\s/)
        .map(cleanDish)
        .filter(s => s.length >= 2 && !/^(and|with|or)$/i.test(s));
}

/**
 * Parse PDF from buffer or file path
 * @param {Buffer|string} input - PDF buffer or file path
 * @returns {Promise<{items: Array, summary: Object}>}
 */
async function parsePdfMenu(input) {
    return new Promise((resolve, reject) => {
        const pdfParser = new PDFParser();

        pdfParser.on("pdfParser_dataError", errData => {
            reject(new Error(errData.parserError || "Failed to parse PDF"));
        });

        pdfParser.on("pdfParser_dataReady", pdfData => {
            try {
                const result = extractMenuFromPdfData(pdfData);
                resolve(result);
            } catch (err) {
                reject(err);
            }
        });

        if (Buffer.isBuffer(input)) {
            pdfParser.parseBuffer(input);
        } else if (typeof input === 'string') {
            pdfParser.loadPDF(input);
        } else {
            reject(new Error("Invalid PDF input: expected Buffer or file path string"));
        }
    });
}

/**
 * Main extraction algorithm from pdf2json structure
 */
function extractMenuFromPdfData(pdfData) {
    const pages = pdfData.Pages || [];
    if (pages.length === 0) {
        return { items: [], summary: { total: 0, daysFound: [], mealsFound: [] } };
    }

    // Accumulate all text elements across pages
    const allTexts = [];
    pages.forEach((page, pageIdx) => {
        const texts = page.Texts || [];
        texts.forEach(t => {
            const rawT = (t.R && t.R[0] && t.R[0].T) ? t.R[0].T : '';
            const cleaned = cleanText(rawT);
            if (cleaned) {
                allTexts.push({
                    text: cleaned,
                    x: t.x,
                    y: t.y + (pageIdx * 100), // Offset multi-page Y coordinates
                    w: t.w || 0,
                    page: pageIdx
                });
            }
        });
    });

    // 1. Try Grid / Coordinate Extraction
    const gridResult = extractFromGrid(allTexts);
    if (gridResult && gridResult.items && gridResult.items.length >= 7) {
        return formatExtractionResult(gridResult.items);
    }

    // 2. Fallback: Sequential line-by-line / text-block extraction
    const fallbackResult = extractFromSequentialText(allTexts);
    if (fallbackResult && fallbackResult.items && fallbackResult.items.length > 0) {
        return formatExtractionResult(fallbackResult.items);
    }

    if (gridResult && gridResult.items && gridResult.items.length > 0) {
        return formatExtractionResult(gridResult.items);
    }

    return { items: [], summary: { total: 0, daysFound: [], mealsFound: [] } };
}

/**
 * Coordinate / Grid-based extractor
 */
function extractFromGrid(allTexts) {
    // Collect day and meal labels
    const dayLabels = [];
    const mealLabels = [];

    allTexts.forEach(item => {
        const d = matchDayHeader(item.text);
        if (d && !dayLabels.some(l => l.day === d && Math.abs(l.x - item.x) < 1 && Math.abs(l.y - item.y) < 1)) {
            dayLabels.push({ ...item, day: d });
        }

        const m = matchMealHeader(item.text);
        if (m && !d && !mealLabels.some(l => l.meal === m && Math.abs(l.x - item.x) < 1 && Math.abs(l.y - item.y) < 1)) {
            mealLabels.push({ ...item, meal: m });
        }
    });

    if (dayLabels.length === 0 && mealLabels.length === 0) {
        return { items: [] };
    }

    const dayXs = dayLabels.map(l => l.x);
    const dayYs = dayLabels.map(l => l.y);
    const mealXs = mealLabels.map(l => l.x);
    const mealYs = mealLabels.map(l => l.y);

    const dayXSpread = dayXs.length > 1 ? Math.max(...dayXs) - Math.min(...dayXs) : 0;
    const dayYSpread = dayYs.length > 1 ? Math.max(...dayYs) - Math.min(...dayYs) : 0;
    const mealXSpread = mealXs.length > 1 ? Math.max(...mealXs) - Math.min(...mealXs) : 0;
    const mealYSpread = mealYs.length > 1 ? Math.max(...mealYs) - Math.min(...mealYs) : 0;

    // Determine Orientation:
    // Mode A: Days as Columns (X), Meals as Rows/Sections (Y)
    // Mode B: Meals as Columns (X), Days as Rows/Sections (Y)
    let isDaysAsColumns = false;
    if (dayXSpread > 15 && dayYSpread < 3) {
        isDaysAsColumns = true;
    } else if (mealXSpread > 15 && mealYSpread < 3) {
        isDaysAsColumns = false;
    } else if (dayXSpread > dayYSpread) {
        isDaysAsColumns = true;
    } else {
        isDaysAsColumns = false;
    }

    const cells = {};
    DAYS_OF_WEEK.forEach(d => {
        cells[d] = {};
        MEAL_TYPES.forEach(m => {
            cells[d][m] = [];
        });
    });

    // Handle Mode A: Days As Columns
    if (isDaysAsColumns) {
        const dayCols = [];
        dayLabels.forEach(l => {
            if (!dayCols.some(c => c.day === l.day)) {
                dayCols.push({ day: l.day, x: l.x, y: l.y });
            }
        });
        dayCols.sort((a, b) => a.x - b.x);

        const minDayX = Math.min(...dayCols.map(c => c.x));
        const leftMargin = minDayX - 1.5;
        const topHeaderY = Math.min(...dayCols.map(c => c.y));

        // Find meal row markers in left column (x < leftMargin)
        const mealMarkers = {};
        mealLabels.forEach(l => {
            if (l.x < leftMargin + 2.0 && !mealMarkers[l.meal]) {
                mealMarkers[l.meal] = l.y;
            }
        });

        // Determine vertical meal bands
        const yB = mealMarkers['Breakfast'] || (topHeaderY + 2.0);
        const yL = mealMarkers['Lunch'] || (yB + 5.0);
        const yS = mealMarkers['Snacks'] || (yL + 4.0);
        const yD = mealMarkers['Dinner'] || (yS + 4.0);

        // Calculate transitions
        const bBreakfastStart = topHeaderY + 0.3;
        const bLunchStart = (yB + yL) / 2;
        const bSnacksStart = (yL + yS) / 2;
        const bDinnerStart = (yS + yD) / 2;
        const bDinnerEnd = yD + (yD - yS);

        allTexts.forEach(item => {
            if (item.x < leftMargin) return; // Left column header
            if (item.y < bBreakfastStart || item.y >= bDinnerEnd) return; // Outside table
            if (isNoiseText(item.text, item.w)) return;

            // Match day column
            let matchedDay = null;
            let minDiff = 999;
            dayCols.forEach(col => {
                const diff = Math.abs(col.x - item.x);
                if (diff < 2.5 && diff < minDiff) {
                    minDiff = diff;
                    matchedDay = col.day;
                }
            });
            if (!matchedDay) return;

            // Match meal band
            let matchedMeal = null;
            if (item.y >= bBreakfastStart && item.y < bLunchStart) matchedMeal = 'Breakfast';
            else if (item.y >= bLunchStart && item.y < bSnacksStart) matchedMeal = 'Lunch';
            else if (item.y >= bSnacksStart && item.y < bDinnerStart) matchedMeal = 'Snacks';
            else if (item.y >= bDinnerStart && item.y < bDinnerEnd) matchedMeal = 'Dinner';

            if (!matchedMeal) return;

            const dishes = splitIntoDishes(item.text);
            dishes.forEach(d => {
                if (!isNoiseText(d, 0)) {
                    cells[matchedDay][matchedMeal].push(d);
                }
            });
        });

    } else {
        // Handle Mode B: Meals As Columns, Days As Rows
        const cols = cluster1D(mealLabels, 'x', 2.0).map(cluster => ({
            type: 'meal',
            value: cluster.items[0].meal,
            x: cluster.center
        })).sort((a, b) => a.x - b.x);

        const rows = cluster1D(dayLabels, 'y', 0.8).map(cluster => ({
            type: 'day',
            value: cluster.items[0].day,
            y: cluster.center
        })).sort((a, b) => a.y - b.y);

        const minTableY = Math.min(
            ...rows.map(r => r.y),
            ...mealLabels.map(l => l.y),
            ...dayLabels.map(l => l.y)
        );

        const colIntervals = calculateIntervals(cols, 'x');
        const rowIntervals = calculateIntervals(rows, 'y');

        allTexts.forEach(item => {
            if (item.y < minTableY - 1.0) return;
            if (dayLabels.some(l => l.text === item.text && Math.abs(l.x - item.x) < 0.5 && Math.abs(l.y - item.y) < 0.5)) return;
            if (mealLabels.some(l => l.text === item.text && Math.abs(l.x - item.x) < 0.5 && Math.abs(l.y - item.y) < 0.5)) return;
            if (isNoiseText(item.text, item.w)) return;

            const matchedCol = findMatchingInterval(colIntervals, item.x);
            const matchedRow = findMatchingInterval(rowIntervals, item.y);

            if (matchedCol && matchedRow) {
                const day = matchedRow.value;
                const meal = matchedCol.value;
                if (cells[day] && cells[day][meal]) {
                    const dishes = splitIntoDishes(item.text);
                    dishes.forEach(d => {
                        if (!isNoiseText(d, 0)) {
                            cells[day][meal].push(d);
                        }
                    });
                }
            }
        });
    }

    // Flatten into item objects
    const items = [];
    for (const day of DAYS_OF_WEEK) {
        for (const meal of MEAL_TYPES) {
            const lines = cells[day][meal];
            lines.forEach(dish => {
                items.push({
                    day,
                    mealType: meal,
                    name: dish,
                    alternateWeek: false,
                    seasonal: false
                });
            });
        }
    }

    return { items };
}

/**
 * Fallback: sequential text parser
 */
function extractFromSequentialText(allTexts) {
    const sorted = [...allTexts].sort((a, b) => {
        if (Math.abs(a.y - b.y) > 1.0) return a.y - b.y;
        return a.x - b.x;
    });

    let currentDay = null;
    let currentMeal = null;
    const items = [];

    sorted.forEach(t => {
        const d = matchDayHeader(t.text);
        const m = matchMealHeader(t.text);

        if (d) {
            currentDay = d;
            return;
        }
        if (m) {
            currentMeal = m;
            return;
        }

        if (isNoiseText(t.text, t.w)) return;

        if (currentDay && currentMeal && t.text) {
            if (/^\d{1,2}[:.]\d{2}/.test(t.text)) return;
            if (/^(am|pm|timing|time|hostel|mess|menu|week)/i.test(t.text)) return;

            const dishes = splitIntoDishes(t.text);
            dishes.forEach(dish => {
                if (!isNoiseText(dish, 0)) {
                    items.push({
                        day: currentDay,
                        mealType: currentMeal,
                        name: dish,
                        alternateWeek: false,
                        seasonal: false
                    });
                }
            });
        }
    });

    return { items };
}

/**
 * 1D Clustering helper for coordinates
 */
function cluster1D(items, key, tolerance = 1.0) {
    if (!items || items.length === 0) return [];
    const sorted = [...items].sort((a, b) => a[key] - b[key]);
    const clusters = [];

    sorted.forEach(item => {
        let added = false;
        for (const cluster of clusters) {
            if (Math.abs(cluster.center - item[key]) <= tolerance) {
                cluster.items.push(item);
                cluster.center = cluster.items.reduce((sum, i) => sum + i[key], 0) / cluster.items.length;
                added = true;
                break;
            }
        }
        if (!added) {
            clusters.push({
                center: item[key],
                items: [item]
            });
        }
    });

    return clusters;
}

/**
 * Calculate boundary intervals between sorted grid centers
 */
function calculateIntervals(clusters, key) {
    if (clusters.length === 0) return [];
    const intervals = [];

    for (let i = 0; i < clusters.length; i++) {
        const curr = clusters[i];

        if (i === 0) {
            const next = clusters[i + 1];
            const span = next ? (next[key] - curr[key]) / 2 : 5;
            intervals.push({ ...curr, min: curr[key] - span, max: curr[key] + span });
        } else if (i === clusters.length - 1) {
            const prev = clusters[i - 1];
            const span = (curr[key] - prev[key]) / 2;
            intervals.push({ ...curr, min: curr[key] - span, max: curr[key] + span });
        } else {
            const prev = clusters[i - 1];
            const next = clusters[i + 1];
            intervals.push({
                ...curr,
                min: curr[key] - (curr[key] - prev[key]) / 2,
                max: curr[key] + (next[key] - curr[key]) / 2
            });
        }
    }

    return intervals;
}

/**
 * Match a position to an interval
 */
function findMatchingInterval(intervals, val) {
    for (const int of intervals) {
        if (val >= int.min && val <= int.max) {
            return int;
        }
    }
    if (intervals.length > 0) {
        if (val < intervals[0].min && Math.abs(val - intervals[0].min) < 3) return intervals[0];
        const last = intervals[intervals.length - 1];
        if (val > last.max && Math.abs(val - last.max) < 3) return last;
    }
    return null;
}

/**
 * Format and aggregate final results
 */
function formatExtractionResult(items) {
    const seen = new Set();
    const uniqueItems = [];

    items.forEach(it => {
        const key = `${it.day}-${it.mealType}-${it.name.toLowerCase()}`;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueItems.push(it);
        }
    });

    const daysFound = [...new Set(uniqueItems.map(i => i.day))];
    const mealsFound = [...new Set(uniqueItems.map(i => i.mealType))];

    return {
        items: uniqueItems,
        summary: {
            total: uniqueItems.length,
            daysFound,
            mealsFound,
            hasAllDays: DAYS_OF_WEEK.every(d => daysFound.includes(d)),
            hasAllMeals: MEAL_TYPES.every(m => mealsFound.includes(m))
        }
    };
}

module.exports = {
    parsePdfMenu,
    matchDay,
    matchDayHeader,
    matchMealHeader,
    splitIntoDishes,
    DAYS_OF_WEEK,
    MEAL_TYPES
};
