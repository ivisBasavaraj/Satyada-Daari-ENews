import React from 'react';
import { Link } from 'react-router-dom';

export default function Logo() {
  return (
    <Link to="/" className="block">
      <img 
        src="/header-logo.png" 
        alt="Satyada Dari Logo" 
        className="h-24 md:h-32 w-auto object-contain"
        referrerPolicy="no-referrer"
        onError={(e) => {
          // Fallback if image is missing
          const target = e.target as HTMLImageElement;
          target.style.display = 'none';
          const parent = target.parentElement;
          if (parent) {
            const textLogo = document.createElement('div');
            textLogo.className = 'font-serif font-bold text-4xl tracking-tight text-zinc-900';
            textLogo.innerText = 'ರಾಯಚೂರು ಬೆಳಕು';
            parent.appendChild(textLogo);
          }
        }}
      />
    </Link>
  );
}
