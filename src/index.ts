export class AjaxInterceptor {
    private readonly winXMLHttpRequest = window.XMLHttpRequest;
    private readonly winFetch = window.fetch;
    private static instance: AjaxInterceptor;
    private constructor() {}
    getInstance() {
        if (!AjaxInterceptor.instance) {
            AjaxInterceptor.instance = new AjaxInterceptor();
        }
        return AjaxInterceptor.instance;
    }
    _generateProxyXMLHttpRequest() {
      return () => {
        const xhr = new this.winXMLHttpRequest();
        return xhr;
      };
    }
    _generateProxyFetch() {
      return (url: string, options: RequestInit) => {
        return this.winFetch(url, options);
      };
    }
    inject() {
      window.XMLHttpRequest = this._generateProxyXMLHttpRequest() as any;
      window.fetch = this._generateProxyFetch() as any;
    }
    uninject() {}
  }
  
  export default AjaxInterceptor;
  