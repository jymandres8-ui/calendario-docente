/* =====================================================================
   Calendario Docente — versión para celular (PWA)
   Los datos se guardan en el propio celular (localStorage).
   ===================================================================== */
"use strict";

const CLAVE = "calendarioDocente.datos";
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio",
  "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const DIAS_C = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const CURSOS = [...new Set(HORARIO.map(h => h[3]))].sort();
const OTRA_CLASE = "— Ninguna / actividad general —";

const $ = sel => document.querySelector(sel);

/* ----------------------------- Fechas ----------------------------- */

const pad = n => String(n).padStart(2, "0");
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const deISO = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const sumarDias = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const diaSemana = d => (d.getDay() + 6) % 7;            // 0 = lunes
const lunesDe = d => { const r = sumarDias(d, -diaSemana(d)); r.setHours(0, 0, 0, 0); return r; };
const hoyISO = () => iso(new Date());
const fechaHora = (f, h) => { const d = deISO(f); const [hh, mm] = h.split(":").map(Number); d.setHours(hh, mm, 0, 0); return d; };
const fechaLarga = f => { const d = deISO(f); return `${DIAS[diaSemana(d)]} ${d.getDate()} de ${MESES[d.getMonth()].toLowerCase()}`; };
const fechaCorta = f => { const d = deISO(f); return `${DIAS_C[diaSemana(d)]} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`; };

function faltan(inicio) {
  const min = Math.round((inicio - new Date()) / 60000);
  if (min <= 0) return "¡es ahora!";
  if (min < 60) return `en ${min} min`;
  return `en ${Math.floor(min / 60)} h ${min % 60} min`;
}

/* ----------------------------- Utilidades ----------------------------- */

