import { AJAX_TYPE } from './constant';
import {
  HookFunction,
  AjaxType,
  AjaxInterceptorCreateInstanceOptions,
  ActionType,
} from './type';
import { XhrInterceptor } from './xhr';
import { FetchInterceptor } from './fetch';

class AjaxInterceptor {
  public xhrInterceptor: XhrInterceptor;
  public fetchInterceptor: FetchInterceptor;
  static #instance: AjaxInterceptor;
  static #token = Symbol('AjaxInterceptor');
  static getInstance(options: AjaxInterceptorCreateInstanceOptions = {}) {
    if (!AjaxInterceptor.#instance) {
      AjaxInterceptor.#instance = new AjaxInterceptor(
        AjaxInterceptor.#token,
        options,
      );
    }
    return AjaxInterceptor.#instance;
  }
  private constructor(
    token: Symbol,
    options: AjaxInterceptorCreateInstanceOptions = {},
  ) {
    if (token !== AjaxInterceptor.#token) {
      throw new Error('AjaxInterceptor is a singleton');
    }
    this.xhrInterceptor = new XhrInterceptor();
    this.fetchInterceptor = new FetchInterceptor();
  }

  private toggleInject(type: AjaxType, action: ActionType) {
    switch (type) {
      case AJAX_TYPE.XHR:
        this.xhrInterceptor[action]();
        break;
      case AJAX_TYPE.FETCH:
        this.fetchInterceptor[action]();
        break;
      default:
        this.xhrInterceptor[action]();
        this.fetchInterceptor[action]();
        break;
    }
  }
  public inject(type?: AjaxType) {
    // 环境兼容性检查
    if (typeof window === 'undefined') {
      throw new Error('AjaxInterceptor requires a browser environment');
    }

    if (!window.XMLHttpRequest) {
      console.warn('XMLHttpRequest is not supported in this environment');
    }

    if (!window.fetch) {
      console.warn('Fetch API is not supported in this environment');
    }

    this.toggleInject(type, 'inject');
  }
  public uninject(type?: AjaxType) {
    this.toggleInject(type, 'uninject');
  }
  public hook(fn: HookFunction, type?: AjaxType) {
    switch (type) {
      case AJAX_TYPE.XHR:
        this.xhrInterceptor.hooks.push(fn);
        break;
      case AJAX_TYPE.FETCH:
        this.fetchInterceptor.hooks.push(fn);
        break;
      default:
        this.xhrInterceptor.hooks.push(fn);
        this.fetchInterceptor.hooks.push(fn);
        break;
    }
  }
}

export default AjaxInterceptor;
export { AjaxInterceptor };
