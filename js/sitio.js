/* Complemento del menú del design system (bundle.js): en el celular, el menú se cierra al elegir una sección de esta misma página. */
(() => {
  const boton = document.querySelector('.hcv-cabecera__menu');
  const nav = document.getElementById('nav-principal');
  if (!boton || !nav) return;
  nav.addEventListener('click', (e) => {
    if (e.target.closest('a') && boton.getAttribute('aria-expanded') === 'true') boton.click();
  });
})();
