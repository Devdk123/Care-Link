import React from 'react';
import { ToastMessage } from '../types';
import { CheckCircle2, Info, AlertCircle, X } from 'lucide-react';

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full">
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success';
        const isError = toast.type === 'error';

        return (
          <div
            key={toast.id}
            className={`p-4 rounded-xl border shadow-lg flex items-start gap-3 transition-all duration-300 animate-in slide-in-from-bottom-5 bg-white ${
              isSuccess
                ? 'border-l-4 border-l-[#10b981] border-[#10b981]/20'
                : isError
                ? 'border-l-4 border-l-[#ba1a1a] border-[#ba1a1a]/20'
                : 'border-l-4 border-l-[#316bf3] border-[#316bf3]/20'
            }`}
          >
            <div className="mt-0.5">
              {isSuccess && <CheckCircle2 className="w-5 h-5 text-[#10b981]" />}
              {isError && <AlertCircle className="w-5 h-5 text-[#ba1a1a]" />}
              {!isSuccess && !isError && <Info className="w-5 h-5 text-[#0051d5]" />}
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-[#191c1e]">{toast.title}</h4>
              <p className="text-xs text-[#43474e] mt-0.5">{toast.message}</p>
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              className="text-[#74777f] hover:text-[#191c1e] p-1 rounded-md transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
