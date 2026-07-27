const fs = require('fs');
let routeFile = 'app/api/platform/webapp-3d/[structure_id]/route.ts';
let c = fs.readFileSync(routeFile, 'utf8');

c = c.replace(/await supabase\.from\("platform_elevation"\)/g, 'await (supabase as any).from("platform_elevation")');
c = c.replace(/await supabase\.from\("platform_faces"\)/g, 'await (supabase as any).from("platform_faces")');
c = c.replace(/await supabase\.from\("u_lib_list"\)/g, 'await (supabase as any).from("u_lib_list")');

fs.writeFileSync(routeFile, c);
console.log('Fixed TS Supabase errors');
