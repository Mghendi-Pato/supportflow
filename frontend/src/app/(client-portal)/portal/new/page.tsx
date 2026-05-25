'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Send, CheckCircle2, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { AttachmentStager, type StagedFile } from '@/components/ui/AttachmentStager';
import { useNotify } from '@/hooks/useNotify';
import api from '@/lib/api';

export default function NewTicketPage() {
  const router = useRouter();
  const notify = useNotify();

  const [form, setForm] = useState({ title: '', description: '', priority: 'MEDIUM' });
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim())       { setError('Title is required'); return; }
    if (!form.description.trim()) { setError('Please describe your issue'); return; }

    setError('');
    setIsSubmitting(true);

    try {
      // 1 — create ticket
      const res = await api.post('/tickets', form);
      const ticketId: string = res.data.data.id;

      // 2 — upload each staged file sequentially
      if (stagedFiles.length > 0) {
        setUploadProgress({ done: 0, total: stagedFiles.length });
        for (let i = 0; i < stagedFiles.length; i++) {
          const fd = new FormData();
          fd.append('file', stagedFiles[i].file);
          await api.post(`/uploads/tickets/${ticketId}`, fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          setUploadProgress({ done: i + 1, total: stagedFiles.length });
        }
      }

      notify.success('Ticket submitted — we\'ll be in touch soon');
      router.push(`/portal/tickets/${ticketId}`);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to submit ticket. Please try again.';
      setError(msg);
      notify.error(msg);
      setIsSubmitting(false);
      setUploadProgress(null);
    }
  };

  // Derive a friendly progress label
  const progressLabel = uploadProgress
    ? uploadProgress.total === 1
      ? 'Uploading attachment…'
      : `Uploading ${uploadProgress.done} of ${uploadProgress.total} attachments…`
    : isSubmitting
    ? 'Creating ticket…'
    : null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/portal" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Submit a ticket</h1>
          <p className="text-sm text-gray-500">We'll get back to you as soon as possible.</p>
        </div>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Title */}
          <Input
            label="Title"
            placeholder="Briefly summarize your issue"
            value={form.title}
            onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
            required
          />

          {/* Description */}
          <Textarea
            label="Description"
            placeholder="Please describe the issue in as much detail as possible. Include steps to reproduce, error messages, or relevant context."
            rows={6}
            value={form.description}
            onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
          />

          {/* Priority */}
          <Select
            label="Priority"
            options={[
              { value: 'LOW',      label: 'Low — Not urgent' },
              { value: 'MEDIUM',   label: 'Medium — Moderate impact' },
              { value: 'HIGH',     label: 'High — Significant impact' },
              { value: 'CRITICAL', label: 'Critical — Business is blocked' },
            ]}
            value={form.priority}
            onChange={(e) => setForm(f => ({ ...f, priority: e.target.value }))}
          />

          {/* Attachments — staged locally, uploaded on submit */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">
              Attachments
              <span className="ml-1.5 text-xs font-normal text-gray-400">(optional — images, videos, PDFs, and Office docs)</span>
            </p>
            <AttachmentStager
              files={stagedFiles}
              onChange={setStagedFiles}
              maxBytes={10 * 1024 * 1024}
            />
          </div>

          {/* Upload progress bar */}
          {uploadProgress && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-blue-600">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                  {progressLabel}
                </span>
                <span>{Math.round((uploadProgress.done / uploadProgress.total) * 100)}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${(uploadProgress.done / uploadProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Creating (no files) spinner label */}
          {isSubmitting && !uploadProgress && (
            <p className="text-xs text-gray-400 flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-gray-400 animate-pulse" />
              Creating ticket…
            </p>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
              <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <Link href="/portal">
              <Button variant="ghost" type="button" disabled={isSubmitting}>Cancel</Button>
            </Link>
            <Button type="submit" isLoading={isSubmitting} size="lg" disabled={isSubmitting}>
              <Send size={16} />
              {isSubmitting ? (progressLabel ?? 'Submitting…') : 'Submit Ticket'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
