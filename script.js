"use strict";

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

const sections = $$(".entity-section");
const tableNav = $("#tableNav");
const searchInput = $("#searchInput");
const searchFeedback = $("#searchFeedback");
const noResults = $("#noResults");
const filterButtons = $$(".filter-chip");
const themeToggle = $("#themeToggle");
const themeLabel = $("#themeLabel");
const menuToggle = $("#menuToggle");
const menuClose = $("#menuClose");
const menuOverlay = $("#sidebarOverlay");
const dialog = $("#derDialog");
const viewport = $("#derViewport");
const diagram = $("#derImage");
const zoomLabel = $("#zoomLabel");
const THEME_KEY = "mercado-ipronto-dictionary-theme";
let activeFilter = "all";
let zoom = 1;
let translateX = 0;
let translateY = 0;
let dragging = false;
let lastPointerX = 0;
let lastPointerY = 0;

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

for (const section of sections) {
  const title = $("h3", section).textContent.trim();
  const link = document.createElement("a");
  const initial = document.createElement("span");
  const name = document.createElement("span");

  link.href = `#${section.id}`;
  link.dataset.target = section.id;
  initial.className = "nav-item-initial";
  initial.setAttribute("aria-hidden", "true");
  initial.textContent = title.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase();
  name.textContent = title;
  link.append(initial, name);
  tableNav.appendChild(link);
}

$("#countTables").textContent = String(sections.length);
$("#sidebarCount").textContent = String(sections.length);
$("#countColumns").textContent = String($$(".entity-section tbody tr").length);

function normalize(text) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

function matchSpecialFilter(row, section) {
  if (activeFilter === "pk") return row.dataset.key.split(" ").includes("pk");
  if (activeFilter === "fk") return row.dataset.key.split(" ").includes("fk");
  if (activeFilter === "personal") return row.dataset.privacy === "personal";
  if (activeFilter === "nullable") return Array.from(row.querySelectorAll(".constraint")).some(item => item.textContent.trim() === "[NULL]");
  return true;
}

function filterDictionary() {
  const term = normalize(searchInput.value.trim());
  let visibleTables = 0;
  let visibleColumns = 0;

  for (const section of sections) {
    const tableMatches = normalize($("h3", section).textContent).includes(term);
    let matches = 0;

    for (const row of $$("tbody tr", section)) {
      const columnMatches = !term || tableMatches || normalize(row.dataset.column).includes(term);
      const visible = columnMatches && matchSpecialFilter(row, section);
      row.hidden = !visible;
      if (visible) matches += 1;
    }

    section.hidden = matches === 0;
    if (matches > 0) {
      visibleTables += 1;
      visibleColumns += matches;
    }

    const link = $(`a[data-target="${section.id}"]`, tableNav);
    if (link) link.hidden = matches === 0;
  }

  $("#sidebarCount").textContent = String(visibleTables);
  noResults.hidden = visibleColumns > 0;
  searchFeedback.textContent = `Exibindo ${visibleTables} ${visibleTables === 1 ? "tabela" : "tabelas"} e ${visibleColumns} ${visibleColumns === 1 ? "atributo" : "atributos"}.`;
}

function setFilter(filter) {
  activeFilter = filter;
  for (const button of filterButtons) {
    const selected = button.dataset.filter === filter;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  }
  filterDictionary();
}

filterButtons.forEach(button => button.addEventListener("click", () => setFilter(button.dataset.filter)));
searchInput.addEventListener("input", filterDictionary);

$("#clearSearch").addEventListener("click", () => {
  searchInput.value = "";
  setFilter("all");
  searchInput.focus();
});