const esc = s => String(s ?? "").replace(/[&<>"']/g,
  c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function abreviar(curso) {
  const p = String(curso || "").trim().split(/\s+/);
  if (!p[0]) return "";
  const nivel = { Primero: "1", Segundo: "2", Tercero: "3" }[p[0]] ?? p[0][0];
  return nivel + p[p.length - 1];
}

const infoAsig = nombre =>
  Object.values(ASIGNATURAS).find(a => a.nombre === nombre) ||
  { nombre, corto: String(nombre || "").slice(0, 14), color: "#475569" };

const nuevoId = () => (window.crypto && crypto.randomUUID)
  ? crypto.randomUUID()
  : Date.now().toString(36) + Math.random().toString(36).slice(2);

let temporizadorToast;
function toast(texto, ms = 2500) {
  const t = $("#toast");
  t.textContent = texto;
  t.hidden = false;
  clearTimeout(temporizadorToast);
  temporizadorToast = setTimeout(() => { t.hidden = true; }, ms);
}

function descargar(nombre, contenido, tipo) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* ----------------------------- Datos ----------------------------- */

function normalizar(d) {
  if (Array.isArray(d)) d = { actividades: d };           // formato antiguo
  if (!d || typeof d !== "object") d = {};
  const r = {
    actividades: Array.isArray(d.actividades) ? d.actividades : [],
    dias_sin_clases: Array.isArray(d.dias_sin_clases) ? d.dias_sin_clases : [],
    config: Object.assign({ avisar_clases: true }, d.config || {}),
  };
  r.actividades = r.actividades.filter(a => a && a.fecha && a.hora && a.titulo);
  r.actividades.forEach(a => {
    a.id ??= nuevoId();
    a.hecho ??= false;
    a.curso ??= "";
    a.asignatura ??= "";
    a.notas ??= "";
    a.tipo ??= "Otro";
    if (a.aviso_min === undefined) a.aviso_min = null;
    a.avisado ??= false;
    a.posponer_hasta ??= null;
  });
  return r;
}

function cargar() {
  try { return normalizar(JSON.parse(localStorage.getItem(CLAVE))); }
  catch (e) { return normalizar(null); }
}

function guardar() {
  try { localStorage.setItem(CLAVE, JSON.stringify(datos)); }
  catch (e) { toast("No se pudo guardar en este dispositivo"); }
}

function clasesDelDia(f) {
  const wd = diaSemana(deISO(f));
  if (wd > 4 || f < CONFIG.inicioClases || f > CONFIG.finClases || datos.dias_sin_clases.includes(f)) return [];
  return HORARIO.filter(h => h[0] === wd)
    .map(([, p1, p2, curso, k]) => ({
      inicio: PERIODOS[p1][0], fin: PERIODOS[p2][1], p1, p2, curso, asignatura: ASIGNATURAS[k].nombre,
    }))
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
}

const actsFecha = f => datos.actividades.filter(a => a.fecha === f).sort((a, b) => a.hora.localeCompare(b.hora));
const actsClase = (f, c) => actsFecha(f).filter(a => a.curso === c.curso && a.asignatura === c.asignatura);
const buscar = id => datos.actividades.find(a => a.id === id);

/* ----------------------------- Estado ----------------------------- */

let datos = cargar();
let vista = "hoy";
let seleccionado = hoyISO();
let mes = { y: new Date().getFullYear(), m: new Date().getMonth() };
let semana = lunesDe(new Date());
let hojaActual = null;          // para refrescar la hoja abierta
let eventoInstalar = null;      // aviso de instalación de Chrome
const filtros = { curso: "Todos", asig: "Todas", estado: "Pendientes", periodo: "Todo" };

/* ----------------------------- Vistas ----------------------------- */

function render() {
  document.querySelectorAll(".nav button").forEach(b => b.classList.toggle("activo", b.dataset.vista === vista));
  $("#titulo").textContent = { hoy: "Hoy", calendario: "Calendario", semana: "Horario semanal", revisar: "Revisar actividades" }[vista];
  $("#vista").innerHTML = { hoy: vistaHoy, calendario: vistaCalendario, semana: vistaSemana, revisar: vistaRevisar }[vista]();
}

function irA(v) {
  vista = v;
  window.scrollTo(0, 0);
  render();
}

function filaAct(a, { conFecha = false, compacta = false } = {}) {
  const color = a.hecho ? "#94a3b8" : (TIPOS[a.tipo] || "#6b7280");
  const vencida = !a.hecho && a.fecha < hoyISO();
  const meta = [];
  if (conFecha) meta.push(fechaCorta(a.fecha));
  meta.push(a.hora);
  if (!compacta && a.curso) meta.push(abreviar(a.curso) + (a.asignatura ? " " + infoAsig(a.asignatura).corto : ""));
  meta.push(a.tipo);
  return `
    <div class="act ${a.hecho ? "hecha" : ""}" style="--t:${color}">
      <button class="check" data-accion="hecho" data-id="${a.id}" aria-label="Marcar como realizada">${a.hecho ? "✓" : ""}</button>
      <div class="act-cuerpo" data-accion="editar" data-id="${a.id}">
        <div class="act-t">${esc(a.titulo)}</div>
        <div class="act-m">${esc(meta.join(" · "))}${vencida ? ' · <b class="rojo">Vencida</b>' : ""}</div>
      </div>
    </div>`;
}

function bloqueDia(f) {
  const clases = clasesDelDia(f);
  const usadas = new Set();
  let h = `<h2>Clases</h2>`;
  if (!clases.length) {
    h += `<p class="vacio">${datos.dias_sin_clases.includes(f) ? "Día marcado sin clases." : "No hay clases este día."}</p>`;
  }
  clases.forEach((c, i) => {
    const a = infoAsig(c.asignatura);
    const acts = actsClase(f, c);
    acts.forEach(x => usadas.add(x.id));
    h += `
      <div class="clase" style="--c:${a.color}">
        <div class="clase-cab">
          <div>
            <div class="clase-hora">${c.inicio} – ${c.fin}</div>
            <div class="clase-curso">${esc(c.curso)}</div>
            <div class="clase-asig">${esc(c.asignatura)}</div>
          </div>
          <button class="mini" data-accion="nueva-clase" data-fecha="${f}" data-i="${i}">+ Actividad</button>
        </div>
        ${acts.length ? `<div class="clase-acts">${acts.map(x => filaAct(x, { compacta: true })).join("")}</div>` : ""}
      </div>`;
  });
  const otras = actsFecha(f).filter(a => !usadas.has(a.id));
  if (otras.length) h += `<h2>Otras actividades</h2><div class="lista">${otras.map(a => filaAct(a)).join("")}</div>`;
  return h;
}

function vistaHoy() {
  const f = hoyISO();
  const ahora = new Date();
  const clases = clasesDelDia(f);
  const prox = clases.find(c => fechaHora(f, c.fin) > ahora);
  let banner;
  if (prox) {
    const ini = fechaHora(f, prox.inicio);
    const a = infoAsig(prox.asignatura);
    banner = `
      <div class="banner" style="--c:${a.color}">
        <div class="banner-et">${ini <= ahora ? "Clase en curso" : "Próxima clase · " + faltan(ini)}</div>
        <div class="banner-t">${esc(prox.curso)}</div>
        <div>${esc(prox.asignatura)} · ${prox.inicio}–${prox.fin}</div>
      </div>`;
  } else {
    banner = `<div class="banner banner-vacio">${clases.length ? "Terminaste tus clases de hoy" : "Hoy no tienes clases"}</div>`;
  }

  const vencidas = datos.actividades.filter(a => !a.hecho && a.fecha < f).length;
  const alerta = vencidas
    ? `<button class="alerta" data-accion="ver-vencidas">${vencidas} actividad${vencidas !== 1 ? "es" : ""} vencida${vencidas !== 1 ? "s" : ""} sin realizar ›</button>`
    : "";

  const limite = iso(sumarDias(ahora, 7));
  const prox7 = datos.actividades
    .filter(a => !a.hecho && a.fecha > f && a.fecha <= limite)
    .sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));

  return `
    <p class="fecha-grande">${fechaLarga(f)}</p>
    ${banner}${alerta}
    ${bloqueDia(f)}
    <h2>Próximos 7 días</h2>
    ${prox7.length
      ? `<div class="lista">${prox7.map(a => filaAct(a, { conFecha: true })).join("")}</div>`
      : `<p class="vacio">Nada pendiente en los próximos días.</p>`}`;
}

