async function check() {
  try {
    const res = await fetch("http://127.0.0.1:3000/api/library/combo/ANMLYCLR");
    const json = await res.json();
    console.log("Combo response:", json);
  } catch (err) {
    console.error("Fetch Error:", err);
  }
}
check();
