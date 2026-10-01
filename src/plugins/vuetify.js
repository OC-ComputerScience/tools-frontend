/**
 * Vuetify3 Plugin
 */
import { createVuetify } from "vuetify";

// Misc
import { loadFonts } from "./webfontloader";
loadFonts();

// Styles
import "vuetify/styles";
import "@mdi/font/css/materialdesignicons.css";

const myCustomLightTheme = {
  dark: false,
  colors: {
    primary: "#811429",
    secondary: "#F4F4F4",
    accent: "#48111C",
    success: "#47121D",
    error: "#EE5044",
    teal: "#63BAC0",
    blue: "#196CA2",
    yellow: "#F8C545",
    darkblue: "#032F45",
    background: "#FFFFFF",
    surface: "#FFFFFF",
    "on-background": "#000000",
    "on-surface": "#000000",
    "on-primary": "#FFFFFF",
  },
};

const vuetify = createVuetify({
  theme: {
    defaultTheme: "myCustomLightTheme",
    themes: {
      myCustomLightTheme,
    },
  },
  defaults: {
    VAlert: { rounded: 0 },
    VAppBar: { flat: true, elevation: 0 },
    VAutocomplete: { rounded: 0 },
    VAvatar: { rounded: 0 },
    VBtn: { rounded: 0, elevation: 0 },
    VCard: { rounded: 0, elevation: 0 },
    VChip: { rounded: 0 },
    VDialog: { rounded: 0 },
    VList: { rounded: 0 },
    VMenu: { rounded: 0 },
    VSelect: { rounded: 0 },
    VSheet: { rounded: 0, elevation: 0 },
    VTextarea: { rounded: 0 },
    VTextField: { rounded: 0 },
    VToolbar: { flat: true, elevation: 0 },
  },
  icons: {
    defaultSet: "mdi",
  },
});

export default vuetify;

