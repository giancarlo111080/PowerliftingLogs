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

    const registrationScript = document.currentScript;
    const workerUrl = registrationScript instanceof HTMLScriptElement
      ? new URL("./sw.js", registrationScript.src)
      : new URL("./sw.js", window.location.href);
    navigator.serviceWorker.register(workerUrl.href, { scope: new URL("./", workerUrl).pathname });
  });
}
