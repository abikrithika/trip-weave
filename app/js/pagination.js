import { testLiveFlightSearch } from "./flights.js";

let lastUserPrompt = "";

export function setPaginationPrompt(prompt) {
  lastUserPrompt = prompt;
}

export function renderPagination(pagination) {
  const container = document.getElementById("paginationContainer");
  if (!container) return;

  container.innerHTML = "";

  const pagesPerGroup = 9;
  const current = pagination.page;
  const total = pagination.totalPages;
  const halfGroup = Math.floor(pagesPerGroup / 2);
  let start = Math.max(1, current - halfGroup);
  let end = Math.min(total, current + halfGroup);

  // previous
  if (current > 1) {
    const prev = document.createElement("a");
    prev.href = "#";
    prev.textContent = "Prev";

    prev.onclick = (e) => {
      e.preventDefault();
      testLiveFlightSearch(lastUserPrompt, current - 1);
    };

    container.appendChild(prev);
  }
  // First page
  if (start > 1) {
    const first = document.createElement("a");
    first.href = "#";
    first.textContent = "1";
    first.onclick = (e) => {
      e.preventDefault();
      testLiveFlightSearch(lastUserPrompt, 1);
    };
    container.appendChild(first);

    if (start > 2) {
      container.appendChild(document.createTextNode(" ... "));
    }
  }
  // display 9 pages at first
  for (let i = start; i <= end; i++) {
    const pageBtn = document.createElement("a");
    pageBtn.href = "#";
    pageBtn.textContent = i;

    pageBtn.className = i === current ? "page-number active" : "page-number";

    pageBtn.onclick = (e) => {
      e.preventDefault();
      testLiveFlightSearch(lastUserPrompt, i);
    };

    container.appendChild(pageBtn);
  }
  // Last page
  if (end < total) {
    if (end < total - 1) {
      container.appendChild(document.createTextNode(" ... "));
    }

    const last = document.createElement("a");
    last.href = "#";
    last.textContent = total;
    last.onclick = (e) => {
      e.preventDefault();
      testLiveFlightSearch(lastUserPrompt, total);
    };

    container.appendChild(last);
  }
  // next
  if (current < total) {
    const next = document.createElement("a");
    next.href = "#";
    next.textContent = "Next";

    next.onclick = (e) => {
      e.preventDefault();
      testLiveFlightSearch(lastUserPrompt, current + 1);
    };

    container.appendChild(next);
  }
}
