import AjaxHooker from '../index';
import { AjaxResponse } from '../type';
const ajaxInterceptor: AjaxHooker = AjaxHooker.getInstance();
console.log(ajaxInterceptor, 'ajaxInterceptor');

ajaxInterceptor.inject();
let count = 0;

ajaxInterceptor.hook((request) => {
  console.log(`%c${++count} twices-x200 x300111`, 'color: red', request);
  // if (request.url === '/api/outer/ats-apply/website/jobs/v2') {
  //   const body = JSON.parse(request.body as string);
  //   body.keyword = '后端';
  //   request.body = JSON.stringify(body);
  // }

  // request.response = async (response: AjaxResponse) => {
  //   console.log(response, 'response');
  //   if (request.url.includes('/portal/searchHome')) {
  //     const body = JSON.parse(request.body as string);
  //     console.log(request.body, 'req');
  //     if (body.code === 'zjcgCategory103') {
  //       console.log('12');
  //       await new Promise((resolve) => setTimeout(resolve, 500));
  //     }
  //     // const result = JSON.parse(response.response as string);
  //     // console.log(result, 'result');
  //     // result.result.data.children = result.result.data.children?.slice?.(0, 2);
  //     // response.response = JSON.stringify(result);
  //   }
  //   if (request.type === 'fetch') {
  //     console.log(response.headers, 'response.headers');
  //     console.log(response.finalUrl, 'finalUrl');
  //     console.log(`%c fetch Result  new`, 'color: purple', response.json);
  //     const data = response.json.data;
  //     if (data.length > 0) {
  //       data[0].name = '草泥马';
  //     }
  //     response.json.data = data;
  //   }
  // };
  return request;
});