function vistaCalendario() {
  const { y, m } = mes;
  const inicio = lunesDe(new Date(y, m, 1));
  const hoy = hoyISO();
  let celdas = "";
  for (let i = 0; i < 42; i++) {
    const d = sumarDias(inicio, i);
    const f = iso(d);
    if (i === 35 && d.getMonth() !== m) break;           // sin fila extra vacía
    const nClases = clasesDelDia(f).length;
    const acts = actsFecha(f);
    const puntos = acts.slice(0, 4)
      .map(a => `<i style="background:${a.hecho ? "#cbd5e1" : (TIPOS[a.tipo] || "#6b7280")}"></i>`).join("");
    const clases = [
      "dia",
      d.getMonth() !== m ? "fuera" : "",
      f === hoy ? "hoy" : "",
      f === seleccionado ? "sel" : "",
      datos.dias_sin_clases.includes(f) ? "sin" : "",
    ].join(" ");
    celdas += `
      <button class="${clases}" data-accion="dia" data-fecha="${f}">
        <span class="dia-n">${d.getDate()}</span>
        ${nClases ? `<span class="dia-c">${nClases}</span>` : ""}
        <span class="puntos">${puntos}</span>
      </button>`;
  }
  const laborable = diaSemana(deISO(seleccionado)) < 5;
  const sinClases = datos.dias_sin_clases.includes(seleccionado);
  return `
    <div class="mes-nav">
      <button class="icono" data-accion="mes" data-d="-1" aria-label="Mes anterior">‹</button>
      <strong>${MESES[m]} ${y}</strong>
      <button class="icono" data-accion="mes" data-d="1" aria-label="Mes siguiente">›</button>
    </div>
    <div class="cal-cab">${DIAS_C.map(x => `<span>${x}</span>`).join("")}</div>
    <div class="cal">${celdas}</div>
    <p class="leyenda">Número pequeño: clases del día · Puntos: actividades</p>
    <div class="dia-titulo">
      <h2>${fechaLarga(seleccionado)}</h2>
      ${laborable ? `<button class="mini claro" data-accion="sin-clases" data-fecha="${seleccionado}">${sinClases ? "Quitar «sin clases»" : "Marcar sin clases"}</button>` : ""}
    </div>
    ${bloqueDia(seleccionado)}`;
}

function vistaSemana() {
  const lun = semana;
  const vie = sumarDias(lun, 4);
  const hoy = hoyISO();
  const fila = p => (p <= 5 ? p + 1 : p + 2);     // fila 1: cabecera, fila 7: recreo
  let g = `<div class="sem"><div style="grid-row:1;grid-column:1"></div>`;

  for (let i = 0; i < 5; i++) {
    const d = sumarDias(lun, i);
    const f = iso(d);
    const sin = datos.dias_sin_clases.includes(f);
    g += `<div class="sem-cab ${f === hoy ? "hoy" : ""}" style="grid-row:1;grid-column:${i + 2}">
            ${DIAS_C[i]}<small>${sin ? "sin clases" : d.getDate() + "/" + (d.getMonth() + 1)}</small></div>`;
  }
  for (const [p, [ini]] of Object.entries(PERIODOS)) {
    g += `<div class="sem-hora" style="grid-row:${fila(+p)};grid-column:1">${ini}</div>`;
  }
  g += `<div class="sem-recreo" style="grid-row:7;grid-column:1 / span 6">Recreo ${RECREO[0]} – ${RECREO[1]}</div>`;

  for (let i = 0; i < 5; i++) {
    const f = iso(sumarDias(lun, i));
    const clases = clasesDelDia(f);
    const ocupadas = new Set();
    clases.forEach((c, j) => {
      const a = infoAsig(c.asignatura);
      const acts = actsClase(f, c);
      const pend = acts.filter(x => !x.hecho).length;
      for (let p = c.p1; p <= c.p2; p++) ocupadas.add(p);
      g += `
        <button class="sem-clase" style="--c:${a.color};grid-row:${fila(c.p1)} / span ${c.p2 - c.p1 + 1};grid-column:${i + 2}"
                data-accion="clase" data-fecha="${f}" data-i="${j}">
          <b>${abreviar(c.curso)}</b><span>${esc(a.corto)}</span>
          ${acts.length ? `<em>${pend || "✓"}</em>` : ""}
        </button>`;
    });
    for (const p of Object.keys(PERIODOS).map(Number)) {
      if (!ocupadas.has(p)) {
        g += `<div class="sem-vacio ${clases.length ? "" : "gris"}" style="grid-row:${fila(p)};grid-column:${i + 2}"></div>`;
      }
    }
  }
  g += `</div>`;

  const mesCorto = d => MESES[d.getMonth()].slice(0, 3).toLowerCase();
  return `
    <div class="mes-nav">
      <button class="icono" data-accion="semana" data-d="-1" aria-label="Semana anterior">‹</button>
      <strong>${lun.getDate()} ${mesCorto(lun)} – ${vie.getDate()} ${mesCorto(vie)} ${vie.getFullYear()}</strong>
      <button class="icono" data-accion="semana" data-d="1" aria-label="Semana siguiente">›</button>
    </div>
    <button class="mini claro centro" data-accion="semana-hoy">Ir a esta semana</button>
    ${g}
    <p class="leyenda">Toca una clase para ver o agregar actividades · El círculo indica pendientes</p>
    <div class="leyenda-asig">
      ${Object.values(ASIGNATURAS).map(a => `<span style="--c:${a.color}">${esc(a.nombre)}</span>`).join("")}
    </div>`;
}