$("#downloadCsv").addEventListener("click", () => {
  const head = ["Tabela", "Atributo", "Descrição / Regra de Negócio", "Tipo e Tamanho", "Constraints", "Privacidade (LGPD)", "Linhagem", "RBAC"];
  const rows = [head];

  for (const section of sections) {
    if (section.hidden) continue;
    const tableName = $("h3", section).textContent.trim();
    for (const row of $$("tbody tr", section)) {
      if (row.hidden) continue;
      rows.push([tableName, ...$$("td", row).map(cell => cell.innerText.replace(/\s+/g, " ").trim())]);
    }
  }

  const csv = "\ufeff" + rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "Mercado_iPronto_Dicionario_de_Dados.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

function openMenu() {
  document.body.classList.add("menu-open");
  menuToggle.setAttribute("aria-expanded", "true");
  menuToggle.setAttribute("aria-label", "Fechar menu de navegação");
  menuClose.focus();
}

function closeMenu() {
  document.body.classList.remove("menu-open");
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", "Abrir menu de navegação");
}

menuToggle.addEventListener("click", () => document.body.classList.contains("menu-open") ? closeMenu() : openMenu());
menuClose.addEventListener("click", closeMenu);
menuOverlay.addEventListener("click", closeMenu);
$$(".sidebar a").forEach(link => link.addEventListener("click", closeMenu));
window.addEventListener("resize", () => {
  if (window.innerWidth > 930) closeMenu();
});

function setTheme(theme) {
  const isDark = theme === "dark";
  document.documentElement.dataset.theme = isDark ? "dark" : "light";
  themeToggle.setAttribute("aria-pressed", String(isDark));
  themeToggle.setAttribute("aria-label", isDark ? "Ativar modo claro" : "Ativar modo escuro");
  themeLabel.textContent = isDark ? "Modo claro" : "Modo escuro";
  try { localStorage.setItem(THEME_KEY, isDark ? "dark" : "light"); } catch (_) { }
}

let initialTheme = "light";
try {
  initialTheme = localStorage.getItem(THEME_KEY) || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
} catch (_) { }
setTheme(initialTheme);
themeToggle.addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));

function drawDiagram() {
  diagram.style.transform = `translate(${translateX}px, ${translateY}px) scale(${zoom})`;
  zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
}

function adjustZoom(multiplier, clientX, clientY) {
  const nextZoom = clamp(zoom * multiplier, 0.3, 10);
  if (nextZoom === zoom) return;

  const box = viewport.getBoundingClientRect();
  const pivotX = (clientX ?? box.left + box.width / 2) - box.left - box.width / 2;
  const pivotY = (clientY ?? box.top + box.height / 2) - box.top - box.height / 2;
  const ratio = nextZoom / zoom;

  translateX = pivotX - (pivotX - translateX) * ratio;
  translateY = pivotY - (pivotY - translateY) * ratio;
  zoom = nextZoom;
  drawDiagram();
}

function resetDiagram() {
  zoom = 1;
  translateX = 0;
  translateY = 0;
  drawDiagram();
}

$("#openDer").addEventListener("click", () => {
  resetDiagram();
  dialog.showModal();
  document.body.style.overflow = "hidden";
  $("#closeDer").focus();
});

$("#closeDer").addEventListener("click", () => dialog.close());
$("#zoomIn").addEventListener("click", () => adjustZoom(1.3));
$("#zoomOut").addEventListener("click", () => adjustZoom(1 / 1.3));
$("#zoomReset").addEventListener("click", resetDiagram);

dialog.addEventListener("close", () => {
  document.body.style.overflow = "";
  dragging = false;
  viewport.classList.remove("dragging");
});

viewport.addEventListener("wheel", event => {
  event.preventDefault();
  adjustZoom(Math.exp(-event.deltaY * .00125), event.clientX, event.clientY);
}, { passive: false });

viewport.addEventListener("pointerdown", event => {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  dragging = true;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
  viewport.setPointerCapture(event.pointerId);
  viewport.classList.add("dragging");
});

viewport.addEventListener("pointermove", event => {
  if (!dragging) return;
  translateX += event.clientX - lastPointerX;
  translateY += event.clientY - lastPointerY;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
  drawDiagram();
});

function endDrag() {
  dragging = false;
  viewport.classList.remove("dragging");
}
viewport.addEventListener("pointerup", endDrag);
viewport.addEventListener("pointercancel", endDrag);
viewport.addEventListener("lostpointercapture", endDrag);

dialog.addEventListener("keydown", event => {
  if (event.key === "+" || event.key === "=") adjustZoom(1.3);
  if (event.key === "-") adjustZoom(1 / 1.3);
  if (event.key === "0") resetDiagram();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && document.body.classList.contains("menu-open")) closeMenu();
  if (event.key === "/" && !dialog.open && !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
    event.preventDefault();
    searchInput.focus();
  }
});

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(entries => {
    const first = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!first) return;
    for (const link of $$("a", tableNav)) {
      link.classList.toggle("active", link.dataset.target === first.target.id);
    }
  }, { rootMargin: "-12% 0px -62% 0px", threshold: [0, 0.1, 0.4] });
  sections.forEach(section => observer.observe(section));
}

filterDictionary();
