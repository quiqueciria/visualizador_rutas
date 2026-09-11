/********************************************************************
 *  tokens.test.js — Tema de prueba con colores aleatorios
 *  Compatible con applyDesignTokenCssVariables()
 ********************************************************************/

// Función utilitaria para generar colores aleatorios en formato hex
function randomHexColor() {
  return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
}

// Aseguramos el objeto IDEE
window.IDEE = window.IDEE || {};
IDEE.config = IDEE.config || {};
IDEE.config.token = IDEE.config.token || {};

IDEE.config.token.test = {
  color: {
    primary:      randomHexColor(),
    links:        randomHexColor(),
    primary_dark: randomHexColor(),
    success:      randomHexColor(),
    danger:       randomHexColor(),
    warning:      randomHexColor(),
    neutral_05:   randomHexColor(),
    neutral_10:   randomHexColor(),
    neutral_20:   randomHexColor(),
    neutral_30:   randomHexColor(),
    neutral_40:   randomHexColor(),
    neutral_50:   randomHexColor(),
    neutral_60:   randomHexColor(),
    neutral_70:   randomHexColor(),
    neutral_80:   randomHexColor(),
    neutral_90:   randomHexColor(),
    white:        '#ffffff',
    black:        '#000000'
  },

  typography: {
    fontFamily: "'Comic Sans MS', cursive, sans-serif", // por diversión 😄
    fontSize: {
      caption:    "12px",
      body_s:     "14px",
      body_m:     "56px",
      body_l:     "18px",
      heading_m:  "24px",
      heading_l:  "32px"
    },
    fontWeight: {
      regular: "400",
      bold:    "700"
    }
  },

  shape: {
    border:       "1px solid " + randomHexColor(),
    borderRadius: "4px",
    boxShadow:    "0 4px 10px rgba(0,0,0,.15)"
  }
};

// Establecemos este tema como activo
IDEE.config.activeTOKEN = "test";

console.log("🎨 tokens.test.js — Tema TEST cargado con colores aleatorios:");
console.log(IDEE.config.token.test);