function vistaRevisar() {
  const hoy = hoyISO();
  const lun = iso(lunesDe(new Date()));
  const dom = iso(sumarDias(lunesDe(new Date()), 6));
  const lim7 = iso(sumarDias(new Date(), 7));
  const mesActual = hoy.slice(0, 7);

  const cursos = [...new Set([...CURSOS, ...datos.actividades.map(a => a.curso).filter(Boolean)])].sort();
  const asigs = [...new Set([...Object.values(ASIGNATURAS).map(a => a.nombre),
    ...datos.actividades.map(a => a.asignatura).filter(Boolean)])].sort();

  const lista = datos.actividades.filter(a => {
    if (filtros.curso !== "Todos" && a.curso !== filtros.curso) return false;
    if (filtros.asig !== "Todas" && a.asignatura !== filtros.asig) return false;
    if (filtros.estado === "Pendientes" && a.hecho) return false;
    if (filtros.estado === "Realizadas" && !a.hecho) return false;
    switch (filtros.periodo) {
      case "Vencidas": return a.fecha < hoy && !a.hecho;
      case "Hoy": return a.fecha === hoy;
      case "Esta semana": return a.fecha >= lun && a.fecha <= dom;
      case "Próximos 7 días": return a.fecha >= hoy && a.fecha <= lim7;
      case "Este mes": return a.fecha.startsWith(mesActual);
      default: return true;
    }
  }).sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));

  const select = (clave, opciones) =>
    `<select data-filtro="${clave}">${opciones.map(o =>
      `<option value="${esc(o)}" ${o === filtros[clave] ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>`;

  return `
    <div class="filtros">
      ${select("curso", ["Todos", ...cursos])}
      ${select("asig", ["Todas", ...asigs])}
      ${select("estado", ["Pendientes", "Realizadas", "Todas"])}
      ${select("periodo", ["Todo", "Vencidas", "Hoy", "Esta semana", "Próximos 7 días", "Este mes"])}
    </div>
    <p class="conteo">${lista.length} actividad${lista.length !== 1 ? "es" : ""}</p>
    ${lista.length
      ? `<div class="lista">${lista.map(a => filaAct(a, { conFecha: true })).join("")}</div>`
      : `<p class="vacio">No hay actividades con estos filtros.</p>`}`;
}

/* ----------------------------- Hojas (paneles inferiores) ----------------------------- */

function abrirHoja(html, info = null) {
  const hoja = $("#hoja");
  hoja.innerHTML = html;
  hoja.hidden = false;
  $("#hoja-fondo").hidden = false;
  document.body.classList.add("bloqueado");
  hojaActual = info;
}

function cerrarHoja() {
  $("#hoja").hidden = true;
  $("#hoja").innerHTML = "";
  $("#hoja-fondo").hidden = true;
  document.body.classList.remove("bloqueado");
  hojaActual = null;
}

function abrirHojaClase(f, i) {
  const c = clasesDelDia(f)[i];
  if (!c) return;
  const a = infoAsig(c.asignatura);
  const acts = actsClase(f, c);
  abrirHoja(`
    <div class="hoja-cab">
      <div>
        <div class="clase-hora">${fechaLarga(f)} · ${c.inicio}–${c.fin}</div>
        <h2 style="color:${a.color}">${esc(c.curso)}</h2>
        <div class="clase-asig" style="--c:${a.color}">${esc(c.asignatura)}</div>
      </div>
      <button class="icono" data-accion="cerrar" aria-label="Cerrar">✕</button>
    </div>
    ${acts.length
      ? `<div class="lista">${acts.map(x => filaAct(x, { compacta: true })).join("")}</div>`
      : `<p class="vacio">Sin actividades para esta clase.</p>`}
    <div class="botones">
      <button class="claro" data-accion="ver-dia" data-fecha="${f}">Ver el día</button>
      <button class="primario" data-accion="nueva-clase" data-fecha="${f}" data-i="${i}">+ Nueva actividad</button>
    </div>`, { tipo: "clase", f, i });
}

function abrirForm({ actividad = null, fecha = hoyISO(), clase = null } = {}) {
  const a = actividad || {};
  const v = {
    fecha: a.fecha || fecha,
    hora: a.hora || (clase ? clase.inicio : "07:00"),
    curso: actividad ? a.curso : (clase ? clase.curso : ""),
    asignatura: actividad ? a.asignatura : (clase ? clase.asignatura : ""),
    titulo: a.titulo || "",
    tipo: a.tipo || "Deber / Tarea",
    aviso: actividad ? a.aviso_min : 15,
    notas: a.notas || "",
    hecho: !!a.hecho,
  };
  const tipos = Object.keys(TIPOS).includes(v.tipo) ? Object.keys(TIPOS) : [...Object.keys(TIPOS), v.tipo];

  abrirHoja(`
    <div class="hoja-cab">
      <h2>${actividad ? "Editar" : "Nueva"} actividad</h2>
      <button class="icono" data-accion="cerrar" aria-label="Cerrar">✕</button>
    </div>
    <form id="form-act" autocomplete="off">
      <label>Actividad<input name="titulo" value="${esc(v.titulo)}" placeholder="Ej.: Revisión de láminas" required></label>
      <div class="fila2">
        <label>Fecha<input type="date" name="fecha" value="${v.fecha}" required></label>
        <label>Hora<input type="time" name="hora" value="${v.hora}" required></label>
      </div>
      <label>Clase del horario<select name="clase"></select></label>
      <label>Curso<input name="curso" list="lista-cursos" value="${esc(v.curso)}"></label>
      <label>Asignatura<input name="asignatura" list="lista-asig" value="${esc(v.asignatura)}"></label>
      <datalist id="lista-cursos">${CURSOS.map(c => `<option value="${esc(c)}">`).join("")}</datalist>
      <datalist id="lista-asig">${Object.values(ASIGNATURAS).map(x => `<option value="${esc(x.nombre)}">`).join("")}</datalist>
      <div class="fila2">
        <label>Tipo<select name="tipo">${tipos.map(t => `<option ${t === v.tipo ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></label>
        <label>Recordatorio<select name="aviso">${AVISOS.map(([txt, min]) =>
          `<option value="${min ?? ""}" ${min === v.aviso ? "selected" : ""}>${txt}</option>`).join("")}</select></label>
      </div>
      <label>Notas<textarea name="notas" rows="3">${esc(v.notas)}</textarea></label>
      <label class="check-linea"><input type="checkbox" name="hecho" ${v.hecho ? "checked" : ""}> Actividad realizada</label>
      <div class="botones">
        ${actividad ? `<button type="button" class="peligro" data-form="eliminar">Eliminar</button>` : ""}
        <button type="button" class="claro" data-form="gcal">Google Calendar</button>
        <button type="submit" class="primario">Guardar</button>
      </div>
    </form>`, { tipo: "form" });

  const form = $("#form-act");
  const el = form.elements;
  let clasesForm = [];

  const llenarClases = () => {
    clasesForm = el.fecha.value ? clasesDelDia(el.fecha.value) : [];
    el.clase.innerHTML = `<option value="">${OTRA_CLASE}</option>` + clasesForm.map((c, i) =>
      `<option value="${i}">${c.inicio} · ${abreviar(c.curso)} · ${esc(infoAsig(c.asignatura).corto)}</option>`).join("");
    const idx = clasesForm.findIndex(c => c.curso === el.curso.value && c.asignatura === el.asignatura.value);
    el.clase.value = idx >= 0 ? String(idx) : "";
  };
  llenarClases();
  el.fecha.addEventListener("change", llenarClases);
  el.clase.addEventListener("change", () => {
    const c = clasesForm[Number(el.clase.value)];
    if (el.clase.value === "" || !c) { el.curso.value = ""; el.asignatura.value = ""; return; }
    el.hora.value = c.inicio;
    el.curso.value = c.curso;
    el.asignatura.value = c.asignatura;
  });

  form.addEventListener("submit", e => {
    e.preventDefault();
    const d = leerForm(form);
    if (!d) return;
    if (actividad) {
      if (actividad.fecha === d.fecha && actividad.hora === d.hora && actividad.aviso_min === d.aviso_min) {
        d.avisado = actividad.avisado;
        d.posponer_hasta = actividad.posponer_hasta;
      }
      Object.assign(actividad, d);
    } else {
      datos.actividades.push({ id: nuevoId(), ...d });
    }
    guardar();
    seleccionado = d.fecha;
    const fd = deISO(d.fecha);
    mes = { y: fd.getFullYear(), m: fd.getMonth() };
    cerrarHoja();
    render();
    toast("Actividad guardada");
  });

  form.querySelector('[data-form="eliminar"]')?.addEventListener("click", () => {
    if (!confirm(`¿Eliminar «${actividad.titulo}»?`)) return;
    datos.actividades = datos.actividades.filter(x => x !== actividad);
    guardar();
    cerrarHoja();
    render();
    toast("Actividad eliminada");
  });

  form.querySelector('[data-form="gcal"]').addEventListener("click", () => {
    const d = leerForm(form);
    if (d) window.open(urlGoogleCalendar(d), "_blank");
  });

  if (!actividad) setTimeout(() => el.titulo.focus(), 250);
}

function leerForm(form) {
  const el = form.elements;
  const titulo = el.titulo.value.trim();
  if (!titulo) { toast("Escribe el nombre de la actividad"); el.titulo.focus(); return null; }
  if (!el.fecha.value || !el.hora.value) { toast("Revisa la fecha y la hora"); return null; }
  return {
    fecha: el.fecha.value,
    hora: el.hora.value.slice(0, 5),
    titulo,
    tipo: el.tipo.value,
    curso: el.curso.value.trim(),
    asignatura: el.asignatura.value.trim(),
    notas: el.notas.value.trim(),
    aviso_min: el.aviso.value === "" ? null : Number(el.aviso.value),
    hecho: el.hecho.checked,
    avisado: false,
    posponer_hasta: null,
  };
}

function abrirAjustes() {
  const permiso = "Notification" in window ? Notification.permission : "no";
  const estado = {
    granted: "Activadas ✓",
    denied: "Bloqueadas: actívalas en los ajustes del navegador",
    default: "Sin activar",
    no: "Este navegador no las admite",
  }[permiso];
  abrirHoja(`
    <div class="hoja-cab">
      <h2>Ajustes</h2>
      <button class="icono" data-accion="cerrar" aria-label="Cerrar">✕</button>
    </div>
    ${eventoInstalar ? `<button class="primario ancho" data-aj="instalar">Instalar la app en el celular</button>` : ""}

    <h3>Recordatorios</h3>
    <div class="ajuste">
      <div><b>Notificaciones</b><small>${estado}</small></div>
      ${permiso === "default" ? `<button class="mini" data-aj="notif">Activar</button>` : ""}
    </div>
    <label class="ajuste">
      <div><b>Avisar ${CONFIG.avisoClaseMin} min antes de cada clase</b><small>Con lo pendiente para ese curso</small></div>
      <input type="checkbox" data-aj="clases" ${datos.config.avisar_clases ? "checked" : ""}>
    </label>
    <p class="nota">Los avisos de esta app funcionan mientras está abierta o en segundo plano reciente.
      Para tener alarmas seguras aunque el celular esté bloqueado, pasa tu horario y actividades a Google Calendar:</p>
    <button class="claro ancho" data-aj="ics-horario">📅 Descargar horario de clases (.ics)</button>
    <button class="claro ancho" data-aj="ics-acts">📝 Descargar actividades pendientes (.ics)</button>

    <h3>Copia de seguridad</h3>
    <p class="nota">Compatible con la versión de escritorio (actividades_docente.json).</p>
    <button class="claro ancho" data-aj="exportar">⬇ Exportar mis datos</button>
    <button class="claro ancho" data-aj="importar">⬆ Importar datos</button>

    <h3>Año lectivo</h3>
    <p class="nota">Del ${fechaLarga(CONFIG.inicioClases).toLowerCase()} de ${CONFIG.inicioClases.slice(0, 4)}
      al ${fechaLarga(CONFIG.finClases).toLowerCase()} de ${CONFIG.finClases.slice(0, 4)}.
      Se cambia en el archivo horario.js.</p>`, { tipo: "ajustes" });
}

/* ----------------------------- Acciones ----------------------------- */

function alternarHecho(id) {
  const a = buscar(id);
  if (!a) return;
  a.hecho = !a.hecho;
  guardar();
  render();
  if (hojaActual?.tipo === "clase") abrirHojaClase(hojaActual.f, hojaActual.i);
  toast(a.hecho ? "Marcada como realizada ✓" : "Marcada como pendiente");
}

function alternarSinClases(f) {
  const i = datos.dias_sin_clases.indexOf(f);
  if (i >= 0) datos.dias_sin_clases.splice(i, 1);
  else datos.dias_sin_clases.push(f);
  guardar();
  render();
}

document.addEventListener("click", e => {
  const nav = e.target.closest(".nav button");
  if (nav) { irA(nav.dataset.vista); return; }

  const el = e.target.closest("[data-accion]");
  if (!el) return;
  const { accion, id, fecha, i, d } = el.dataset;
  switch (accion) {
    case "hecho": alternarHecho(id); break;
    case "editar": abrirForm({ actividad: buscar(id) }); break;
    case "nueva-clase": abrirForm({ fecha, clase: clasesDelDia(fecha)[Number(i)] }); break;
    case "clase": abrirHojaClase(fecha, Number(i)); break;
    case "cerrar": cerrarHoja(); break;
    case "dia": {
      seleccionado = fecha;
      const fd = deISO(fecha);
      mes = { y: fd.getFullYear(), m: fd.getMonth() };
      render();
      break;
    }
    case "mes": {
      const n = new Date(mes.y, mes.m + Number(d), 1);
      mes = { y: n.getFullYear(), m: n.getMonth() };
      render();
      break;
    }
    case "sin-clases": alternarSinClases(fecha); break;
    case "semana": semana = sumarDias(semana, 7 * Number(d)); render(); break;
    case "semana-hoy": semana = lunesDe(new Date()); render(); break;
    case "ver-vencidas":
      Object.assign(filtros, { periodo: "Vencidas", estado: "Pendientes", curso: "Todos", asig: "Todas" });
      irA("revisar");
      break;
    case "ver-dia": {
      seleccionado = fecha;
      const fd = deISO(fecha);
      mes = { y: fd.getFullYear(), m: fd.getMonth() };
      cerrarHoja();
      irA("calendario");
      break;
    }
  }
});

document.addEventListener("change", e => {
  if (e.target.dataset.filtro) {
    filtros[e.target.dataset.filtro] = e.target.value;
    render();
  }
  if (e.target.dataset.aj === "clases") {
    datos.config.avisar_clases = e.target.checked;
    guardar();
  }
});

$("#fab").addEventListener("click", () => abrirForm({ fecha: vista === "calendario" ? seleccionado : hoyISO() }));
$("#btn-ajustes").addEventListener("click", abrirAjustes);

$("#hoja").addEventListener("click", async e => {
  const b = e.target.closest("[data-aj]");
  if (!b || b.tagName === "INPUT") return;
  switch (b.dataset.aj) {
    case "notif":
      if ("Notification" in window) await Notification.requestPermission();
      abrirAjustes();
      break;
    case "instalar":
      if (eventoInstalar) { eventoInstalar.prompt(); eventoInstalar = null; abrirAjustes(); }
      break;
    case "ics-horario": descargar("horario_clases.ics", icsHorario(), "text/calendar"); break;
    case "ics-acts": descargar("actividades_pendientes.ics", icsActividades(), "text/calendar"); break;
    case "exportar": descargar("actividades_docente.json", JSON.stringify(datos, null, 2), "application/json"); break;
    case "importar": $("#archivo-import").click(); break;
  }
});

$("#archivo-import").addEventListener("change", async e => {
  const archivo = e.target.files[0];
  e.target.value = "";
  if (!archivo) return;
  try {
    const nuevos = normalizar(JSON.parse(await archivo.text()));
    if (!confirm(`Se importarán ${nuevos.actividades.length} actividades y se combinarán con las actuales. ¿Continuar?`)) return;
    const porId = new Map(datos.actividades.map(a => [a.id, a]));
    nuevos.actividades.forEach(a => porId.set(a.id, a));
    datos.actividades = [...porId.values()];
    datos.dias_sin_clases = [...new Set([...datos.dias_sin_clases, ...nuevos.dias_sin_clases])];
    guardar();
    cerrarHoja();
    render();
    toast(`Importación lista: ${nuevos.actividades.length} actividades`);
  } catch (err) {
    toast("El archivo no es válido");
  }
});

/* ----------------------------- Google Calendar / .ics ----------------------------- */

const fmtLocal = dt =>
  `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}T${pad(dt.getHours())}${pad(dt.getMinutes())}00`;

function urlGoogleCalendar(d) {
  const ini = fechaHora(d.fecha, d.hora);
  const fin = new Date(ini.getTime() + 40 * 60000);
  const detalles = [d.curso, d.asignatura, d.notas].filter(Boolean).join("\n");
  return "https://calendar.google.com/calendar/render?action=TEMPLATE" +
    `&text=${encodeURIComponent(d.titulo)}` +
    `&dates=${fmtLocal(ini)}/${fmtLocal(fin)}` +
    `&details=${encodeURIComponent(detalles)}` +
    `&ctz=${encodeURIComponent(CONFIG.zonaHoraria)}`;
}

const icsTexto = s => String(s).replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, m => "\\" + m);
const icsSello = () => new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
const icsCalendario = eventos => [
  "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Calendario Docente//ES", "CALSCALE:GREGORIAN",
  `X-WR-TIMEZONE:${CONFIG.zonaHoraria}`, ...eventos, "END:VCALENDAR", "",
].join("\r\n");

