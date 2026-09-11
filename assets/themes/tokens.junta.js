/********************************************************************
 * tokens.junta.js — Tema Junta de Andalucía (colores oficiales)
 * Compatible con applyDesignTokenCssVariables()
 ********************************************************************/

window.IDEE = window.IDEE || {};
IDEE.config = IDEE.config || {};
IDEE.config.token = IDEE.config.token || {};

IDEE.config.token.junta = {
  color: {
    // Colores oficiales según el Manual de Identidad Corporativa:
    // Pantone 356 C (verde principal): #007932
    primary: "#007932",

    // A veces usado como color de enlaces
    links: "#007932",

    // Pantone 7740 C (verde secundario): #368F3F
    primary_dark: "#368F3F",

    // Éxito, advertencia, error: tonos armónicos derivados
    success: "#368F3F",     // coherente con el verde institucional
    danger: "#CC3333",      // no oficial, coherente con tonalidades utilizadas
    warning: "#FFCC00",

    // Neutrales institucionales derivados del Pantone Black 2C (#262925)
    neutral_05: "#F7F7F7",
    neutral_10: "#EDEDED",
    neutral_20: "#D5D5D5",
    neutral_30: "#BEBEBE",
    neutral_40: "#A7A7A7",
    neutral_50: "#909090",
    neutral_60: "#787878",
    neutral_70: "#5F5F5F",
    neutral_80: "#464646",
    neutral_90: "#262925",  // Pantone Black 2C

    white: "#FFFFFF",
    black: "#000000"
  },

  typography: {
    // La Junta suele emplear tipografías sans-serif modernas 
    fontFamily: "'Noto Sans', 'Arial', sans-serif",

    fontSize: {
      caption: "12px",
      body_s: "14px",
      body_m: "16px",
      body_l: "18px",
      heading_m: "24px",
      heading_l: "32px"
    },

    fontWeight: {
      regular: "400",
      bold: "700"
    }
  },

  shape: {
    border: "1px solid #D5D5D5",
    borderRadius: "4px",
    boxShadow: "0 3px 8px rgba(0, 0, 0, .15)"
  }
};

// Establecemos el tema activo
IDEE.config.activeTOKEN = "junta";

console.log("🎨 tokens.junta.js cargado (tema Junta de Andalucía)");
