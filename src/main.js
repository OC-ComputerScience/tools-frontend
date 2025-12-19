import { createApp } from "vue";
import App from "./App.vue";
import router from "./router.js";
import store from "./store/store.js";
import vuetify from "./plugins/vuetify.js";

createApp(App).use(vuetify).use(router).use(store).mount("#app");

