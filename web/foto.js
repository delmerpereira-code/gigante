/* ============================================================================
 *  foto.js — Reduz uma imagem escolhida para ~maxPx e devolve um data URL JPEG.
 *  Usado no cadastro pessoal e no cadastro completo.
 * ==========================================================================*/
(function (root) {
  'use strict';

  function reduzirImagem(file, maxPx, cb) {
    maxPx = maxPx || 220;
    if (!file || !/^image\//.test(file.type)) { cb(new Error('Selecione um arquivo de imagem.')); return; }
    var fr = new FileReader();
    fr.onerror = function () { cb(new Error('Não foi possível ler o arquivo.')); };
    fr.onload = function () {
      var img = new Image();
      img.onerror = function () { cb(new Error('Imagem inválida.')); };
      img.onload = function () {
        var escala = Math.min(1, maxPx / Math.max(img.width, img.height));
        var w = Math.round(img.width * escala), h = Math.round(img.height * escala);
        var c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        try {
          cb(null, c.toDataURL('image/jpeg', 0.72));
        } catch (e) { cb(new Error('Falha ao processar a imagem.')); }
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  }

  root.Foto = { reduzir: reduzirImagem };
})(typeof globalThis !== 'undefined' ? globalThis : this);
