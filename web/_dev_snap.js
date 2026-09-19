// Dev-only: сфотографировать текущий кадр целиком (канва + DOM-слой UI)
// и отправить на dev-сервер, который положит PNG в web/_snap/.
// Не подключается из index.html — вставляется в консоль вручную.
// Причина существования: скриншот окна в рабочем окружении не снимается,
// а «выглядит нормально» глазами проверить надо.
window.__snap = async function (name) {
  const W = 1600, H = 900;
  const out = document.createElement('canvas');
  out.width = W; out.height = H;
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#0a0a0c';
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(document.getElementById('world'), 0, 0);

  // DOM-слой рисуем через SVG foreignObject: стили страницы надо
  // встроить строкой, внешний <link> внутри такого SVG не подгрузится.
  let css = '';
  for (const sheet of document.styleSheets) {
    try { for (const rule of sheet.cssRules) css += rule.cssText + '\n'; } catch (e) { /* внешний лист */ }
  }
  // XMLSerializer, не .outerHTML: outerHTML — это HTML-сериализация, она
  // честно оставляет void-элементы вроде <br> без закрывающего слэша,
  // а строгий XML внутри SVG на такой строке молча роняет img.onerror
  // (в консоли это выглядит как отказ, а не как понятная ошибка).
  const html = new XMLSerializer().serializeToString(document.getElementById('ui-layer'));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`
    + `<foreignObject width="100%" height="100%">`
    + `<div xmlns="http://www.w3.org/1999/xhtml"><style>${css}</style>${html}</div>`
    + `</foreignObject></svg>`;
  const img = new Image();
  await new Promise((res, rej) => {
    img.onload = res; img.onerror = rej;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
  ctx.drawImage(img, 0, 0);

  const r = await fetch('/_snap', { method: 'POST', body: (name || 'snap') + '\n' + out.toDataURL('image/png') });
  return r.text();
};
