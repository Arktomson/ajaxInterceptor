import { AJAX_TYPE } from './constant';

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
  responseXML: string;
  responseType: string;
}

export interface FetchResponse
  extends Pick<
    Response,
    | 'ok'
    | 'headers'
    | 'url'
    | 'redirected'
    | 'text'
    | 'arrayBuffer'
    | 'blob'
    | 'formData'
    | 'json'
  > {}
export interface FetchBodyUsed {
  bodyUsed: boolean;
}
export interface AjaxResponse
  extends BaseResponse,
    FetchBodyUsed,
    Partial<XhrResponse & FetchResponse> {}
export interface AjaxInterceptorRequest {
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
  response: ((response: AjaxResponse) => void)[];
}
