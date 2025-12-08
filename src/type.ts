import { AJAX_TYPE } from "./constant";

export type AjaxType = typeof AJAX_TYPE[keyof typeof AJAX_TYPE];

type TypedArray =
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array
  | BigInt64Array
  | BigUint64Array;
interface BaseResponse {
  status: number;
  statusText: string;
}
export interface XhrResponse {
  response:
    | string
    | number
    | Record<string, any>
    | Blob
    | ArrayBuffer
    | ReadableStream;
  responseText: string;
  responseXML: Document;
}

export interface FetchResponse
  extends Pick<
    Response,
    | "ok"
    | "headers"
    | "url"
    | "redirected"
    | "text"
    | "arrayBuffer"
    | "blob"
    | "formData"
    | "json"
  > {
  bodyUsed: boolean;
}

export interface AjaxResponse
  extends BaseResponse,
    Partial<XhrResponse & FetchResponse> {}
export interface XhrRequest {
  responseType?: string;
}
export interface AjaxInterceptorRequest extends XhrRequest{
  type: (typeof AJAX_TYPE)[keyof typeof AJAX_TYPE];
  method: string;
  url: string | URL;
  headers: Record<string, string> | undefined;
  async?: boolean;
  body:
    | string
    | Record<string, any>
    | FormData
    | URLSearchParams
    | Blob
    | BufferSource
    | ArrayBuffer
    | ReadableStream
    | File
    | TypedArray
    | null;
  response: (response: AjaxResponse) => void
}

export interface HookFunction {
  (request: AjaxInterceptorRequest): void;
}