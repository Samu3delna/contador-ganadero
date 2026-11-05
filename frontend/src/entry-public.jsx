import { Suspense } from 'react';
import { StaticRouter, Routes } from 'react-router-dom';
import { renderToPipeableStream } from 'react-dom/server';
import { PassThrough } from 'node:stream';
import { publicRoutes } from './publicRoutes';

export function render(url) {
  return new Promise((resolve, reject) => {
    let html = '';
    const output = new PassThrough();
    output.on('data', chunk => { html += chunk.toString(); });
    output.on('end', () => resolve(html));
    const stream = renderToPipeableStream(<StaticRouter location={url}><Suspense fallback={null}><Routes>{publicRoutes()}</Routes></Suspense></StaticRouter>, {
      onAllReady() { stream.pipe(output); }, onError: reject,
    });
  });
}
