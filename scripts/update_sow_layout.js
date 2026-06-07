const fs = require('fs');
const filePath = 'c:/Users/nq352/Documents/GitHub/web-app-offshore/components/jobpack/sow-dialog.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Change p-8 gap-8 to p-3 gap-3
content = content.replace(
    '<div className="flex-1 flex flex-col overflow-hidden p-8 gap-8">',
    '<div className="flex-1 flex flex-col overflow-hidden p-3 gap-3">'
);

// 2. Change the large horizontal stats panels to compact horizontal bars
// We'll replace the existing maps. 
// Existing: className={`flex-1 min-w-0 ${stat.bg} px-2 py-2 rounded-xl border ${stat.border} flex flex-col justify-center items-center h-full relative cursor-pointer
const statsRegex = /className={`flex-1 min-w-0 \${stat\.bg} px-2 py-2 rounded-xl border \${stat\.border} flex flex-col justify-center items-center h-full relative/g;
content = content.replace(statsRegex, 'className={`flex-1 min-w-0 ${stat.bg} px-3 py-1 rounded-lg border ${stat.border} flex flex-row items-center justify-between h-full relative');

const statsNumberRegex = /<div className={`text-xl font-black leading-none \${stat\.color} truncate`}>{stat\.value}<\/div>/g;
content = content.replace(statsNumberRegex, '<div className={`text-sm font-black leading-none ${stat.color} truncate`}>{stat.value}</div>');

const statsLabelRegex = /<span className="text-\[8px\] uppercase font-bold text-slate-400 tracking-wider truncate mb-1">{stat\.label}<\/span>/g;
content = content.replace(statsLabelRegex, '<span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider truncate">{stat.label}</span>');

// 3. Compact Report Numbers Card height
content = content.replace('flex items-stretch gap-4 shrink-0 min-h-[100px]', 'flex items-stretch gap-3 shrink-0 h-24');
content = content.replace('flex flex-wrap gap-2 mb-2 flex-1 content-start overflow-y-auto custom-scrollbar max-h-[150px]', 'flex flex-wrap gap-1.5 mb-1 flex-1 content-start overflow-y-auto custom-scrollbar');

// 4. Compact the left panel filter width
content = content.replace('w-[340px] flex flex-col bg-white', 'w-[240px] flex flex-col bg-white');
content = content.replace('flex-1 flex gap-6 min-h-0', 'flex-1 flex gap-3 min-h-0');

// 5. Shrink Matrix vertical headers from h-40 to h-28
content = content.replace('h-40', 'h-[104px]'); // approx h-26 

// 6. Move "Scope Overview" into the top flex row
// Currently, the structure is:
// <div className="flex items-stretch gap-4 shrink-0 min-h-[100px]"> ... </div>
// {/* Main Content Area */}
// {/* Summary Dashboard (Collapsible) */}
// {showSummary && filteredSelectedComponents.length > 0 && ( <div className="bg-white ..."> ... </div> )}
// <div className="flex-1 flex gap-6 min-h-0"> ... </div>

// We need to wrap the first div and the Summary dashboard in a single flex container.
// Or just let them be two rows? The user wants "more room for components and task selection".
// If we combine them into a single row, we save significant vertical space.
// Wait, combining them into one row requires changing the structure. Let's do it by manipulating strings carefully.

let sections = content.split('{/* Summary Dashboard (Collapsible) */}');
if (sections.length === 2) {
    let topPart = sections[0];
    let bottomPart = sections[1];
    
    // We want to merge the Summary Dashboard DIV into the top row DIV.
    // The top row div ends right before {/* Main Content Area */}
    let mainContentAreaIndex = topPart.lastIndexOf('{/* Main Content Area */}');
    let topRowCloseDivIndex = topPart.lastIndexOf('</div>', mainContentAreaIndex);
    
    // Remove the closing div of the top row
    topPart = topPart.substring(0, topRowCloseDivIndex) + topPart.substring(topRowCloseDivIndex + 6);
    
    // Now the top row remains open. We append the Summary Dashboard into it.
    // But we need to make sure the Summary Dashboard has layout classes that fit horizontally.
    // Replace the Summary dashboard wrapper classes:
    bottomPart = bottomPart.replace(
        '<div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-4 shrink-0 transition-all duration-300">',
        '<div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-3 shrink-0 flex-1 min-w-0 transition-all duration-300">'
    );
    // Make the donut chat smaller
    bottomPart = bottomPart.replace('w-24 h-24', 'w-16 h-16');
    bottomPart = bottomPart.replace('text-xl font-black text-slate-800', 'text-sm font-black text-slate-800');
    
    // Find where the Summary Dashboard ends
    let summaryDashboardEndIndex = bottomPart.indexOf('<div className="flex-1 flex gap-3 min-h-0">');
    if (summaryDashboardEndIndex === -1) summaryDashboardEndIndex = bottomPart.indexOf('<div className="flex-1 flex gap-6 min-h-0">');
    
    // We must close the top row BEFORE the left panel (the flex-1 flex gap-3 min-h-0 div).
    // So we insert a '</div>' right before it.
    bottomPart = bottomPart.substring(0, summaryDashboardEndIndex) + '\n                            </div>\n                            ' + bottomPart.substring(summaryDashboardEndIndex);
    
    content = topPart + '{/* Summary Dashboard (Collapsible) */}' + bottomPart;
    
    // Also change the Stats Panel wrapper from flex-[2] to flex-1 to save space
    // and make them flex-col so they stack vertically 2x2 or 4x1?
    // User wants compact. 4x1 is fine.
}

fs.writeFileSync(filePath, content, 'utf8');
console.log("Layout optimization applied successfully.");
