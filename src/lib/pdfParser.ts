import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface ParsedPdfResult {
  title: string;
  author: string;
  publisher?: string;
  language?: string;
  synopsis?: string;
  coverUrl?: string;
  fileSizeBytes: number;
  rawBytes: ArrayBuffer;
  chapters: Array<{
    index: number;
    title: string;
    htmlContent: string;
    wordCount: number;
  }>;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function parsePdfFile(file: File): Promise<ParsedPdfResult> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer.slice(0)) });
  const pdf = await loadingTask.promise;

  let metaTitle = '';
  let metaAuthor = '';
  try {
    const meta = await pdf.getMetadata();
    const info = meta?.info as Record<string, unknown> | undefined;
    if (info) {
      if (typeof info.Title === 'string') metaTitle = info.Title.trim();
      if (typeof info.Author === 'string') metaAuthor = info.Author.trim();
    }
  } catch {
    // Ignore metadata parsing errors
  }

  const fallbackName = file.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim();
  const title = (metaTitle || fallbackName || 'Documento PDF').slice(0, 190);
  const author = (metaAuthor || 'Autor não especificado').slice(0, 130);

  // Render Page 1 cover thumbnail
  let coverUrl: string | undefined;
  try {
    const firstPage = await pdf.getPage(1);
    const baseViewport = firstPage.getViewport({ scale: 1 });
    const scale = Math.min(1.5, 360 / Math.max(1, baseViewport.width));
    const viewport = firstPage.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      await firstPage.render({ canvasContext: ctx, viewport, canvas }).promise;
      const dataUrl = canvas.toDataURL('image/jpeg', 0.78);
      coverUrl = dataUrl.length <= 115000 ? dataUrl : canvas.toDataURL('image/jpeg', 0.55);
    }
  } catch {
    coverUrl = undefined;
  }

  // Extract text content per page for cross-device reflow reading & search excerpts
  const chapters: ParsedPdfResult['chapters'] = [];
  const totalPages = Math.min(pdf.numPages, 400);

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    try {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const items = textContent.items as Array<{ str?: string; hasEOL?: boolean }>;

      const lines: string[] = [];
      let currentLine = '';
      for (const item of items) {
        if (typeof item.str === 'string') {
          currentLine += item.str;
        }
        if (item.hasEOL) {
          if (currentLine.trim()) lines.push(currentLine.trim());
          currentLine = '';
        } else {
          currentLine += ' ';
        }
      }
      if (currentLine.trim()) lines.push(currentLine.trim());

      const joined = lines.join('\n').replace(/\s+\n/g, '\n').trim();
      const paragraphs = joined
        ? joined
            .split(/\n{1,}/)
            .map((p) => p.trim())
            .filter(Boolean)
        : [`Página ${pageNum} (conteúdo gráfico ou imagem).`];

      const htmlContent = paragraphs
        .map((p) => `<p>${escapeHtml(p)}</p>`)
        .join('\n')
        .slice(0, 440000);

      const wordCount = joined ? joined.split(/\s+/).length : 0;

      chapters.push({
        index: pageNum - 1,
        title: `Página ${pageNum}`,
        htmlContent,
        wordCount,
      });
    } catch {
      chapters.push({
        index: pageNum - 1,
        title: `Página ${pageNum}`,
        htmlContent: `<p>Página ${pageNum}</p>`,
        wordCount: 2,
      });
    }
  }

  const pageCount = pdf.numPages;
  await loadingTask.destroy();

  return {
    title,
    author,
    language: 'pt-BR',
    synopsis: `Documento PDF com ${pageCount} ${pageCount === 1 ? 'página' : 'páginas'}.`,
    coverUrl,
    fileSizeBytes: file.size,
    rawBytes: arrayBuffer,
    chapters,
  };
}

export async function loadPdfDocument(bytes: ArrayBuffer) {
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(bytes.slice(0)) });
  const doc = await loadingTask.promise;
  return {
    doc,
    destroy: () => loadingTask.destroy(),
  };
}
