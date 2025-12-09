import type { AjaxType } from "./constant";
export type { AjaxType };

interface BaseResponse {
  status: number;
  statusText: string;
  headers: Headers;
  finalUrl: string;
}
export interface XhrResponse {
  response:
    | string
    | Record<string, any>
    | Blob
    | ArrayBuffer
    | Document
}

export interface FetchResponse 
  // extends Pick<
  //   Response,
  //   | "ok"
  //   | "redirected"
  //   | "text"
  //   | "arrayBuffer"
  //   | "blob"
  //   | "formData"
  //   | "json"
  // > 
  {
  bodyUsed: boolean;
  ok: boolean;
  redirected: boolean;
  text: string;
  arrayBuffer: ArrayBuffer;
  blob: Blob;
  formData: FormData;
  json: any;
}

export interface AjaxResponse
  extends BaseResponse,
    Partial<XhrResponse & FetchResponse> {}
export interface XhrRequest {
  async?: boolean;
}
  
type XhrRequestBody = Document | XMLHttpRequestBodyInit | null
export interface AjaxInterceptorRequest extends XhrRequest{
  type: AjaxType;
  method: string;
  url: string;
  headers: Record<string, string>;
  body: XhrRequestBody | BodyInit
  response: (response: AjaxResponse) => void
}

export interface HookFunction {
  (request: AjaxInterceptorRequest): void;
}