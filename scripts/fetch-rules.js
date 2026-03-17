const url = "https://zpsmxtdqlpbdwfzctqzd.supabase.co/rest/v1/defect_criteria_rules?select=*";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpwc214dGRxbHBiZHdmemN0cXpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY4NDIzODIsImV4cCI6MjA0MjQxODM4Mn0.t3uO7vnabDlwaz5iM6i8A-ya9cc6X20ZTn0bcR3zzs4";

fetch(url, { headers: { apikey: key, Authorization: "Bearer " + key } })
  .then(r => r.json())
  .then(j => console.log(JSON.stringify(j, null, 2)))
  .catch(e => console.error(e));
