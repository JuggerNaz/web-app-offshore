console.log("Environment variables keys:");
console.log(Object.keys(process.env).filter(k => k.toLowerCase().includes('supabase') || k.toLowerCase().includes('service')));
