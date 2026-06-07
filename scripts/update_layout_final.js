const fs = require('fs');
const filePath = 'components/jobpack/sow-dialog.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Overall padding
content = content.replace(
    '<div className="flex-1 flex flex-col overflow-hidden p-8 gap-8">',
    '<div className="flex-1 flex flex-col overflow-hidden p-3 gap-3">'
);

// 2. Compact Stats Display (Map functions)
const statsRegex = /className={`flex-1 min-w-0 \${stat\.bg} px-2 py-2 rounded-xl border \${stat\.border} flex flex-col justify-center items-center h-full relative/g;
content = content.replace(statsRegex, 'className={`flex-1 min-w-0 ${stat.bg} px-3 py-1 rounded-lg border ${stat.border} flex flex-row items-center justify-between h-full relative');
const statsNumberRegex = /<div className={`text-xl font-black leading-none \${stat\.color} truncate`}>{stat\.value}<\/div>/g;
content = content.replace(statsNumberRegex, '<div className={`text-sm font-black leading-none ${stat.color} truncate`}>{stat.value}</div>');
const statsLabelRegex = /<span className="text-\[8px\] uppercase font-bold text-slate-400 tracking-wider truncate mb-1">{stat\.label}<\/span>/g;
content = content.replace(statsLabelRegex, '<span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider truncate mr-1">{stat.label}</span>');

// 3. Compact Report Numbers Card height
content = content.replace('flex items-stretch gap-4 shrink-0 min-h-[100px]', 'flex items-stretch gap-3 shrink-0 h-24');
content = content.replace('flex flex-wrap gap-2 mb-2 flex-1 content-start overflow-y-auto custom-scrollbar max-h-[150px]', 'flex flex-wrap gap-1.5 mb-1 flex-1 content-start overflow-y-auto custom-scrollbar');

// 4. Compact the left panel filter width & matrix header
content = content.replace('w-[340px] flex flex-col bg-white', 'w-[240px] flex flex-col bg-white');
content = content.replace('flex-1 flex gap-6 min-h-0', 'flex-1 flex gap-3 min-h-0');
content = content.replace('h-40', 'h-[104px]');

// 5. Structure DOM to merge Summary Dashboard into the top row
let sections = content.split('{/* Summary Dashboard (Collapsible) */}');
let topPart = sections[0];
let bottomPart = sections[1];

if (sections.length === 2) {
    // Remove the closing div of the top row (flex items-stretch gap-3 shrink-0 h-24)
    let mainContentAreaIndex = topPart.lastIndexOf('{/* Main Content Area */}');
    let topRowCloseDivIndex = topPart.lastIndexOf('</div>', mainContentAreaIndex);
    topPart = topPart.substring(0, topRowCloseDivIndex) + topPart.substring(topRowCloseDivIndex + 6);

    // Modify Summary dashboard wrapper classes
    bottomPart = bottomPart.replace(
        '<div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-4 shrink-0 transition-all duration-300">',
        '<div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-2 shrink-0 flex-[2] min-w-0 transition-all duration-300 flex flex-col justify-center">'
    );
    bottomPart = bottomPart.replace('flex flex-col md:flex-row gap-6', 'flex flex-row items-center gap-4');
    bottomPart = bottomPart.replace('w-24 h-24', 'w-12 h-12'); // Much smaller donut
    bottomPart = bottomPart.replace('w-48 shrink-0 flex flex-col items-center', 'w-20 shrink-0 flex flex-col items-center');
    bottomPart = bottomPart.replace('text-xl font-black text-slate-800 dark:text-slate-100', 'text-xs font-black text-slate-800 dark:text-slate-100');
    // Hide the title label for Scope Overview to save vertical height
    bottomPart = bottomPart.replace('<div className="flex justify-between items-center mb-3">', '<div className="flex justify-between items-center mb-3 hidden">');
    // Shrink horizontal bar chart section
    bottomPart = bottomPart.replace('flex-1 border-l border-slate-100 dark:border-slate-800 pl-6 flex flex-col justify-center', 'flex-1 border-l border-slate-100 dark:border-slate-800 pl-4 flex flex-col justify-center');
    bottomPart = bottomPart.replace('h-2.5', 'h-1.5');
    bottomPart = bottomPart.replace('<div className="space-y-3">', '<div className="space-y-2">');

    // Find end of Summary Dashboard and insert the closing tag for the top row BEFORE the start of the next flex row
    let summaryDashboardEndIndex = bottomPart.indexOf('<div className="flex-1 flex gap-3 min-h-0">');
    if (summaryDashboardEndIndex === -1) summaryDashboardEndIndex = bottomPart.indexOf('<div className="flex-1 flex gap-6 min-h-0">');
    bottomPart = bottomPart.substring(0, summaryDashboardEndIndex) + '                            </div>\n                            ' + bottomPart.substring(summaryDashboardEndIndex);

    content = topPart + '{/* Summary Dashboard (Collapsible) */}' + bottomPart;
    fs.writeFileSync(filePath, content, 'utf8');
}
