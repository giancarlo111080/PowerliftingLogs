if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const isLocalDevelopment = ["localhost", "127.0.0.1"].includes(window.location.hostname);
    if (isLocalDevelopment) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister();
        }
      });
      return;
    }

    navigator.serviceWorker.register("./sw.js");
  });
}
