const updated_elements = document.querySelectorAll("[data-update]");
const oneweek = Date.now() - (1000*60*60*24*7);
const twoweeks = Date.now() - (1000*60*60*24*14);

for (let i = 0; i < updated_elements.length; i++) {
  const e = updated_elements[i];
  const ts = (new Date(e.dataset.update)).getTime();
  if (ts > oneweek) {
    e.style.backgroundColor = "#338833";
  } else if (ts > twoweeks) {
    e.style.backgroundColor = "#333388";
  }
}