console.log(Object.keys(process.env).filter(key => key.includes('SUPABASE') || key.includes('KEY') || key.includes('URL')));
