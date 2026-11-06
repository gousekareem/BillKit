/* Scan: capture/upload with preview, rotate, crop, progress and cancel. © 2026 Shaik Gouse Kareem. */
import { useEffect, useRef, useState, type DragEvent } from 'react';
import { useNavigate } from 'react-router';
import { Camera, Crop, FileText, ImagePlus, RefreshCw, RotateCcw, RotateCw, Trash2, Upload, X } from 'lucide-react';
import { CameraDialog, CropDialog } from '../../components/ImageTools';
import { ACCEPT_ATTR, canEdit, isHeic, isPdf, rotateFile, validateFile } from '../../utils/image';
import { uploadScan, type ApiError, type UploadHandle } from '../../services/api';
import { useAuth } from '../../services/auth';
import { useToast } from '../../services/toast';
import { useTitle } from '../../hooks/usePageMeta';

interface Page { id: string; file: File; url: string | null }

export default function Scan() {
  useTitle('Scan a bill');
  const { config, user } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const maxMb = config?.maxUploadMb ?? 15;
  const maxPages = config?.maxPages ?? 5;
  const [pages, setPages] = useState<Page[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [drag, setDrag] = useState(false);
  const [camera, setCamera] = useState(false);
  const [cropping, setCropping] = useState<Page | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [allowVlm, setAllowVlm] = useState(false);
  const handle = useRef<UploadHandle | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const replaceTarget = useRef<string | null>(null);

  useEffect(() => setAllowVlm(Boolean(config?.vlmAvailable && user?.settings.useCloudVision)), [config, user]);
  useEffect(() => () => pages.forEach((p) => p.url && URL.revokeObjectURL(p.url)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const makePage = (file: File): Page => ({ id: crypto.randomUUID(), file, url: canEdit(file) ? URL.createObjectURL(file) : null });

  const addFiles = (list: FileList | File[]) => {
    const files = Array.from(list);
    const errs: string[] = [];
    const ok: File[] = [];
    for (const f of files) {
      const e = validateFile(f, maxMb);
      if (e) errs.push(e);
      else ok.push(f);
    }
    if (replaceTarget.current && ok[0]) {
      const target = replaceTarget.current;
      replaceTarget.current = null;
      setPages((ps) => ps.map((p) => (p.id === target ? makePage(ok[0]!) : p)));
      setErrors(errs);
      return;
    }
    const hasPdf = [...pages.map((p) => p.file), ...ok].some(isPdf);
    if (hasPdf && pages.length + ok.length > 1) errs.push('A PDF must be uploaded on its own (it can contain up to 5 pages).');
    else if (pages.length + ok.length > maxPages) errs.push(`A bill can have at most ${maxPages} pages.`);
    else setPages((ps) => [...ps, ...ok.map(makePage)]);
    setErrors(errs);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  const rotate = async (p: Page, deg: 90 | -90) => {
    try {
      const f = await rotateFile(p.file, deg);
      setPages((ps) => ps.map((x) => (x.id === p.id ? makePage(f) : x)));
    } catch (e) {
      toast('error', (e as Error).message);
    }
  };

  const start = async () => {
    if (!pages.length) return;
    setProgress(0);
    handle.current = uploadScan(pages.map((p) => p.file), { allowVlm }, setProgress);
    try {
      const { id } = await handle.current.promise;
      nav(`/app/scan/${id}`);
    } catch (e) {
      const err = e as ApiError;
      if (err.code !== 'aborted') toast('error', err.message);
      else toast('info', 'Upload cancelled.');
      setProgress(null);
    }
  };

  const uploading = progress !== null;
  return (
    <>
      <div className="page-title">
        <div>
          <h1>Scan a bill</h1>
          <p>Capture with your camera or upload JPG, PNG, WebP, HEIC or PDF — up to {maxPages} pages, {maxMb} MB each.</p>
        </div>
      </div>

      {pages.length === 0 ? (
        <div
          className={`dropzone${drag ? ' drag' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
        >
          <div className="dz-icon"><ImagePlus size={28} aria-hidden /></div>
          <h2 style={{ fontSize: 'var(--text-xl)' }}>Drop your bill here</h2>
          <p className="muted">or choose how to add it</p>
          <div className="row" style={{ justifyContent: 'center' }}>
            <button className="btn btn-primary btn-lg" onClick={() => setCamera(true)}><Camera size={18} aria-hidden /> Use camera</button>
            <button className="btn btn-lg" onClick={() => cameraInput.current?.click()}><Camera size={18} aria-hidden /> Phone camera app</button>
            <button className="btn btn-lg" onClick={() => fileInput.current?.click()}><Upload size={18} aria-hidden /> Choose files</button>
          </div>
          <p className="subtle" style={{ marginTop: 'var(--space-5)' }}>Tip: lay the bill flat, fill the frame, avoid shadows and keep the total visible. Messy photos are fine — BillKit straightens them.</p>
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <h2>Preview ({pages.length} page{pages.length > 1 ? 's' : ''})</h2>
            <div className="row">
              {pages.length < maxPages && !isPdf(pages[0]!.file) && (
                <button className="btn btn-sm" onClick={() => fileInput.current?.click()} disabled={uploading}><ImagePlus size={16} aria-hidden /> Add page</button>
              )}
              <button className="btn btn-sm btn-ghost" onClick={() => setPages([])} disabled={uploading}><X size={16} aria-hidden /> Clear</button>
            </div>
          </div>
          <div className="thumbs">
            {pages.map((p, i) => (
              <figure className="thumb" key={p.id} style={{ margin: 0 }}>
                <div className="thumb-img">
                  {p.url ? <img src={p.url} alt={`Page ${i + 1} preview`} /> : (
                    <div className="center subtle" style={{ padding: 12 }}>
                      <FileText size={32} aria-hidden style={{ margin: '0 auto 6px' }} />
                      {isPdf(p.file) ? 'PDF' : isHeic(p.file) ? 'HEIC' : 'File'} — preview not available; it will be converted on the server.
                    </div>
                  )}
                </div>
                <figcaption className="subtle" style={{ padding: '4px 8px' }}>{p.file.name} · {(p.file.size / 1024 / 1024).toFixed(1)} MB</figcaption>
                <div className="thumb-actions">
                  <button className="btn btn-ghost btn-sm btn-icon" aria-label={`Rotate page ${i + 1} left`} onClick={() => rotate(p, -90)} disabled={!p.url || uploading}><RotateCcw size={16} /></button>
                  <button className="btn btn-ghost btn-sm btn-icon" aria-label={`Rotate page ${i + 1} right`} onClick={() => rotate(p, 90)} disabled={!p.url || uploading}><RotateCw size={16} /></button>
                  <button className="btn btn-ghost btn-sm btn-icon" aria-label={`Crop page ${i + 1}`} onClick={() => setCropping(p)} disabled={!p.url || uploading}><Crop size={16} /></button>
                  <button className="btn btn-ghost btn-sm btn-icon" aria-label={`Replace page ${i + 1}`} onClick={() => { replaceTarget.current = p.id; fileInput.current?.click(); }} disabled={uploading}><RefreshCw size={16} /></button>
                  <button className="btn btn-ghost btn-sm btn-icon" aria-label={`Remove page ${i + 1}`} onClick={() => setPages((ps) => ps.filter((x) => x.id !== p.id))} disabled={uploading}><Trash2 size={16} /></button>
                </div>
              </figure>
            ))}
          </div>

          <hr />
          {config?.vlmAvailable ? (
            <label className="checkbox" style={{ marginBottom: 'var(--space-4)' }}>
              <input type="checkbox" checked={allowVlm} onChange={(e) => setAllowVlm(e.target.checked)} disabled={uploading} />
              <span>
                <strong>Allow cloud vision cross-check for this bill</strong><br />
                <span className="subtle">If BillKit is unsure, a downscaled copy of this bill image and its OCR text will be sent to {config.vlmProvider === 'anthropic' ? 'Anthropic' : 'the configured AI provider'}. Your name and email are not sent.</span>
              </span>
            </label>
          ) : (
            <p className="subtle">Processing runs on the BillKit server (OCR + rules). Cloud vision is not configured on this server.</p>
          )}

          {uploading ? (
            <div className="stack" aria-live="polite">
              <div className="row between small"><span>Uploading… {Math.round((progress ?? 0) * 100)}%</span><button className="btn btn-sm" onClick={() => handle.current?.abort()}>Cancel upload</button></div>
              <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((progress ?? 0) * 100)} aria-label="Upload progress"><span style={{ width: `${(progress ?? 0) * 100}%` }} /></div>
            </div>
          ) : (
            <button className="btn btn-primary btn-lg" onClick={start}><Upload size={18} aria-hidden /> Upload &amp; process</button>
          )}
        </div>
      )}

      {errors.length > 0 && (
        <div className="alert alert-error" role="alert" style={{ marginTop: 'var(--space-4)' }}>
          <ul style={{ margin: 0, paddingLeft: '1rem' }}>{errors.map((e) => <li key={e}>{e}</li>)}</ul>
        </div>
      )}

      <input ref={fileInput} type="file" accept={ACCEPT_ATTR} multiple hidden onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} aria-label="Choose bill files" />
      <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} aria-label="Capture with phone camera" />
      <CameraDialog open={camera} onClose={() => setCamera(false)} onCapture={(f) => addFiles([f])} />
      <CropDialog
        file={cropping?.file ?? null}
        onClose={() => setCropping(null)}
        onDone={(f) => {
          setPages((ps) => ps.map((x) => (x.id === cropping?.id ? makePage(f) : x)));
          setCropping(null);
        }}
      />
    </>
  );
}
