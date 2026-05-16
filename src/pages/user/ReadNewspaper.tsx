import { useEffect, useRef, useState } from 'react';
import { Document, Page } from 'react-pdf';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, ChevronLeft, ChevronRight, Download, X, ZoomIn, ZoomOut } from 'lucide-react';
import popupHeaderImage from '@/components/image.png';
import { getPublishedNewspaperById, type Article, type NewspaperRecord } from '@/lib/staticArchive';

const getInitialPageWidth = () => {
  if (typeof window === 'undefined') return 800;
  return Math.max(280, window.innerWidth - 8);
};

export default function ReadNewspaper() {
  const { id } = useParams();
  const [newspaper, setNewspaper] = useState<NewspaperRecord | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [scale, setScale] = useState(1.0);
  const [imageZoom, setImageZoom] = useState(1);
  const [pageWidth, setPageWidth] = useState(getInitialPageWidth);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const viewerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPageNumber(1);
    setSelectedArticle(null);
    void fetchNewspaperData();
  }, [id]);

  useEffect(() => {
    const element = viewerRef.current;
    if (!element || typeof window === 'undefined') return;

    const updateWidth = () => {
      const isMobile = window.innerWidth < 768;
      const padding = isMobile ? 8 : 32;
      const availableWidth = isMobile ? window.innerWidth : element.getBoundingClientRect().width;
      const nextWidth = Math.max(280, Math.floor(availableWidth - padding));
      setPageWidth(nextWidth);
    };

    updateWidth();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateWidth);
    observer?.observe(element);
    window.addEventListener('resize', updateWidth);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, []);

  const fetchNewspaperData = async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      if (!id) {
        throw new Error('Missing newspaper id');
      }

      const data = await getPublishedNewspaperById(id);
      if (!data) {
        throw new Error('Newspaper not found');
      }

      setNewspaper(data);
      setArticles(data.articles);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load newspaper';
      console.error('Error fetching newspaper:', error);
      setNewspaper(null);
      setArticles([]);
      setLoadError(message);
      toast.error('Failed to load newspaper');
    } finally {
      setIsLoading(false);
    }
  };

  const onDocumentLoadSuccess = ({ numPages: totalPages }: { numPages: number }) => {
    setNumPages(totalPages);
  };

  const loadImage = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
      img.src = src;
    });

  const handleDownloadWithHeader = async (article: Article) => {
    if (!article.image_path) return;

    try {
      const [headerImg, mappedImg] = await Promise.all([
        loadImage(popupHeaderImage),
        loadImage(article.image_path),
      ]);

      const outputWidth = Math.max(headerImg.naturalWidth, mappedImg.naturalWidth);
      const headerHeight = Math.max(
        1,
        Math.round((headerImg.naturalHeight / headerImg.naturalWidth) * outputWidth),
      );
      const mappedHeight = Math.max(
        1,
        Math.round((mappedImg.naturalHeight / mappedImg.naturalWidth) * outputWidth),
      );

      const canvas = document.createElement('canvas');
      canvas.width = outputWidth;
      canvas.height = headerHeight + mappedHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas unavailable');

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(headerImg, 0, 0, outputWidth, headerHeight);
      ctx.drawImage(mappedImg, 0, headerHeight, outputWidth, mappedHeight);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((result) => {
          if (result) {
            resolve(result);
            return;
          }
          reject(new Error('Failed to create image'));
        }, 'image/png');
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `mapped-area-with-header-${article.id}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      toast.error('Failed to download image with header');
    }
  };

  if (isLoading) {
    return <div className="h-screen flex items-center justify-center text-zinc-400">Loading archive...</div>;
  }

  if (!newspaper) {
    return (
      <div className="min-h-screen bg-[#111111] text-white flex flex-col items-center justify-center px-6 text-center">
        <h1 className="font-serif text-3xl font-bold mb-3">Edition unavailable</h1>
        <p className="text-zinc-400 max-w-md mb-6">
          {loadError || 'This newspaper could not be loaded from the static archive.'}
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-bold text-black hover:bg-zinc-200 transition-colors"
        >
          <ArrowLeft size={16} />
          Back to archive
        </Link>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#2A2A2A] text-white overflow-hidden">
      <header className="bg-[#1A1A1A] border-b border-zinc-800 px-3 md:px-6 py-2 md:py-3 flex items-center justify-between shadow-md z-20">
        <div className="flex items-center gap-2 md:gap-4 min-w-0">
          <Link to="/" className="text-zinc-400 hover:text-white transition-colors shrink-0">
            <ArrowLeft size={18} className="md:w-5 md:h-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="font-serif font-bold text-xs md:text-xl text-zinc-100 truncate">{newspaper.title}</h1>
            <p className="text-[9px] md:text-xs text-zinc-500 truncate">
              {new Date(newspaper.publication_date).toLocaleDateString('en-IN')} • Page {pageNumber}/{numPages}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4 shrink-0">
          <div className="flex items-center bg-zinc-800 rounded-lg p-0.5">
            <button
              onClick={() => setScale((value) => Math.max(0.5, value - 0.1))}
              className="px-1.5 md:px-3 py-1 hover:bg-zinc-700 rounded text-[10px] md:text-sm"
            >
              -
            </button>
            <span className="px-1 md:px-2 text-[9px] md:text-xs text-zinc-400 min-w-[28px] md:min-w-[40px] text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() => setScale((value) => Math.min(2.0, value + 0.1))}
              className="px-1.5 md:px-3 py-1 hover:bg-zinc-700 rounded text-[10px] md:text-sm"
            >
              +
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative min-w-0">
        <div
          ref={viewerRef}
          className="flex-1 overflow-auto flex flex-col items-center p-1 md:p-2 bg-[#2A2A2A] touch-none w-full min-w-0"
        >
          <div
            className="relative shadow-2xl transition-transform duration-200 origin-top mt-0 mb-12"
            style={{ transform: `scale(${scale})` }}
          >
            <Document
              file={newspaper.pdf_path}
              onLoadSuccess={onDocumentLoadSuccess}
              className="pdf-document"
              loading={<div className="text-zinc-500 p-20">Loading PDF...</div>}
            >
              <div className="relative">
                <Page
                  pageNumber={pageNumber}
                  width={pageWidth}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  className="pdf-page shadow-2xl"
                />

                <div className="absolute inset-0 pointer-events-none">
                  {articles
                    .filter((article) => article.page_number === pageNumber)
                    .map((article) => (
                      <button
                        key={article.id}
                        onClick={() => {
                          setSelectedArticle(article);
                          setImageZoom(1);
                        }}
                        className="absolute hover:bg-yellow-400/20 hover:border-yellow-400/50 border-2 border-transparent transition-all cursor-pointer group pointer-events-auto z-10"
                        style={{
                          left: `${article.x}%`,
                          top: `${article.y}%`,
                          width: `${article.width}%`,
                          height: `${article.height}%`,
                        }}
                      >
                        <span className="sr-only">Open {article.title}</span>
                      </button>
                    ))}
                </div>
              </div>
            </Document>
          </div>
        </div>

        {selectedArticle && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[120] p-0 md:p-6 animate-in fade-in duration-200">
            <div className="w-full max-w-6xl h-full md:h-auto md:max-h-[92vh] bg-[#111111] text-white md:rounded-2xl shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] border-0 md:border border-zinc-800 flex flex-col overflow-hidden">
              <div className="bg-[#1A1A1A]/95 backdrop-blur-md px-4 py-3 border-b border-zinc-800 flex items-center justify-between gap-4 sticky top-0 z-10">
                <div className="flex flex-col min-w-0">
                  <h2 className="font-serif font-bold text-base md:text-lg leading-tight truncate text-zinc-100">
                    {selectedArticle.title}
                  </h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">
                      Page {selectedArticle.page_number}
                    </span>
                    <span className="text-[10px] text-zinc-500">•</span>
                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-medium">
                      {newspaper.title}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="hidden sm:flex items-center bg-zinc-900/50 rounded-full border border-zinc-800 p-1">
                    <button
                      onClick={() => setImageZoom((value) => Math.max(0.5, Number((value - 0.2).toFixed(2))))}
                      className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                      title="Zoom out"
                    >
                      <ZoomOut size={16} />
                    </button>
                    <span className="text-[11px] font-mono text-zinc-500 min-w-[45px] text-center">
                      {Math.round(imageZoom * 100)}%
                    </span>
                    <button
                      onClick={() => setImageZoom((value) => Math.min(3, Number((value + 0.2).toFixed(2))))}
                      className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                      title="Zoom in"
                    >
                      <ZoomIn size={16} />
                    </button>
                  </div>

                  {selectedArticle.image_path && (
                    <button
                      onClick={() => handleDownloadWithHeader(selectedArticle)}
                      className="h-9 px-4 rounded-full bg-white text-black hover:bg-zinc-200 text-xs font-bold transition-all flex items-center gap-2 active:scale-95 shadow-lg shadow-white/5"
                    >
                      <Download size={14} />
                      <span className="hidden xs:inline">Save</span>
                    </button>
                  )}

                  <button
                    onClick={() => setSelectedArticle(null)}
                    className="w-9 h-9 flex items-center justify-center rounded-full bg-zinc-800 hover:bg-red-500/20 hover:text-red-500 text-zinc-400 transition-all border border-zinc-700/50"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="flex-1 flex flex-col overflow-hidden bg-[#0A0A0A]">
                <div className="flex-1 overflow-auto bg-black flex items-start justify-center p-4 md:p-8 custom-scrollbar">
                  {selectedArticle.image_path ? (
                    <div
                      className="relative group/img cursor-zoom-in"
                      onClick={() => setImageZoom((value) => (value === 1 ? 1.5 : 1))}
                    >
                      <img
                        src={selectedArticle.image_path}
                        alt={selectedArticle.title}
                        className="max-w-full h-auto shadow-2xl transition-transform duration-300 ease-out rounded-sm"
                        style={{ transform: `scale(${imageZoom})`, transformOrigin: 'top center' }}
                      />
                    </div>
                  ) : (
                    <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-zinc-600 space-y-4">
                      <div className="p-4 rounded-full bg-zinc-900">
                        <X size={32} />
                      </div>
                      <p className="text-sm font-medium">No mapped image available</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-[#1A1A1A] border-t border-zinc-800 p-3 md:p-4 flex justify-center items-center gap-4 md:gap-8 z-20">
        <button
          disabled={pageNumber <= 1}
          onClick={() => setPageNumber((value) => value - 1)}
          className="p-2 md:p-3 rounded-full hover:bg-zinc-800 disabled:opacity-30 text-white transition-colors border border-zinc-700"
        >
          <ChevronLeft size={20} className="md:w-6 md:h-6" />
        </button>
        <span className="font-medium text-xs md:text-sm text-zinc-400 min-w-[80px] md:min-w-[100px] text-center">
          Page {pageNumber} / {numPages || '--'}
        </span>
        <button
          disabled={pageNumber >= numPages}
          onClick={() => setPageNumber((value) => value + 1)}
          className="p-2 md:p-3 rounded-full hover:bg-zinc-800 disabled:opacity-30 text-white transition-colors border border-zinc-700"
        >
          <ChevronRight size={20} className="md:w-6 md:h-6" />
        </button>
      </div>
    </div>
  );
}
