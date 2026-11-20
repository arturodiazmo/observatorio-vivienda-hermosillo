/* Menú de la cabecera en pantallas angostas (hcv-cabecera) */
(() => {
  const boton = document.querySelector('.hcv-cabecera__menu');
  const nav = document.getElementById('nav-principal');
  if (!boton || !nav) return;
  const poner = (abierto) => {
    nav.classList.toggle('abierto', abierto);
    boton.setAttribute('aria-expanded', String(abierto));
  };
  boton.addEventListener('click', () => poner(boton.getAttribute('aria-expanded') !== 'true'));
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) poner(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && boton.getAttribute('aria-expanded') === 'true') { poner(false); boton.focus(); }
  });
})();
