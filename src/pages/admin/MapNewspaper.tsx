import { useState, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Check, Trash2, ArrowLeft, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import PopupHeader from '@/components/PopupHeader';
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface Article {
  id: string;
  title: string;
  content: string;
  page_number: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface RegionRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface PdfDocumentLike {
  numPages: number;
  getPage: (pageNumber: number) => Promise<any>;
}

export default function MapNewspaper() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, logout } = useAuth();
  const [newspaper, setNewspaper] = useState<any>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [pdfDocument, setPdfDocument] = useState<PdfDocumentLike | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentRect, setCurrentRect] = useState<RegionRect | null>(null);
  const [isSavingArticle, setIsSavingArticle] = useState(false);
  const [, setIsModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [pdfWidth, setPdfWidth] = useState(800);
  const [formData, setFormData] = useState({ title: '', content: '' });

  const pdfWrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchNewspaperData();
  }, [id]);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        // Use more of the available width on mobile (p-2 = 8px each side, so at least 16px)
        const padding = window.innerWidth < 768 ? 20 : 48;
        const rect = containerRef.current.getBoundingClientRect();
        const width = Math.floor(rect.width - padding);
        setPdfWidth(width);
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const fetchNewspaperData = async () => {
    try {
      const res = await fetch(`/api/admin/newspaper/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (res.status === 401) {
        logout();
        navigate('/admin/login');
        throw new Error(data.error || 'Session expired. Please login again');
      }
      if (!res.ok) throw new Error(data.error || 'Failed to load newspaper data');
      setNewspaper(data.newspaper);
      setArticles(data.articles);
    } catch (error) {
      toast.error('Failed to load newspaper data');
    }
  };

  const onDocumentLoadSuccess = (pdf: PdfDocumentLike) => {
    setNumPages(pdf.numPages);
    setPdfDocument(pdf);
  };

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    if (!pdfWrapperRef.current) return { x: 0, y: 0 };
    const rect = pdfWrapperRef.current.getBoundingClientRect();
    
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    return { x, y };
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (isSavingArticle) return;
    if ((e.target as HTMLElement).closest('.article-region')) return;
    
    // Prevent scrolling when drawing on mobile
    if ('touches' in e && e.cancelable) {
      // We can't easily preventDefault on React synthetic events for touchstart if they are passive
      // but the touch-none class on the parent should handle it.
    }

    setIsDrawing(true);
    const { x, y } = getCoordinates(e);
    setStartPos({ x, y });
    setCurrentRect({ x, y, w: 0, h: 0 });
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const { x, y } = getCoordinates(e);
    setCurrentRect({
      x: Math.min(x, startPos.x),
      y: Math.min(y, startPos.y),
      w: Math.abs(x - startPos.x),
      h: Math.abs(y - startPos.y),
    });
  };

  const handleEnd = () => {
    if (!isDrawing || !currentRect) return;
    setIsDrawing(false);
    if (currentRect.w < 1 || currentRect.h < 1) {
      setCurrentRect(null);
      return;
    }
    void handleSaveArticle(currentRect);
  };

  const buildAutoArticleDetails = () => {
    const pageArticleCount = articles.filter((article) => article.page_number === pageNumber).length + 1;

    return {
      title: `Page ${pageNumber} Article ${pageArticleCount}`,
      content: `Mapped article region from page ${pageNumber}`,
    };
  };

  const handleSaveArticle = async (region: RegionRect | null = currentRect) => {
    if (!id || !region) return;

    setIsSavingArticle(true);
    const articleDetails = buildAutoArticleDetails();

    let image_path = null;
    try {
      const canvas = await captureRegionImage(region);
      if (canvas) {
        const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
        const formData = new FormData();
        formData.append('image', blob, `article-${Date.now()}.png`);
        formData.append('newspaper_id', id);
        
        const uploadRes = await fetch(`/api/admin/article-image?newspaper_id=${id}`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        });
        const uploadData = await uploadRes.json();
        if (uploadRes.status === 401) {
          logout();
          navigate('/admin/login');
          throw new Error(uploadData.error || 'Session expired. Please login again');
        }
        image_path = uploadData.image_path;
      }
    } catch (err) {
      console.error('Failed to capture image:', err);
    }

    const newArticle = {
      newspaper_id: id,
      page_number: pageNumber,
      title: articleDetails.title,
      content: articleDetails.content,
      x: region.x,
      y: region.y,
      width: region.w,
      height: region.h,
      image_path,
    };

    try {
      const res = await fetch('/api/admin/article', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(newArticle),
      });
      const responseData = await res.json();
      if (res.status === 401) {
        logout();
        navigate('/admin/login');
        throw new Error(responseData.error || 'Session expired. Please login again');
      }
      
      if (!res.ok) throw new Error(responseData.error || 'Failed to save');
      
      const saved = responseData;
      setArticles([...articles, { ...newArticle, id: saved.id }]);
      setCurrentRect(null);
      toast.success('Region mapped');
    } catch (error) {
      setCurrentRect(null);
      toast.error('Error saving region');
    } finally {
      setIsSavingArticle(false);
    }
  };

  const captureVisibleRegionImage = (region: RegionRect): HTMLCanvasElement | null => {
    if (!pdfWrapperRef.current) return null;

    const pdfCanvas = pdfWrapperRef.current.querySelector('canvas');
    if (!pdfCanvas) return null;

    const x = (region.x / 100) * pdfCanvas.width;
    const y = (region.y / 100) * pdfCanvas.height;
    const w = (region.w / 100) * pdfCanvas.width;
    const h = (region.h / 100) * pdfCanvas.height;

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w));
    canvas.height = Math.max(1, Math.round(h));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(pdfCanvas, x, y, w, h, 0, 0, canvas.width, canvas.height);
    return canvas;
  };

  const captureRegionImage = async (region: RegionRect): Promise<HTMLCanvasElement | null> => {
    if (!pdfDocument) return captureVisibleRegionImage(region);

    try {
      const pdfPage = await pdfDocument.getPage(pageNumber);
      const baseViewport = pdfPage.getViewport({ scale: 1 });
      const regionWidthRatio = Math.max(region.w / 100, 0.12);
      const targetPageWidth = Math.min(5000, Math.max(2600, Math.round(1600 / regionWidthRatio)));
      const renderScale = targetPageWidth / baseViewport.width;
      const viewport = pdfPage.getViewport({ scale: renderScale });

      const sourceCanvas = document.createElement('canvas');
      sourceCanvas.width = Math.max(1, Math.ceil(viewport.width));
      sourceCanvas.height = Math.max(1, Math.ceil(viewport.height));

      const sourceContext = sourceCanvas.getContext('2d', { alpha: false });
      if (!sourceContext) return captureVisibleRegionImage(region);

      sourceContext.imageSmoothingEnabled = true;
      sourceContext.imageSmoothingQuality = 'high';

      await pdfPage.render({
        canvasContext: sourceContext,
        viewport,
      }).promise;

      const x = (region.x / 100) * sourceCanvas.width;
      const y = (region.y / 100) * sourceCanvas.height;
      const w = (region.w / 100) * sourceCanvas.width;
      const h = (region.h / 100) * sourceCanvas.height;

      const croppedCanvas = document.createElement('canvas');
      croppedCanvas.width = Math.max(1, Math.round(w));
      croppedCanvas.height = Math.max(1, Math.round(h));

      const croppedContext = croppedCanvas.getContext('2d');
      if (!croppedContext) return captureVisibleRegionImage(region);

      croppedContext.imageSmoothingEnabled = true;
      croppedContext.imageSmoothingQuality = 'high';
      croppedContext.drawImage(sourceCanvas, x, y, w, h, 0, 0, croppedCanvas.width, croppedCanvas.height);

      return croppedCanvas;
    } catch (error) {
      console.error('Failed high-resolution capture, falling back to visible canvas:', error);
      return captureVisibleRegionImage(region);
    }
  };

  const handleDeleteArticle = async (articleId: string) => {
    try {
      const res = await fetch(`/api/admin/article/${articleId}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (res.status === 401) {
        logout();
        navigate('/admin/login');
        throw new Error(data.error || 'Session expired. Please login again');
      }
      if (!res.ok) throw new Error(data.error || 'Failed to delete region');
      setArticles(articles.filter(a => a.id !== articleId));
      toast.success('Region deleted');
    } catch (error) {
      toast.error('Error deleting region');
    }
  };

  const handlePublish = async () => {
    try {
      const res = await fetch(`/api/admin/publish/${id}`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (res.status === 401) {
        logout();
        navigate('/admin/login');
        throw new Error(data.error || 'Session expired. Please login again');
      }
      if (!res.ok) throw new Error(data.error || 'Failed to publish');
      toast.success('Newspaper published successfully!');
      navigate('/admin');
    } catch (error) {
      toast.error('Failed to publish');
    }
  };

  if (!newspaper) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="h-screen flex flex-col bg-[#F5F5F0]">
      {/* Header */}
      <header className="bg-white border-b border-zinc-200 px-3 md:px-6 py-2 md:py-4 flex items-center justify-between shadow-sm z-20">
        <div className="flex items-center gap-2 md:gap-4 min-w-0">
          <Link to="/admin" className="text-zinc-500 hover:text-zinc-900 shrink-0">
            <ArrowLeft size={18} className="md:w-5 md:h-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="font-serif font-bold text-sm md:text-xl truncate">{newspaper.title}</h1>
            <p className="text-[10px] md:text-xs text-zinc-500 truncate">ಪುಟ {pageNumber} / {numPages}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 md:gap-3">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="lg:hidden p-2 text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"
          >
            <FileText size={18} />
          </button>
          <button 
            onClick={handlePublish}
            className="bg-green-600 text-white px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium hover:bg-green-700 transition-colors flex items-center gap-1.5 md:gap-2 whitespace-nowrap"
          >
            <Check size={14} className="md:w-4 md:h-4" />
            <span>ಪ್ರಕಟಿಸಿ</span>
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Sidebar - Article List */}
        <div className={`
          absolute lg:relative inset-y-0 left-0 w-72 md:w-80 bg-white border-r border-zinc-200 overflow-y-auto p-4 z-30 transition-transform duration-300 transform
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-zinc-900 flex items-center gap-2 text-sm md:text-base">
              <FileText size={18} />
              ಮ್ಯಾಪ್ ಮಾಡಿದ ಲೇಖನಗಳು
            </h3>
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-1 text-zinc-400">
              <ChevronLeft size={20} />
            </button>
          </div>
          
          <div className="space-y-3">
            {articles.filter(a => a.page_number === pageNumber).length === 0 ? (
              <p className="text-xs md:text-sm text-zinc-400 italic">ಈ ಪುಟದಲ್ಲಿ ಮ್ಯಾಪಿಂಗ್ ಇಲ್ಲ.</p>
            ) : (
              articles
                .filter(a => a.page_number === pageNumber)
                .map(article => (
                  <div key={article.id} className="p-2 md:p-3 bg-zinc-50 rounded-lg border border-zinc-100 hover:border-zinc-300 transition-colors group relative">
                    <h4 className="font-medium text-xs md:text-sm text-zinc-900 line-clamp-1">{article.title}</h4>
                    <button 
                      onClick={() => handleDeleteArticle(article.id)}
                      className="absolute top-2 right-2 text-zinc-400 hover:text-red-500 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={12} className="md:w-3.5 md:h-3.5" />
                    </button>
                  </div>
                ))
            )}
          </div>
        </div>

        {/* Sidebar Overlay for Mobile */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/20 z-20 lg:hidden" 
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* PDF Viewer Area */}
        <div ref={containerRef} className="flex-1 bg-[#E4E4E4] p-2 md:p-4 overflow-auto flex flex-col items-center relative touch-none">
          {/* Floating Controls for Mobile/Admin */}
          <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-10 lg:hidden">
            <button 
              onClick={() => setPageNumber(p => Math.max(1, p - 1))}
              disabled={pageNumber <= 1}
              className="w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center text-zinc-600 disabled:opacity-50"
            >
              <ChevronLeft />
            </button>
            <button 
              onClick={() => setPageNumber(p => Math.min(numPages, p + 1))}
              disabled={pageNumber >= numPages}
              className="w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center text-zinc-600 disabled:opacity-50"
            >
              <ChevronRight />
            </button>
          </div>

          <div className="relative shadow-2xl bg-white h-fit mx-auto my-2 md:my-4">
            <Document
              file={newspaper.pdf_path}
              onLoadSuccess={onDocumentLoadSuccess}
              className="pdf-document"
              loading={<div className="p-10 md:p-20 text-zinc-400 text-sm md:text-base">PDF ಲೋಡ್ ಆಗುತ್ತಿದೆ...</div>}
            >
              <div 
                ref={pdfWrapperRef}
                className="relative cursor-crosshair"
                onMouseDown={handleStart}
                onMouseMove={handleMove}
                onMouseUp={handleEnd}
                onMouseLeave={handleEnd}
                onTouchStart={handleStart}
                onTouchMove={handleMove}
                onTouchEnd={handleEnd}
              >
                <Page 
                  pageNumber={pageNumber} 
                  width={pdfWidth} 
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  className="pdf-page"
                />
                
                {/* Existing Regions */}
                {articles
                  .filter(a => a.page_number === pageNumber)
                  .map(article => (
                    <div
                      key={article.id}
                      className="article-region absolute border-2 border-blue-500 bg-blue-500/10 hover:bg-blue-500/20 transition-colors group"
                      style={{
                        left: `${article.x}%`,
                        top: `${article.y}%`,
                        width: `${article.width}%`,
                        height: `${article.height}%`,
                      }}
                    >
                      <button
                        type="button"
                        aria-label={`Delete ${article.title}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDeleteArticle(article.id);
                        }}
                        className="absolute -top-3 -right-3 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white shadow-md transition-opacity hover:bg-red-700 opacity-100 md:opacity-0 md:group-hover:opacity-100"
                      >
                        <Trash2 size={12} />
                      </button>
                      <div className="absolute -top-6 left-0 bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                        {article.title}
                      </div>
                    </div>
                  ))}

                {/* Currently Drawing Region */}
                {currentRect && (
                  <div
                    className="absolute border-2 border-green-500 bg-green-500/20"
                    style={{
                      left: `${currentRect.x}%`,
                      top: `${currentRect.y}%`,
                      width: `${currentRect.w}%`,
                      height: `${currentRect.h}%`,
                    }}
                  />
                )}
              </div>
            </Document>
          </div>
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="hidden lg:flex bg-white border-t border-zinc-200 p-2 md:p-4 justify-center items-center gap-4 md:gap-6 z-10">
        <button
          disabled={pageNumber <= 1}
          onClick={() => setPageNumber(p => p - 1)}
          className="p-1.5 md:p-2 rounded-full hover:bg-zinc-100 disabled:opacity-30 transition-colors"
        >
          <ChevronLeft size={20} className="md:w-6 md:h-6" />
        </button>
        <span className="font-medium text-zinc-700 text-xs md:text-sm">ಪುಟ {pageNumber} / {numPages || '--'}</span>
        <button
          disabled={pageNumber >= numPages}
          onClick={() => setPageNumber(p => p + 1)}
          className="p-1.5 md:p-2 rounded-full hover:bg-zinc-100 disabled:opacity-30 transition-colors"
        >
          <ChevronRight size={20} className="md:w-6 md:h-6" />
        </button>
      </div>

      {/* Modal for adding metadata */}
      {false && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200 overflow-hidden">
            <PopupHeader />
            <div className="p-4 md:p-6">
              <h3 className="text-base md:text-lg font-bold mb-4">ಲೇಖನದ ವಿವರಗಳನ್ನು ಸೇರಿಸಿ</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs md:text-sm font-medium text-zinc-700 mb-1">ಶೀರ್ಷಿಕೆ</label>
                <input
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-zinc-900 outline-none text-sm md:text-base"
                  placeholder="ಶೀರ್ಷಿಕೆಯನ್ನು ನಮೂದಿಸಿ..."
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs md:text-sm font-medium text-zinc-700 mb-1">ವಿಷಯ / ಸಾರಾಂಶ</label>
                <textarea
                  value={formData.content}
                  onChange={e => setFormData({ ...formData, content: e.target.value })}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-zinc-900 outline-none h-24 md:h-32 resize-none text-sm md:text-base"
                  placeholder="ಲೇಖನದ ವಿಷಯವನ್ನು ನಮೂದಿಸಿ..."
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button 
                  onClick={() => { setIsModalOpen(false); setCurrentRect(null); }}
                  className="px-4 py-2 text-zinc-600 hover:bg-zinc-100 rounded-lg text-sm md:text-base"
                >
                  ರದ್ದುಮಾಡಿ
                </button>
                <button 
                  onClick={handleSaveArticle}
                  disabled={!formData.title}
                  className="px-4 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 disabled:opacity-50 text-sm md:text-base"
                >
                  ಮ್ಯಾಪ್ ಉಳಿಸಿ
                </button>
              </div>
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
