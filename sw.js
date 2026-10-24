'use strict';

const PREFIXO_CACHE = 'fornecedores-';
const VERSAO = 'fornecedores-v16';
const CASCA = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icons/icone-32.png',
  './icons/icone-180.png',
  './icons/icone-192.png',
  './icons/icone-512.png',
  './icons/icone-maskavel-512.png'
];

self.addEventListener('install', evento => {
  evento.waitUntil(
    caches.open(VERSAO)
      .then(cache => cache.addAll(CASCA))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', evento => {
  evento.waitUntil(
    caches.keys()
      .then(chaves => Promise.all(chaves.filter(chave => chave.startsWith(PREFIXO_CACHE) && chave !== VERSAO).map(chave => caches.delete(chave))))
      .then(() => self.clients.claim())
  );
});

async function guardarNaCasca(requisicao, resposta) {
  try {
    const cache = await caches.open(VERSAO);
    await cache.put(requisicao, resposta.clone());
  } catch {}
}

self.addEventListener('fetch', evento => {
  const requisicao = evento.request;
  if (requisicao.method !== 'GET') return;
  const endereco = new URL(requisicao.url);

  if (requisicao.mode === 'navigate') {
    evento.respondWith(
      caches.open(VERSAO).then(async cache => {
        const guardada = await cache.match('./index.html', { ignoreSearch: true });
        try {
          const resposta = await fetch(requisicao);
          return resposta.ok ? resposta : (guardada || resposta);
        } catch {
          return guardada || Response.error();
        }
      })
    );
    return;
  }

  const mesmaOrigem = endereco.origin === self.location.origin;
  const ehFonte = endereco.hostname === 'fonts.googleapis.com' || endereco.hostname === 'fonts.gstatic.com';

  if (mesmaOrigem) {
    evento.respondWith(
      caches.open(VERSAO).then(async cache => {
        const guardada = await cache.match(requisicao);
        try {
          const resposta = await fetch(requisicao);
          if (resposta && resposta.ok) {
            guardarNaCasca(requisicao, resposta);
            return resposta;
          }
          return guardada || resposta;
        } catch {
          return guardada || Response.error();
        }
      })
    );
    return;
  }

  if (ehFonte) {
    evento.respondWith(
      caches.match(requisicao).then(resposta => {
        const atualizacao = fetch(requisicao)
          .then(nova => {
            if (nova && (nova.ok || nova.type === 'opaque')) guardarNaCasca(requisicao, nova);
            return nova;
          })
          .catch(() => resposta);
        return resposta || atualizacao;
      })
    );
  }
});
