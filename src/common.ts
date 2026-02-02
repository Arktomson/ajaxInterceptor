import { AjaxInterceptorRequest, AjaxResponse, HookFunction } from './type';

export class CycleScheduler {
  public req: AjaxInterceptorRequest = {} as AjaxInterceptorRequest;
  public resp: AjaxResponse = {} as AjaxResponse;
  constructor({
    req = {} as AjaxInterceptorRequest,
  }: {
    req?: AjaxInterceptorRequest;
  } = {}) {
    this.req = req;
  }
  async execute(
    request: AjaxInterceptorRequest,
    fnList: HookFunction[],
  ): Promise<AjaxInterceptorRequest> {
    let result = request;
    for (const fn of fnList) {
      const newResult = await fn(result);
      if (newResult) {
        result = newResult;
      }
    }
    return result;
  }
}