function icsHorario() {
  const tz = CONFIG.zonaHoraria;
  const ev = [];
  HORARIO.forEach(([dia, p1, p2, curso, k], n) => {
    let d = deISO(CONFIG.inicioClases);
    while (diaSemana(d) !== dia) d = sumarDias(d, 1);
    const ini = fechaHora(iso(d), PERIODOS[p1][0]);
    const fin = fechaHora(iso(d), PERIODOS[p2][1]);
    const excluir = datos.dias_sin_clases
      .filter(x => diaSemana(deISO(x)) === dia)
      .map(x => `EXDATE;TZID=${tz}:${fmtLocal(fechaHora(x, PERIODOS[p1][0]))}`);
    const asig = ASIGNATURAS[k].nombre;
    ev.push(
      "BEGIN:VEVENT",
      `UID:clase-${n}-${CONFIG.inicioClases}@calendario-docente`,
      `DTSTAMP:${icsSello()}`,
      `DTSTART;TZID=${tz}:${fmtLocal(ini)}`,
      `DTEND;TZID=${tz}:${fmtLocal(fin)}`,
      `RRULE:FREQ=WEEKLY;UNTIL=${CONFIG.finClases.replaceAll("-", "")}T235959Z`,
      ...excluir,
      `SUMMARY:${icsTexto(abreviar(curso) + " · " + asig)}`,
      `DESCRIPTION:${icsTexto(curso + "\n" + asig)}`,
      "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsTexto("Clase con " + curso)}`,
      `TRIGGER:-PT${CONFIG.avisoClaseMin}M`, "END:VALARM",
      "END:VEVENT");
  });
  return icsCalendario(ev);
}

