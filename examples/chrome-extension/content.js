(() => {
  const libScript = document.createElement("script");
  libScript.src = chrome.runtime.getURL("vendor/ajax-hooker.iife.js");
  libScript.onload = () => {
    const initScript = document.createElement("script");
    initScript.textContent = `
      (function () {
        if (!window.AjaxHooker) return;
        const interceptor = window.AjaxHooker.getInstance();
        interceptor.inject();
        interceptor.hook((request) => {
          request.headers.set("x-ext-demo", "ajax-hooker");
          request.response = async (response) => {
            console.log("[ajax-hooker][ext]", request.type, request.method, request.url, response.status);
          };
          return request;
        });
      })();
    `;
    (document.head || document.documentElement).appendChild(initScript);
    initScript.remove();
    libScript.remove();
  };
  (document.head || document.documentElement).appendChild(libScript);
})();
