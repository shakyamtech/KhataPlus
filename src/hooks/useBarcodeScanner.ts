import { useEffect, useRef } from 'react';

type UseBarcodeScannerOptions = {
  onScan: (barcode: string) => void;
  latency?: number; // Max time between keystrokes to be considered a scanner
  minLength?: number; // Minimum length of a barcode
};

export const useBarcodeScanner = ({ onScan, latency = 50, minLength = 3 }: UseBarcodeScannerOptions) => {
  const buffer = useRef<string>('');
  const timeoutId = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing inside an input field or textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'Enter') {
        if (buffer.current.length >= minLength) {
          onScan(buffer.current);
          e.preventDefault();
        }
        buffer.current = '';
        if (timeoutId.current) clearTimeout(timeoutId.current);
        return;
      }

      // Only accept printable characters
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        buffer.current += e.key;
        
        if (timeoutId.current) clearTimeout(timeoutId.current);
        
        timeoutId.current = setTimeout(() => {
          buffer.current = ''; // Clear buffer if no keystroke within latency
        }, latency);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (timeoutId.current) clearTimeout(timeoutId.current);
    };
  }, [onScan, latency, minLength]);
};