function icsActividades() {
  const tz = CONFIG.zonaHoraria;
  const hoy = hoyISO();
  const ev = [];
  datos.actividades.filter(a => !a.hecho && a.fecha >= hoy).forEach(a => {
    const ini = fechaHora(a.fecha, a.hora);
    const fin = new Date(ini.getTime() + 40 * 60000);
    ev.push(
      "BEGIN:VEVENT",
      `UID:${a.id}@calendario-docente`,
      `DTSTAMP:${icsSello()}`,
      `DTSTART;TZID=${tz}:${fmtLocal(ini)}`,
      `DTEND;TZID=${tz}:${fmtLocal(fin)}`,
      `SUMMARY:${icsTexto(a.titulo)}`,
      `DESCRIPTION:${icsTexto([a.tipo, a.curso, a.asignatura, a.notas].filter(Boolean).join("\n"))}`);
    if (a.aviso_min !== null) {
      ev.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsTexto(a.titulo)}`,
        `TRIGGER:-PT${a.aviso_min}M`, "END:VALARM");
    }
    ev.push("END:VEVENT");
  });
  return icsCalendario(ev);
}

/* ----------------------------- Recordatorios ----------------------------- */

const clasesAvisadas = new Set();

async function notificar(titulo, cuerpo, tag) {
  toast(`${titulo} — ${cuerpo.split("\n")[0]}`, 8000);
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const opciones = { body: cuerpo, tag, icon: "icons/icon-192.png", badge: "icons/icon-192.png", vibrate: [200, 100, 200] };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) { await reg.showNotification(titulo, opciones); return; }
  } catch (e) { /* se intenta el método simple */ }
  try { new Notification(titulo, opciones); } catch (e) { /* sin notificación del sistema */ }
}

function revisarRecordatorios() {
  const ahora = new Date();
  let cambios = false;

  for (const a of datos.actividades) {
    if (a.hecho || a.aviso_min === null || a.avisado) continue;
    const ini = fechaHora(a.fecha, a.hora);
    if (isNaN(ini)) continue;
    const momento = a.posponer_hasta ? new Date(a.posponer_hasta) : new Date(ini.getTime() - a.aviso_min * 60000);
    if (ahora >= momento) {
      a.avisado = true;
      a.posponer_hasta = null;
      cambios = true;
      if (ahora - ini < 2 * 3600000) {
        const lineas = [`${fechaCorta(a.fecha)} ${a.hora} · ${faltan(ini)}`];
        if (a.curso) lineas.push(a.curso + (a.asignatura ? " · " + a.asignatura : ""));
        if (a.notas) lineas.push(a.notas);
        notificar(`⏰ ${a.titulo}`, lineas.join("\n"), a.id);
      }
    }
  }
  if (cambios) guardar();

  if (datos.config.avisar_clases) {
    const f = iso(ahora);
    for (const c of clasesDelDia(f)) {
      const ini = fechaHora(f, c.inicio);
      const clave = `${f}-${c.inicio}-${c.curso}`;
      if (ahora >= ini - CONFIG.avisoClaseMin * 60000 && ahora < ini && !clasesAvisadas.has(clave)) {
        clasesAvisadas.add(clave);
        const pend = actsClase(f, c).filter(x => !x.hecho);
        notificar(`Próxima clase: ${c.curso}`,
          `${c.asignatura} · ${c.inicio}–${c.fin}\n` +
          (pend.length ? "Pendiente: " + pend.map(x => x.titulo).join(", ") : "Sin actividades registradas"),
          "clase-" + clave);
      }
    }
  }

  if (vista === "hoy" && !hojaActual) render();   // mantiene al día el aviso de próxima clase
}

/* ----------------------------- Inicio ----------------------------- */

window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); eventoInstalar = e; });

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) { revisarRecordatorios(); if (!hojaActual) render(); }
});

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("sw.js").catch(() => { /* sin modo sin conexión */ });
}

render();
revisarRecordatorios();
setInterval(revisarRecordatorios, 20000);
