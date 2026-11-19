import JSZip from 'jszip';
import type { Book, BookChapter } from '../types/library';

export interface ParsedEpubResult {
  title: string;
  author: string;
  publisher?: string;
  language?: string;
  synopsis?: string;
  coverUrl?: string;
  fileSizeBytes: number;
  chapters: Array<{
    index: number;
    title: string;
    htmlContent: string;
    wordCount: number;
  }>;
}

function resolvePath(baseDir: string, relativePath: string): string {
  const cleanRel = decodeURIComponent(relativePath.split('#')[0]).replace(/^\.\//, '');
  if (!baseDir) return cleanRel;
  const parts = (baseDir + '/' + cleanRel).split('/');
  const resolved: string[] = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') {
      resolved.pop();
    } else {
      resolved.push(part);
    }
  }
  return resolved.join('/');
}

function getZipFileCaseInsensitive(zip: JSZip, targetPath: string): JSZip.JSZipObject | null {
  const direct = zip.file(targetPath);
  if (direct) return direct;
  const lower = targetPath.toLowerCase();
  for (const name of Object.keys(zip.files)) {
    if (name.toLowerCase() === lower) {
      return zip.file(name);
    }
  }
  return null;
}

function sanitizeChapterHtml(rawHtml: string, fallbackTitle: string): {
  title: string;
  html: string;
  wordCount: number;
} {
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml, 'text/html');

  // Extract heading title if present
  const heading = doc.querySelector('h1, h2, h3, title');
  const extractedTitle = heading?.textContent?.trim() || fallbackTitle;

  // Strip scripts, styles, iframes, objects, and inline event handlers
  doc
    .querySelectorAll('script, style, link, meta, iframe, object, embed, form, input')
    .forEach((el) => el.remove());

  const body = doc.body || doc.documentElement;
  body.querySelectorAll('*').forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      if (attr.name.startsWith('on') || attr.name === 'style' || attr.name === 'class') {
        el.removeAttribute(attr.name);
      }
      if (attr.name === 'href' && attr.value.trim().toLowerCase().startsWith('javascript:')) {
        el.removeAttribute('href');
      }
    }
  });

  const cleanHtml = body.innerHTML.trim() || `<p>${body.textContent?.trim() || ''}</p>`;
  const textContent = (body.textContent || '').replace(/\s+/g, ' ').trim();
  const wordCount = textContent ? textContent.split(' ').length : 0;

  return {
    title: extractedTitle.slice(0, 220),
    html: cleanHtml.slice(0, 440000),
    wordCount,
  };
}

async function compressImageToDataUrl(blob: Blob, maxWidth = 360): Promise<string | undefined> {
  try {
    const objectUrl = URL.createObjectURL(blob);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = objectUrl;
    });
    URL.revokeObjectURL(objectUrl);

    const scale = Math.min(1, maxWidth / (img.width || maxWidth));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.78);
    return dataUrl.length <= 115000 ? dataUrl : canvas.toDataURL('image/jpeg', 0.55);
  } catch {
    return undefined;
  }
}

