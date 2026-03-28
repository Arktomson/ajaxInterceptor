import type { AjaxType } from './constant';
import type { Writable } from 'type-fest';
export type { AjaxType };

export type ActionType = 'inject' | 'uninject';
interface BaseResponse
  extends Writable<Pick<Response, 'status' | 'statusText'>>,
    Pick<Response, 'headers'> {
  finalUrl: string;
}
export interface XhrResponse
  extends Writable<Pick<XMLHttpRequest, 'response' | 'responseText' | 'responseXML'>> {}

export interface FetchResponse
  extends Pick<Response, 'ok' | 'redirected'> {
  text: string;
  arrayBuffer: ArrayBuffer;
  blob: Blob;
  formData: FormData;
  json: any;
  mockError?: Error | string;
}

export interface AjaxResponse
  extends BaseResponse, Partial<XhrResponse & FetchResponse> {}

export interface StreamChunk {
  text: string; // 解码后的文本
  raw: Uint8Array; // 原始字节数据
  index: number; // 数据块索引
  timestamp: number; // 接收时间戳
}

export interface XhrRequest
  extends Partial<
    Pick<XMLHttpRequest, 'responseType' | 'withCredentials' | 'timeout'>
  > {}

type XhrRequestBody = Document | XMLHttpRequestBodyInit | null;
type FetchRequestBody = BodyInit | null;
export interface AjaxInterceptorRequest extends XhrRequest {
  type: AjaxType;
  method: string;
  url: string;
  headers: Headers;
  data: XhrRequestBody | FetchRequestBody;
  response: (response: AjaxResponse) => void | Promise<void>;
  // 流式响应钩子（可选）
  onStreamChunk?: (
    chunk: StreamChunk,
  ) => string | void | Promise<string | void>;
}

export interface HookFunction {
  (
    request: AjaxInterceptorRequest,
  ): Promise<AjaxInterceptorRequest | void> | AjaxInterceptorRequest | void;
}

export interface AjaxInterceptorCreateInstanceOptions {
  [key: string]: any;
}
