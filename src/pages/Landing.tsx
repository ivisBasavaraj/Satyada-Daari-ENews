import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Newspaper, ArrowRight, Calendar, Search, User, LogOut, Shield } from 'lucide-react';
import Masthead from '@/components/Masthead';
import { Document, Page, pdfjs } from 'react-pdf';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function Landing() {
  const [newspapers, setNewspapers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user, logout } = useAuth();

  useEffect(() => {
    fetchNewspapers();
  }, []);

  const fetchNewspapers = async () => {
    try {
      const res = await fetch('/api/user/newspapers');
      const data = await res.json();
      setNewspapers(data);
    } catch (error) {
      console.error('Error fetching newspapers:', error);
      toast.error('Failed to load newspapers');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col">
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-zinc-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-end items-center gap-4">
          <div className="flex items-center gap-3 md:gap-6 shrink-0">
            {user ? (
              <div className="flex items-center gap-3 md:gap-4">
                {user.role === 'admin' && (
                  <Link to="/admin" className="text-xs md:text-sm font-bold text-zinc-900 flex items-center gap-1 md:gap-1.5 hover:text-zinc-600 transition-colors">
                    <Shield size={14} className="md:w-4 md:h-4" />
                    <span className="hidden xs:inline">ಡ್ಯಾಶ್‌ಬೋರ್ಡ್</span>
                    <span className="xs:hidden">ನಿರ್ವಾಹಕ</span>
                  </Link>
                )}
                <button 
                  onClick={logout}
                  className="text-xs md:text-sm font-medium text-zinc-500 hover:text-zinc-900 flex items-center gap-1 md:gap-1.5 transition-colors"
                >
                  <LogOut size={14} className="md:w-4 md:h-4" />
                  ಲಾಗ್ ಔಟ್
                </button>
              </div>
            ) : (
              <Link to="/admin/login" className="text-xs md:text-sm font-bold text-zinc-900 flex items-center gap-1 md:gap-1.5 hover:text-zinc-600 transition-colors">
                <User size={14} className="md:w-4 md:h-4" />
                ಲಾಗಿನ್
              </Link>
            )}
          </div>
        </div>
      </div>

      <Masthead />
      
      {/* News Grid */}
      <main className="flex-1 max-w-7xl mx-auto px-4 py-6 md:py-10 w-full">
        <div className="flex flex-col md:flex-row justify-between items-center md:items-baseline mb-6 md:mb-8 gap-4">
          <div className="text-center md:text-left">
            <h2 className="text-2xl md:text-3xl font-serif font-bold text-zinc-900 mb-1 md:mb-2">ಇತ್ತೀಚಿನ ಆವೃತ್ತಿಗಳು</h2>
            <div className="h-1 w-16 md:h-1.5 md:w-20 bg-zinc-900 rounded-full mx-auto md:mx-0" />
          </div>
          <div className="text-zinc-500 font-medium flex items-center gap-2 text-sm md:text-base">
            <Calendar size={16} className="md:w-[18px] md:h-[18px]" />
            {new Date().toLocaleDateString('kn-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8 lg:gap-10">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse bg-white rounded-xl md:rounded-2xl border border-zinc-100 p-3 md:p-4 h-[250px] md:h-[350px]" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8 lg:gap-10">
            {newspapers.map((paper) => (
              <Link 
                key={paper.id} 
                to={`/read/${paper.id}`}
                className="group flex flex-col h-full bg-white rounded-xl md:rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500 border border-zinc-200 hover:-translate-y-1"
              >
                <div className="aspect-[16/11] bg-zinc-50 relative overflow-hidden border-b border-zinc-100">
                  <Document
                    file={paper.pdf_path}
                    loading={
                      <div className="absolute inset-0 flex items-center justify-center bg-zinc-50">
                        <div className="w-6 h-6 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin" />
                      </div>
                    }
                    error={
                      <div className="absolute inset-0 flex items-center justify-center bg-zinc-100 text-zinc-400">
                        <Newspaper size={32} strokeWidth={1} />
                      </div>
                    }
                  >
                    <Page
                      pageNumber={1}
                      width={window.innerWidth < 768 ? 250 : 400}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                      className="w-full grayscale group-hover:grayscale-0 transition-all duration-700"
                    />
                  </Document>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute bottom-2 right-2 md:bottom-3 md:right-3 bg-white/90 backdrop-blur-sm px-2 py-1 md:px-3 md:py-1.5 rounded-full text-[9px] md:text-xs font-bold text-zinc-900 shadow-lg translate-y-2 md:translate-y-3 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                    Read Now
                  </div>
                </div>
                
                <div className="p-3 md:p-4 flex flex-col flex-1">
                  <div className="text-[9px] md:text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                    {new Date(paper.publication_date).toLocaleDateString('kn-IN', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </div>
                  <h3 className="font-serif font-bold text-xs md:text-base mb-2 text-zinc-900 leading-tight group-hover:text-zinc-700 transition-colors line-clamp-1">
                    {paper.title}
                  </h3>
                  <div className="mt-auto pt-2 border-t border-zinc-50 flex items-center justify-between text-zinc-900 font-bold text-[9px] md:text-[10px] tracking-wide">
                    Full Edition 
                    <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform duration-300" />
                  </div>
                </div>
              </Link>
            ))}
            
            {newspapers.length === 0 && (
              <div className="col-span-full text-center py-20 md:py-32 bg-white rounded-2xl md:rounded-3xl border border-dashed border-zinc-200">
                <p className="text-zinc-500 text-base md:text-xl font-serif px-4">ಯಾವುದೇ ಆವೃತ್ತಿಗಳು ಕಂಡುಬಂದಿಲ್ಲ.</p>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="bg-zinc-900 text-zinc-500 py-10 md:py-16 px-4">
        <div className="max-w-7xl mx-auto flex flex-col items-center text-center md:text-left md:items-start md:flex-row md:justify-between gap-8 md:gap-12">
          <div className="font-serif text-2xl text-white font-bold">ರಾಯಚೂರು ಬೆಳಕು</div>
          <div className="flex flex-wrap justify-center gap-6 md:gap-8 text-sm font-medium">
            <Link to="/admin/login" className="hover:text-white transition-colors">ನಿರ್ವಾಹಕ ಪ್ರವೇಶ</Link>
            <a href="#" className="hover:text-white transition-colors">ನಮ್ಮ ಬಗ್ಗೆ</a>
            <a href="#" className="hover:text-white transition-colors">ಸಂಪರ್ಕಿಸಿ</a>
          </div>
          <div className="text-xs md:text-sm">
            &copy; {new Date().getFullYear()} ದೈನಂದಿನ ಪತ್ರಿಕೆ. <br className="md:hidden" /> ಎಲ್ಲಾ ಹಕ್ಕುಗಳನ್ನು ಕಾಯ್ದಿರಿಸಲಾಗಿದೆ.
          </div>
        </div>
      </footer>
    </div>
  );
}
