import React, { useRef, useState } from 'react';
import { UploadCloud, FileText, X, AlertCircle } from 'lucide-react';
import { formatFileSize } from '@/utils/formatters';
import { Progress } from '@/components/ui/progress';

interface DocumentUploaderProps {
  onUpload: (file: File) => Promise<void>;
  acceptTypes?: string; // e.g. ".pdf,.jpg,.jpeg,.png,.doc,.docx"
  maxSizeMB?: number;
  className?: string;
}

export const DocumentUploader: React.FC<DocumentUploaderProps> = ({
  onUpload,
  acceptTypes = '.pdf,.jpg,.jpeg,.png,.doc,.docx',
  maxSizeMB = 10,
  className = '',
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(-1); // -1 means idle
  const [error, setError] = useState<string | null>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const validateAndSetFile = (file: File) => {
    setError(null);
    
    // Validate file size
    const sizeInMB = file.size / (1024 * 1024);
    if (sizeInMB > maxSizeMB) {
      setError(`File size exceeds the limit of ${maxSizeMB}MB.`);
      return;
    }

    // Validate type
    const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
    const acceptedList = acceptTypes.split(',').map(t => t.trim().toLowerCase());
    if (acceptTypes && !acceptedList.includes(fileExt) && !acceptedList.some(type => file.type.startsWith(type.replace('*', '')))) {
      setError(`Unsupported file format. Please upload: ${acceptTypes}`);
      return;
    }

    setSelectedFile(file);
    triggerMockUpload(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const triggerMockUpload = async (file: File) => {
    setUploadProgress(0);
    
    // Simulate upload progress
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 90) {
          clearInterval(interval);
          return 90;
        }
        return prev + 15;
      });
    }, 150);

    try {
      await onUpload(file);
      setUploadProgress(100);
      setTimeout(() => {
        setUploadProgress(-1);
        setSelectedFile(null);
      }, 800);
    } catch (e) {
      clearInterval(interval);
      setError('File upload failed. Please try again.');
      setUploadProgress(-1);
    }
  };

  const handleRemoveFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFile(null);
    setUploadProgress(-1);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Drop Zone */}
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
          isDragActive
            ? 'border-brand-navy bg-brand-navy/5 scale-[1.01]'
            : 'border-surface-border hover:border-brand-navy/40 hover:bg-slate-50/50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptTypes}
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="flex flex-col items-center text-center space-y-2.5">
          <div className="p-3 bg-slate-50 border border-surface-border rounded-full text-brand-navy">
            <UploadCloud size={24} />
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary">
              Drag & drop document here, or <span className="text-brand-navy font-bold hover:underline">browse</span>
            </p>
            <p className="text-xs text-text-muted mt-1">
              Supports PDF, PNG, JPG, or DOC (Max {maxSizeMB}MB)
            </p>
          </div>
        </div>

        {isDragActive && (
          <div className="absolute inset-0 bg-brand-navy/5 border border-brand-navy flex items-center justify-center rounded-xl pointer-events-none">
            <p className="text-sm font-semibold text-brand-navy bg-white border px-4 py-2 rounded-lg shadow-md">
              Drop files here
            </p>
          </div>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-[#991B1B] rounded-lg text-xs font-medium">
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Selected File & Progress */}
      {selectedFile && (
        <div className="p-4 border border-[#E2E6ED] bg-white rounded-xl shadow-premium flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 bg-[#F0FDF4] text-[#14532D] rounded-lg">
                <FileText size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-text-primary truncate">
                  {selectedFile.name}
                </p>
                <p className="text-[10px] text-text-muted">
                  {formatFileSize(selectedFile.size / 1024)}
                </p>
              </div>
            </div>
            {uploadProgress === -1 && (
              <button
                onClick={handleRemoveFile}
                className="text-text-muted hover:text-text-primary p-1"
                aria-label="Remove File"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Progress Bar */}
          {uploadProgress >= 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-medium text-text-muted">
                <span>{uploadProgress === 100 ? 'Upload complete' : 'Uploading...'}</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-1.5 bg-slate-100" />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
export default DocumentUploader;