export async function parseEpubFile(file: File): Promise<ParsedEpubResult> {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  // 1. Locate OPF via META-INF/container.xml
  const containerFile = getZipFileCaseInsensitive(zip, 'META-INF/container.xml');
  let opfPath = '';
  if (containerFile) {
    const containerXml = await containerFile.async('text');
    const xmlDoc = new DOMParser().parseFromString(containerXml, 'application/xml');
    const rootfile = xmlDoc.querySelector('rootfile');
    opfPath = rootfile?.getAttribute('full-path') || '';
  }

  if (!opfPath) {
    const foundOpf = Object.keys(zip.files).find((f) => f.toLowerCase().endsWith('.opf'));
    if (!foundOpf) {
      throw new Error('Arquivo ePub inválido: manifesto .opf não encontrado.');
    }
    opfPath = foundOpf;
  }

  const opfFile = getZipFileCaseInsensitive(zip, opfPath);
  if (!opfFile) {
    throw new Error('Não foi possível ler o manifesto OPF deste arquivo ePub.');
  }

  const opfBaseDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/')) : '';
  const opfXmlText = await opfFile.async('text');
  const opfDoc = new DOMParser().parseFromString(opfXmlText, 'application/xml');

  const getMetaText = (selector: string): string => {
    const el = opfDoc.querySelector(selector);
    return el?.textContent?.trim() || '';
  };

  const fallbackName = file.name.replace(/\.epub$/i, '').replace(/[_-]+/g, ' ').trim();
  const title = (getMetaText('metadata > title, dc\\:title, title') || fallbackName || 'Livro sem título').slice(0, 190);
  const author = (getMetaText('metadata > creator, dc\\:creator, creator') || 'Autor desconhecido').slice(0, 130);
  const publisher = getMetaText('metadata > publisher, dc\\:publisher, publisher').slice(0, 130) || undefined;
  const language = getMetaText('metadata > language, dc\\:language, language').slice(0, 20) || 'pt-BR';
  const rawDescription = getMetaText('metadata > description, dc\\:description, description');
  const synopsis = rawDescription
    ? rawDescription.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1900)
    : undefined;

  // 2. Build Manifest Map
  const manifestItems = new Map<string, { href: string; mediaType: string; properties: string }>();
  opfDoc.querySelectorAll('manifest > item').forEach((item) => {
    const id = item.getAttribute('id');
    const href = item.getAttribute('href');
    if (id && href) {
      manifestItems.set(id, {
        href,
        mediaType: item.getAttribute('media-type') || '',
        properties: item.getAttribute('properties') || '',
      });
    }
  });

  // 3. Extract Cover Image
  let coverUrl: string | undefined;
  const coverMeta = opfDoc.querySelector('metadata > meta[name="cover"]');
  const coverIdFromMeta = coverMeta?.getAttribute('content');
  let coverHref: string | undefined;

  if (coverIdFromMeta && manifestItems.has(coverIdFromMeta)) {
    coverHref = manifestItems.get(coverIdFromMeta)?.href;
  }
  if (!coverHref) {
    for (const [id, item] of manifestItems.entries()) {
      if (
        item.properties.includes('cover-image') ||
        (item.mediaType.startsWith('image/') && id.toLowerCase().includes('cover'))
      ) {
        coverHref = item.href;
        break;
      }
    }
  }
  if (coverHref) {
    const resolvedCoverPath = resolvePath(opfBaseDir, coverHref);
    const coverFile = getZipFileCaseInsensitive(zip, resolvedCoverPath);
    if (coverFile) {
      const blob = await coverFile.async('blob');
      coverUrl = await compressImageToDataUrl(blob);
    }
  }

  // 4. Parse TOC (NCX or NAV) for friendly chapter titles
  const tocTitles = new Map<string, string>();
  const ncxItem = Array.from(manifestItems.values()).find((i) =>
    i.mediaType.includes('ncx') || i.href.toLowerCase().endsWith('.ncx')
  );
  if (ncxItem) {
    const ncxPath = resolvePath(opfBaseDir, ncxItem.href);
    const ncxFile = getZipFileCaseInsensitive(zip, ncxPath);
    if (ncxFile) {
      const ncxText = await ncxFile.async('text');
      const ncxDoc = new DOMParser().parseFromString(ncxText, 'application/xml');
      ncxDoc.querySelectorAll('navPoint').forEach((pt) => {
        const label = pt.querySelector('navLabel > text')?.textContent?.trim();
        const src = pt.querySelector('content')?.getAttribute('src');
        if (label && src) {
          const cleanSrc = resolvePath(opfBaseDir, src.split('#')[0]);
          if (!tocTitles.has(cleanSrc)) {
            tocTitles.set(cleanSrc, label);
          }
        }
      });
    }
  }

  // 5. Read Spine Order
  const spineRefs: string[] = [];
  opfDoc.querySelectorAll('spine > itemref').forEach((ref) => {
    const idref = ref.getAttribute('idref');
    if (idref) spineRefs.push(idref);
  });

  const chapters: ParsedEpubResult['chapters'] = [];
  let chapterIdx = 0;

  for (const idref of spineRefs) {
    const item = manifestItems.get(idref);
    if (!item) continue;
    const isHtml =
      item.mediaType.includes('html') ||
      /\.(xhtml|html|htm)$/i.test(item.href);
    if (!isHtml) continue;

    const fullPath = resolvePath(opfBaseDir, item.href);
    const chapterFile = getZipFileCaseInsensitive(zip, fullPath);
    if (!chapterFile) continue;

    const rawHtml = await chapterFile.async('text');
    const fallbackTitle = tocTitles.get(fullPath) || `Capítulo ${chapterIdx + 1}`;
    const cleaned = sanitizeChapterHtml(rawHtml, fallbackTitle);

    // Skip nearly empty cover/spine stubs unless it's the only content
    if (cleaned.wordCount < 3 && spineRefs.length > 1 && chapterIdx === 0 && /cover/i.test(item.href)) {
      continue;
    }

    chapters.push({
      index: chapterIdx,
      title: tocTitles.get(fullPath) || cleaned.title || `Capítulo ${chapterIdx + 1}`,
      htmlContent: cleaned.html,
      wordCount: cleaned.wordCount,
    });
    chapterIdx++;
  }

  if (chapters.length === 0) {
    throw new Error('Nenhum capítulo legível encontrado dentro do arquivo ePub.');
  }

  return {
    title,
    author,
    publisher,
    language,
    synopsis,
    coverUrl,
    fileSizeBytes: file.size,
    chapters,
  };
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function exportBookAsEpub(book: Book, chapters: BookChapter[]): Promise<Blob> {
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
  );

  const sorted = [...chapters].sort((a, b) => a.index - b.index);
  const manifestLines: string[] = [
    `<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>`,
  ];
  const spineLines: string[] = [];
  const navPoints: string[] = [];

  sorted.forEach((ch, idx) => {
    const fileName = `chapter_${idx + 1}.xhtml`;
    const id = `chap_${idx + 1}`;
    manifestLines.push(`<item id="${id}" href="${fileName}" media-type="application/xhtml+xml"/>`);
    spineLines.push(`<itemref idref="${id}"/>`);
    navPoints.push(`
    <navPoint id="navPoint-${idx + 1}" playOrder="${idx + 1}">
      <navLabel><text>${escapeXml(ch.title)}</text></navLabel>
      <content src="${fileName}"/>
    </navPoint>`);

    zip.file(
      `OEBPS/${fileName}`,
      `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="${escapeXml(book.language || 'pt-BR')}">
  <head>
    <title>${escapeXml(ch.title)}</title>
  </head>
  <body>
    <h1>${escapeXml(ch.title)}</h1>
    ${ch.htmlContent}
  </body>
</html>`
    );
  });

  zip.file(
    'OEBPS/toc.ncx',
    `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${escapeXml(book.id)}"/>
  </head>
  <docTitle><text>${escapeXml(book.title)}</text></docTitle>
  <navMap>${navPoints.join('\n')}
  </navMap>
</ncx>`
  );

  zip.file(
    'OEBPS/content.opf',
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${escapeXml(book.title)}</dc:title>
    <dc:creator>${escapeXml(book.author)}</dc:creator>
    <dc:language>${escapeXml(book.language || 'pt-BR')}</dc:language>
    ${book.publisher ? `<dc:publisher>${escapeXml(book.publisher)}</dc:publisher>` : ''}
    ${book.synopsis ? `<dc:description>${escapeXml(book.synopsis)}</dc:description>` : ''}
    <dc:identifier id="BookId">${escapeXml(book.id)}</dc:identifier>
  </metadata>
  <manifest>
    ${manifestLines.join('\n    ')}
  </manifest>
  <spine toc="ncx">
    ${spineLines.join('\n    ')}
  </spine>
</package>`
  );

  return zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' });
}
