import { AJAX_TYPE } from './constant';

export interface AjaxResponse {
  status: number;
  statusText: string;
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
    'ok' | 'status' | 'statusText' | 'headers' | 'url' | 'redirected'
  > {
}
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
  response: (response: AjaxResponse) => void;
}
interface TypedArray {
  Int8Array: Int8Array;
  Uint8Array: Uint8Array;
  Uint8ClampedArray: Uint8ClampedArray;
  Int16Array: Int16Array;
  Uint16Array: Uint16Array;
  Int32Array: Int32Array;
  Uint32Array: Uint32Array;
  Float32Array: Float32Array;
  Float64Array: Float64Array;
  BigInt64Array: BigInt64Array;
  BigUint64Array: BigUint64Array;
}

