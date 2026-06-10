import React, { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import {
  FileText,
  FileImage,
  FileSpreadsheet,
  Search,
  Grid,
  List as ListIcon,
  Upload,
  Download,
  Trash2,
  FolderOpen,
  Tag,
  Loader2,
  MoreVertical,
  Edit,
  Move,
  Plus,
  ArrowRight,
} from 'lucide-react';

import {
  useDocuments,
  useDocumentUploadUrl,
  useCreateDocument,
  useUpdateDocument,
  useDeleteDocument,
} from '@/api/documents';
import { usePayments } from '@/api/payments';
import { useObligations } from '@/api/obligations';

import { formatFileSize } from '@/utils/formatters';
import { uploadToR2 } from '@/utils/upload';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Metadata Validation Schema
const docMetaSchema = z.object({
  label: z.string().min(1, 'Label is required.').max(150),
  category: z.enum(['income_tax', 'property', 'gst', 'vehicle', 'other']),
  financial_year: z.string().regex(/^\d{4}-\d{2}$/, 'Format must be YYYY-YY (e.g. 2024-25)').optional(),
  tags: z.string().transform((val) => val.split(',').map(t => t.trim()).filter(Boolean)),
});

type DocMetaFormInputs = z.infer<typeof docMetaSchema>;

const categories = [
  { id: 'income_tax', label: 'Income Tax' },
  { id: 'property', label: 'Property & Land' },
  { id: 'gst', label: 'GST' },
  { id: 'vehicle', label: 'Vehicle' },
  { id: 'other', label: 'Other' },
];

export const DocumentsPage: React.FC = () => {
  // Queries
  const { data: documents = [], isLoading } = useDocuments();
  const { data: payments = [] } = usePayments();
  const { data: obligations = [] } = useObligations();

  // Mutations
  const getUploadUrlMutation = useDocumentUploadUrl();
  const createDocMutation = useCreateDocument();
  const updateDocMutation = useUpdateDocument();
  const deleteDocMutation = useDeleteDocument();

  // Component UI States
  const [activeTab, setActiveTab] = useState('library');
  const [selectedCategory, setSelectedCategory] = useState<string>('income_tax');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Drag & drop metadata form states
  const [isDragging, setIsDragging] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  // Edit / Action States
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);

  // Form Hooks
  const {
    register: regMeta,
    handleSubmit: handleMetaSubmit,
    setValue: setMetaValue,
    formState: { errors: metaErrors },
    reset: resetMetaForm,
  } = useForm<DocMetaFormInputs>({
    resolver: zodResolver(docMetaSchema),
    defaultValues: { tags: [] }
  });

  const {
    register: regEdit,
    handleSubmit: handleEditSubmit,
    setValue: setEditValue,
    formState: { errors: editErrors },
    reset: resetEditForm,
  } = useForm<DocMetaFormInputs>({
    resolver: zodResolver(docMetaSchema),
  });

  // Calculate file counts per category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      income_tax: 0,
      property: 0,
      gst: 0,
      vehicle: 0,
      other: 0,
    };
    documents.forEach((d) => {
      if (!d.is_attachment && counts[d.category] !== undefined) {
        counts[d.category]++;
      }
    });
    return counts;
  }, [documents]);

  // Filter Library documents
  const filteredLibraryDocs = useMemo(() => {
    return documents.filter((d) => {
      if (d.is_attachment) return false;
      const matchesCategory = d.category === selectedCategory;
      const matchesSearch =
        d.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())) ||
        d.financial_year?.includes(searchQuery);

      return matchesCategory && matchesSearch;
    });
  }, [documents, selectedCategory, searchQuery]);

  // Group Attachment documents by obligation
  const groupedAttachments = useMemo(() => {
    const attachments = documents.filter((d) => d.is_attachment);
    const groups: Record<string, typeof attachments> = {};

    attachments.forEach((d) => {
      const groupName = d.attached_to_name || 'General Receipts';
      if (!groups[groupName]) {
        groups[groupName] = [];
      }
      groups[groupName].push(d);
    });

    return groups;
  }, [documents]);

  // Drag & drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setupUploadModal(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setupUploadModal(e.target.files[0]);
    }
  };

  const setupUploadModal = (file: File) => {
    setPendingFile(file);
    resetMetaForm({
      label: file.name.split('.')[0] || 'Uploaded Document',
      category: selectedCategory as any,
      financial_year: '2025-26',
      tags: [],
    });
    setUploadModalOpen(true);
  };

  const executeUpload = async (data: DocMetaFormInputs) => {
    if (!pendingFile) return;
    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Step 1: get pre-signed upload URL
      const res = await getUploadUrlMutation.mutateAsync();
      
      // Step 2: Upload binary using XHR wrapper
      await uploadToR2(res.upload_url, pendingFile, (percent) => {
        setUploadProgress(percent);
      });

      // Step 3: save doc metadata
      await createDocMutation.mutateAsync({
        label: data.label,
        category: data.category,
        financial_year: data.financial_year,
        tags: data.tags,
        file_size_kb: Math.floor(pendingFile.size / 1024),
        file_type: pendingFile.name.endsWith('.pdf') ? 'pdf' : pendingFile.name.match(/\.(docx|doc)$/) ? 'doc' : 'image',
        download_url: res.file_url,
      });

      toast.success('Document uploaded successfully.');
      setUploadModalOpen(false);
      setPendingFile(null);
    } catch (err) {
      toast.error('Document upload failed. Please try again.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Actions
  const handleOpenEdit = (doc: any) => {
    setSelectedDoc(doc);
    resetEditForm({
      label: doc.label,
      category: doc.category,
      financial_year: doc.financial_year || '',
      tags: doc.tags.join(', '),
    });
    setEditModalOpen(true);
  };

  const executeEdit = (data: DocMetaFormInputs) => {
    if (!selectedDoc) return;
    updateDocMutation.mutate(
      { id: selectedDoc.id, updates: data },
      {
        onSuccess: () => {
          toast.success('Document details updated.');
          setEditModalOpen(false);
          setSelectedDoc(null);
        },
        onError: () => {
          toast.error('Failed to update details.');
        },
      }
    );
  };

  const executeDelete = (id: string) => {
    deleteDocMutation.mutate(id, {
      onSuccess: () => {
        toast.success('Document deleted from Library.');
      },
      onError: () => {
        toast.error('Deletion failed.');
      },
    });
  };

  // Icons resolver based on file type
  const getFileIcon = (type: string) => {
    switch (type) {
      case 'image':
        return <FileImage size={24} className="text-[#9D174D]" />;
      case 'doc':
        return <FileSpreadsheet size={24} className="text-[#0369A1]" />;
      default:
        return <FileText size={24} className="text-brand-navy" />;
    }
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {/* Navigation Tabs Header */}
        <div className="flex items-center justify-between border-b border-[#E2E6ED] pb-px">
          <TabsList className="bg-transparent h-auto p-0 gap-6">
            <TabsTrigger
              value="library"
              className="bg-transparent border-b-2 border-transparent data-[state=active]:border-brand-navy data-[state=active]:text-brand-navy font-semibold text-sm pb-3 px-1 rounded-none text-text-muted transition-all"
            >
              Document Library
            </TabsTrigger>
            <TabsTrigger
              value="attachments"
              className="bg-transparent border-b-2 border-transparent data-[state=active]:border-brand-navy data-[state=active]:text-brand-navy font-semibold text-sm pb-3 px-1 rounded-none text-text-muted transition-all"
            >
              System Receipts
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── TAB CONTENT: LIBRARY ── */}
        <TabsContent value="library" className="pt-6 m-0 outline-none">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
            {/* Category sidebar tree */}
            <div className="bg-white rounded-xl border border-surface-border p-4 shadow-premium space-y-1">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block px-3 mb-2">
                Categories
              </span>
              {categories.map((cat) => {
                const isActive = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-[#1A3C6E]/10 text-brand-navy'
                        : 'text-text-muted hover:bg-slate-50 hover:text-text-primary'
                    }`}
                  >
                    <span>{cat.label}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                      isActive ? 'bg-brand-navy text-white' : 'bg-slate-50 text-text-muted'
                    }`}>
                      {categoryCounts[cat.id] || 0}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Document display grid/list */}
            <div className="md:col-span-3 space-y-4">
              {/* Top toolbar */}
              <div className="bg-white p-3 rounded-xl border border-surface-border shadow-premium flex flex-wrap justify-between items-center gap-3">
                {/* Search */}
                <div className="relative w-full sm:w-72">
                  <Search size={16} className="absolute left-3 top-3 text-text-muted" />
                  <Input
                    placeholder="Search by label or tags..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 text-xs border-[#E2E6ED] h-9"
                  />
                </div>

                <div className="flex items-center gap-3 ml-auto">
                  {/* View Toggler */}
                  <div className="flex border rounded-lg overflow-hidden h-9">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`p-2 border-r hover:bg-slate-50 ${viewMode === 'grid' ? 'bg-slate-50 text-brand-navy' : 'text-text-muted'}`}
                      aria-label="Grid View"
                    >
                      <Grid size={15} />
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={`p-2 hover:bg-slate-50 ${viewMode === 'list' ? 'bg-slate-50 text-brand-navy' : 'text-text-muted'}`}
                      aria-label="List View"
                    >
                      <ListIcon size={15} />
                    </button>
                  </div>

                  {/* Upload trigger */}
                  <label className="bg-brand-navy hover:bg-[#153264] text-white flex items-center gap-2 text-xs font-semibold px-4 py-2 h-9 rounded-lg cursor-pointer">
                    <Upload size={14} />
                    <span>Upload</span>
                    <input
                      type="file"
                      onChange={handleFileSelect}
                      className="hidden"
                      accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                    />
                  </label>
                </div>
              </div>

              {/* Drag drop container overlay */}
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={`relative rounded-xl min-h-[360px] ${
                  isDragging ? 'bg-brand-navy/5 border-2 border-dashed border-brand-navy' : ''
                }`}
              >
                {/* Drop Overlay */}
                {isDragging && (
                  <div className="absolute inset-0 bg-brand-navy/5 border border-brand-navy flex items-center justify-center rounded-xl pointer-events-none z-20">
                    <p className="text-sm font-semibold text-brand-navy bg-white border px-4 py-2 rounded-lg shadow-md">
                      Drop files to add to {categories.find(c => c.id === selectedCategory)?.label}
                    </p>
                  </div>
                )}

                {isLoading ? (
                  <div className="flex justify-center items-center py-20">
                    <Loader2 size={32} className="animate-spin text-brand-navy" />
                  </div>
                ) : filteredLibraryDocs.length === 0 ? (
                  /* Empty state */
                  <div className="bg-white border rounded-xl shadow-premium p-12 text-center flex flex-col items-center justify-center space-y-4 max-w-md mx-auto mt-6">
                    <div className="w-20 h-20 bg-[#F8FAFC] border rounded-full flex items-center justify-center text-slate-300">
                      <FolderOpen size={30} />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold text-brand-navy">No documents</h3>
                      <p className="text-xs text-text-muted leading-relaxed">
                        No files uploaded in "{categories.find((c) => c.id === selectedCategory)?.label}" yet.
                      </p>
                    </div>
                    <label className="bg-brand-navy hover:bg-[#153264] text-white flex items-center gap-2 text-xs font-semibold px-4 py-2 h-9 rounded-lg cursor-pointer">
                      <Plus size={14} />
                      <span>Upload first file</span>
                      <input
                        type="file"
                        onChange={handleFileSelect}
                        className="hidden"
                        accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                      />
                    </label>
                  </div>
                ) : viewMode === 'grid' ? (
                  /* Grid Display */
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredLibraryDocs.map((doc) => (
                      <div
                        key={doc.id}
                        className="bg-white p-4 rounded-xl border border-surface-border shadow-premium flex flex-col justify-between hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)] transition-all"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-slate-50 border rounded-lg">
                              {getFileIcon(doc.file_type)}
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-xs font-semibold text-text-primary line-clamp-2 pr-2 leading-relaxed">
                                {doc.label}
                              </h4>
                              <span className="text-[10px] text-text-muted font-mono block mt-0.5">
                                {formatFileSize(doc.file_size_kb)}
                              </span>
                            </div>
                          </div>

                          {/* Kebab action */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                className="p-1 rounded-md text-text-muted hover:bg-slate-50 hover:text-text-primary transition-all focus-visible:outline-none"
                                aria-label="Document Actions"
                              >
                                <MoreVertical size={16} />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-white border border-surface-border rounded-lg shadow-md z-30">
                              <DropdownMenuItem
                                onClick={() => handleOpenEdit(doc)}
                                className="flex items-center gap-2 text-xs font-medium cursor-pointer py-2 px-3 text-text-primary hover:bg-[#F0F4FA]"
                              >
                                <Edit size={14} />
                                <span>Rename / Move</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => executeDelete(doc.id)}
                                className="flex items-center gap-2 text-xs font-medium cursor-pointer py-2 px-3 text-[#991B1B] hover:bg-[#FEF2F2]"
                              >
                                <Trash2 size={14} />
                                <span>Delete file</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {/* Tags */}
                        {doc.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 my-3">
                            {doc.tags.map((t) => (
                              <span
                                key={t}
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-slate-50 text-[10px] font-medium text-text-muted border border-surface-border rounded"
                              >
                                <Tag size={8} />
                                {t}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Footer */}
                        <div className="flex items-center justify-between pt-3 border-t border-[#E2E6ED]/60 mt-auto text-[10px]">
                          <span className="font-semibold text-brand-navy">FY {doc.financial_year}</span>
                          <a
                            href={doc.download_url}
                            download={doc.label}
                            className="inline-flex items-center gap-1 font-semibold text-brand-teal hover:underline focus-visible:outline-none"
                          >
                            <Download size={12} />
                            <span>Download</span>
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* List Display */
                  <div className="bg-white border border-surface-border rounded-xl shadow-premium overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 border-b border-surface-border text-brand-navy font-semibold">
                        <tr>
                          <th className="p-3">File Name</th>
                          <th className="p-3">FY</th>
                          <th className="p-3">Tags</th>
                          <th className="p-3">Size</th>
                          <th className="p-3">Upload Date</th>
                          <th className="p-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-border">
                        {filteredLibraryDocs.map((doc) => (
                          <tr key={doc.id} className="hover:bg-slate-50/50">
                            <td className="p-3 font-semibold text-text-primary flex items-center gap-2">
                              {getFileIcon(doc.file_type)}
                              <span>{doc.label}</span>
                            </td>
                            <td className="p-3 font-mono">{doc.financial_year}</td>
                            <td className="p-3">
                              <div className="flex gap-1">
                                {doc.tags.map(t => (
                                  <span key={t} className="px-1.5 py-0.5 bg-slate-50 border rounded text-[9px] text-text-muted">{t}</span>
                                ))}
                              </div>
                            </td>
                            <td className="p-3 font-mono text-text-muted">{formatFileSize(doc.file_size_kb)}</td>
                            <td className="p-3 text-text-muted tabular-nums">
                              {new Date(doc.upload_date).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </td>
                            <td className="p-3 text-right flex items-center justify-end gap-2">
                              <a href={doc.download_url} download className="p-1 text-brand-teal hover:bg-slate-50 rounded">
                                <Download size={14} />
                              </a>
                              <button onClick={() => handleOpenEdit(doc)} className="p-1 text-text-muted hover:bg-slate-50 rounded">
                                <Edit size={14} />
                              </button>
                              <button onClick={() => executeDelete(doc.id)} className="p-1 text-[#991B1B] hover:bg-slate-50 rounded">
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ── TAB CONTENT: ATTACHMENTS ── */}
        <TabsContent value="attachments" className="pt-6 m-0 outline-none">
          <div className="space-y-6">
            {Object.keys(groupedAttachments).length === 0 ? (
              <div className="bg-white border rounded-xl shadow-premium p-12 text-center flex flex-col items-center justify-center space-y-4 max-w-md mx-auto">
                <div className="w-20 h-20 bg-[#F8FAFC] border rounded-full flex items-center justify-center text-slate-300">
                  <FileText size={30} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-brand-navy">No attachments logged</h3>
                  <p className="text-xs text-text-muted leading-relaxed">
                    No receipt documents are currently attached to tax payments or obligations.
                  </p>
                </div>
              </div>
            ) : (
              Object.keys(groupedAttachments).map((groupName) => (
                <div key={groupName} className="bg-white border border-surface-border rounded-xl shadow-premium overflow-hidden">
                  <div className="bg-slate-50 px-5 py-3 border-b border-surface-border">
                    <h4 className="text-xs font-semibold text-brand-navy uppercase tracking-wider">
                      {groupName}
                    </h4>
                  </div>
                  <table className="w-full text-left text-xs border-collapse">
                    <tbody className="divide-y divide-surface-border">
                      {groupedAttachments[groupName].map((doc) => (
                        <tr key={doc.id} className="hover:bg-slate-50/20">
                          <td className="p-4 font-semibold text-text-primary flex items-center gap-2.5">
                            {getFileIcon(doc.file_type)}
                            <span>{doc.label}</span>
                          </td>
                          <td className="p-4 text-text-muted font-mono">{formatFileSize(doc.file_size_kb)}</td>
                          <td className="p-4 text-text-muted tabular-nums">
                            Uploaded on{' '}
                            {new Date(doc.upload_date).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </td>
                          <td className="p-4 text-right">
                            <a
                              href={doc.download_url}
                              download={doc.label}
                              className="inline-flex items-center gap-1 font-semibold text-brand-teal hover:underline focus-visible:outline-none"
                            >
                              <Download size={13} />
                              <span>Download Receipt</span>
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ── METADATA INPUT DIALOG (on drag-drop upload confirm) ── */}
      <Dialog open={uploadModalOpen} onOpenChange={(val) => !val && !isUploading && setUploadModalOpen(false)}>
        <DialogContent className="sm:max-w-[420px] bg-white border border-surface-border rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-brand-navy">Document Metadata</DialogTitle>
          </DialogHeader>

          {pendingFile && (
            <div className="p-3 bg-slate-50 border rounded-lg text-xs leading-relaxed text-text-muted">
              File: <span className="font-semibold text-text-primary">{pendingFile.name}</span> ({formatFileSize(pendingFile.size / 1024)})
            </div>
          )}

          <div className="space-y-4 my-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Label Name</Label>
              <Input
                placeholder="Document Label"
                className="text-sm border-[#E2E6ED]"
                disabled={isUploading}
                {...regMeta('label')}
              />
              {metaErrors.label && <span className="text-[10px] text-brand-danger font-medium">{metaErrors.label.message}</span>}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Category</Label>
              <Select
                disabled={isUploading}
                defaultValue={selectedCategory}
                onValueChange={(val) => setMetaValue('category', val as any)}
              >
                <SelectTrigger className="text-xs border-[#E2E6ED]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border text-xs z-50">
                  <SelectItem value="income_tax">Income Tax</SelectItem>
                  <SelectItem value="property">Property & Land</SelectItem>
                  <SelectItem value="gst">GST</SelectItem>
                  <SelectItem value="vehicle">Vehicle</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Financial Year</Label>
              <Input
                placeholder="e.g. 2025-26"
                className="text-sm border-[#E2E6ED]"
                disabled={isUploading}
                {...regMeta('financial_year')}
              />
              {metaErrors.financial_year && <span className="text-[10px] text-brand-danger font-medium">{metaErrors.financial_year.message}</span>}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Tags (comma separated)</Label>
              <Input
                placeholder="e.g. return, challan, 2026"
                className="text-sm border-[#E2E6ED]"
                disabled={isUploading}
                {...regMeta('tags')}
              />
            </div>

            {isUploading && (
              <div className="pt-2 space-y-1">
                <div className="flex justify-between text-[10px] text-text-muted">
                  <span>Uploading to cloud storage...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-brand-navy h-1.5 transition-all" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex gap-2 justify-end pt-3 border-t">
            <Button
              variant="outline"
              onClick={() => !isUploading && setUploadModalOpen(false)}
              disabled={isUploading}
              className="text-xs h-9 border-[#E2E6ED] hover:bg-[#F0F4FA]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleMetaSubmit(executeUpload)}
              disabled={isUploading}
              className="bg-brand-navy text-white text-xs h-9 hover:bg-[#153264] flex items-center gap-2"
            >
              {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              <span>{isUploading ? 'Uploading...' : 'Confirm Upload'}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── EDIT DETAILS DIALOG ── */}
      <Dialog open={editModalOpen} onOpenChange={(val) => !val && setEditModalOpen(false)}>
        <DialogContent className="sm:max-w-[420px] bg-white border border-surface-border rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-brand-navy font-sans">Edit Document Metadata</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 my-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Label Name</Label>
              <Input className="text-sm border-[#E2E6ED]" {...regEdit('label')} />
              {editErrors.label && <span className="text-[10px] text-brand-danger font-medium">{editErrors.label.message}</span>}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Category</Label>
              <Select
                value={selectedDoc ? selectedDoc.category : undefined}
                onValueChange={(val) => setEditValue('category', val as any)}
              >
                <SelectTrigger className="text-xs border-[#E2E6ED]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border text-xs z-50">
                  <SelectItem value="income_tax">Income Tax</SelectItem>
                  <SelectItem value="property">Property & Land</SelectItem>
                  <SelectItem value="gst">GST</SelectItem>
                  <SelectItem value="vehicle">Vehicle</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Financial Year</Label>
              <Input className="text-sm border-[#E2E6ED]" {...regEdit('financial_year')} />
              {editErrors.financial_year && <span className="text-[10px] text-brand-danger font-medium">{editErrors.financial_year.message}</span>}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Tags (comma separated)</Label>
              <Input className="text-sm border-[#E2E6ED]" {...regEdit('tags')} />
            </div>
          </div>

          <DialogFooter className="flex gap-2 justify-end pt-3 border-t">
            <Button
              variant="outline"
              onClick={() => setEditModalOpen(false)}
              className="text-xs h-9 border-[#E2E6ED] hover:bg-[#F0F4FA]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditSubmit(executeEdit)}
              className="bg-brand-navy text-white text-xs h-9 hover:bg-[#153264]"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
export default DocumentsPage;
